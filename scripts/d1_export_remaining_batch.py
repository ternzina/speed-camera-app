#!/usr/bin/env python3
"""Render one remaining-country batch as idempotent SQL.

The SQL uses ON CONFLICT DO NOTHING and omits storage_control and import_runs.
This script writes under the local cache only. It does not call Cloudflare.
"""
import argparse
import sqlite3
from pathlib import Path

import d1_export_ua_pl_slice as trial

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "master-db/cache/d1-operational/camalert-operational.sqlite"
CACHE = ROOT / "master-db/cache/d1-operational/remaining-batches"


def render_sql(conn, batch, skip_sources):
    if "storage_control" in batch or "import_runs" in batch:
        raise RuntimeError("country batches must not carry the trial pointer tables")
    lines = [
        "-- Remaining-country batch. Do not execute against D1 until a separate approval.",
        "-- Every INSERT uses ON CONFLICT DO NOTHING and does not replace an existing row.",
        "-- storage_control and import_runs are omitted so the Ukraine/Poland pointer stays as it is.",
        "PRAGMA foreign_keys = ON;",
    ]
    if batch.get("source_rows"):
        if skip_sources:
            placeholders = ",".join("?" for _ in skip_sources)
            source_query = f"SELECT * FROM sources WHERE source_code NOT IN ({placeholders}) ORDER BY source_code"
            source_params = tuple(sorted(skip_sources))
        else:
            source_query = "SELECT * FROM sources ORDER BY source_code"
            source_params = ()
        _, _, source_sql = trial.insert_rows(conn, "sources", source_query, source_params)
        if len(source_sql) != batch["source_rows"]:
            raise RuntimeError(f"source statements {len(source_sql)} do not match the plan")
        lines.extend(source_sql)
    if batch.get("registry_rows"):
        _, _, registry_sql = trial.insert_rows(conn, "archive_registry", """
            SELECT * FROM archive_registry
            WHERE root_key <> (SELECT archive_root FROM storage_control WHERE id=1)
            ORDER BY root_key
        """)
        if len(registry_sql) != batch["registry_rows"]:
            raise RuntimeError(f"registry statements {len(registry_sql)} do not match the plan")
        lines.extend(registry_sql)
    camera_sql = []
    moderation_sql = []
    for part in batch["parts"]:
        _, _, part_cameras = trial.insert_rows(conn, "cameras", """
            SELECT * FROM cameras
            WHERE country_code=? AND canonical_id>=? AND canonical_id<=?
            ORDER BY canonical_id
        """, (part["country_code"], part["first_canonical_id"], part["last_canonical_id"]))
        if len(part_cameras) != part["cameras"]:
            raise RuntimeError(f"{part['country_code']} rendered {len(part_cameras)} cameras, plan says {part['cameras']}")
        camera_sql.extend(part_cameras)
        _, _, part_moderation = trial.insert_rows(conn, "camera_moderation", """
            SELECT m.* FROM camera_moderation m
            JOIN cameras c ON c.canonical_id=m.canonical_id
            WHERE c.country_code=? AND c.canonical_id>=? AND c.canonical_id<=?
            ORDER BY m.canonical_id
        """, (part["country_code"], part["first_canonical_id"], part["last_canonical_id"]))
        if len(part_moderation) != part["unpublished"]:
            raise RuntimeError(f"{part['country_code']} rendered {len(part_moderation)} moderation rows, plan says {part['unpublished']}")
        moderation_sql.extend(part_moderation)
    lines.extend(camera_sql)
    lines.extend(moderation_sql)
    text = "\n".join(lines) + "\n"
    inserts = [line for line in text.splitlines() if line.startswith("INSERT ")]
    targets = [line.split()[2] for line in inserts]
    if any("DO UPDATE" in line for line in inserts) or any(target in {"storage_control", "import_runs", "camera_export_ids"} for target in targets):
        raise RuntimeError("batch SQL contains a pointer write, an export id, or a replacement update")
    if any("DO NOTHING" not in line for line in inserts):
        raise RuntimeError("a batch INSERT is missing ON CONFLICT DO NOTHING")
    expected = batch.get("source_rows", 0) + batch.get("registry_rows", 0) + batch["cameras"] + batch["unpublished"]
    if len(inserts) != expected:
        raise RuntimeError(f"rendered {len(inserts)} inserts, plan expects {expected}")
    return text


def check_all(plan_path):
    import hashlib
    import json
    report = json.loads(plan_path.read_text())
    schema = (ROOT / "cloudflare/camera-data/d1/schema.sql").read_text()
    trial_sql = (ROOT / "master-db/cache/d1-operational/ua-pl-trial.sql").read_text()
    source = sqlite3.connect(SOURCE)
    fresh = sqlite3.connect(":memory:")
    try:
        skip = set(trial_skip(source))
        fresh.executescript(schema)
        fresh.executescript(trial_sql)
        texts = []
        CACHE.mkdir(parents=True, exist_ok=True)
        for batch in report["batches"]:
            text = render_sql(source, batch, skip)
            path = CACHE / f"batch-{batch['batch']:02d}.sql"
            path.write_text(text)
            batch["sql_bytes"] = path.stat().st_size
            batch["sql_file"] = str(path.relative_to(ROOT))
            fresh.executescript(text)
            texts.append(text)
        counts = fresh.execute("""
            SELECT
              (SELECT COUNT(*) FROM cameras),
              (SELECT SUM(published=1) FROM cameras),
              (SELECT SUM(published=0) FROM cameras),
              (SELECT SUM(status='candidate') FROM cameras),
              (SELECT SUM(status='review') FROM cameras),
              (SELECT SUM(status='candidate' AND published=1) FROM cameras),
              (SELECT COUNT(*) FROM sources),
              (SELECT COUNT(*) FROM camera_moderation),
              (SELECT COUNT(*) FROM archive_registry),
              (SELECT COUNT(*) FROM camera_export_ids),
              (SELECT COUNT(*) FROM pragma_foreign_key_check),
              (SELECT master_record_count FROM storage_control WHERE id=1),
              (SELECT result FROM import_runs)
        """).fetchone()
        expected = (123579, 114794, 8785, 2131, 6654, 0, 218, 8785, 53, 1397, 0, 2944, "ua_pl_trial")
        if counts != expected:
            raise RuntimeError(f"local batch replay counts {counts} != {expected}")

        def digest(conn, query):
            rows = conn.execute(query).fetchall()
            blob = "\n".join("|".join("" if value is None else str(value) for value in row) for row in rows)
            return hashlib.sha256(blob.encode()).hexdigest(), len(rows)

        camera_query = "SELECT * FROM cameras ORDER BY canonical_id"
        source_query = "SELECT source_code, source_name, source_type, country_code, source_url, license, license_url, manifest_license, in_public_manifest FROM sources ORDER BY source_code"
        export_query = "SELECT country_code, export_group, export_id, canonical_id, canonical_key, role FROM camera_export_ids ORDER BY 1,2,3,5"
        if digest(fresh, camera_query) != digest(source, camera_query):
            raise RuntimeError("camera checksums after the local batch replay do not match the full SQLite file")
        if digest(fresh, source_query) != digest(source, source_query):
            raise RuntimeError("source codes after the local batch replay do not match the full SQLite file")
        if digest(fresh, export_query) != digest(source, export_query):
            raise RuntimeError("export ids changed during the remaining-country replay")
        before = fresh.total_changes
        for text in texts:
            fresh.executescript(text)
        replay_delta = fresh.total_changes - before
        if replay_delta != 0:
            raise RuntimeError(f"second local load changed {replay_delta} rows")
        camera_digest, camera_count = digest(fresh, camera_query)
        report["local_replay"] = {
            "result": "passed",
            "cloud_import": "not_run",
            "cameras": camera_count,
            "published": counts[1],
            "unpublished": counts[2],
            "candidates": counts[3],
            "review": counts[4],
            "candidates_published": counts[5],
            "sources": counts[6],
            "moderation": counts[7],
            "registry_rows": counts[8],
            "export_ids": counts[9],
            "foreign_key_violations": counts[10],
            "storage_control_master_record_count": counts[11],
            "import_runs_result": counts[12],
            "camera_checksum_sha256": camera_digest,
            "second_load_row_changes": replay_delta,
            "sql_bytes": sum(batch["sql_bytes"] for batch in report["batches"]),
        }
    finally:
        source.close()
        fresh.close()
    plan_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report["local_replay"], indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int)
    parser.add_argument("--check-all", action="store_true")
    parser.add_argument("--plan", type=Path, default=ROOT / "master-db/reports/d1-remaining-batches.json")
    args = parser.parse_args()
    if args.check_all:
        check_all(args.plan)
        return
    if args.batch is None:
        raise SystemExit("pass --batch N or --check-all")
    import json
    report = json.loads(args.plan.read_text())
    batch = next(item for item in report["batches"] if item["batch"] == args.batch)
    conn = sqlite3.connect(SOURCE)
    try:
        skip = set(trial_skip(conn))
        text = render_sql(conn, batch, skip)
    finally:
        conn.close()
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / f"batch-{batch['batch']:02d}.sql"
    target.write_text(text)
    print(json.dumps({"sql_file": str(target), "bytes": target.stat().st_size, "batch": batch["batch"], "d1_writes": batch["writes"]}, indent=2))


def trial_skip(conn):
    return [row[0] for row in conn.execute("""
        SELECT source_code FROM sources
        WHERE country_code IN ('UA','PL')
           OR source_code IN (
                SELECT DISTINCT j.value FROM cameras c, json_each(c.source_codes) j
                WHERE c.country_code IN ('UA','PL')
           )
    """)]


if __name__ == "__main__":
    main()
