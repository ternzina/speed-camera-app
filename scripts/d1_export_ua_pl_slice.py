#!/usr/bin/env python3
"""Write the Ukraine and Poland trial SQL from the verified local SQLite file.

The file is for a later `wrangler d1 execute --remote --file`. This script does
not create a D1 database and does not call Cloudflare, Supabase, or R2.
"""
import json, sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "master-db/cache/d1-operational/camalert-operational.sqlite"
TARGET = ROOT / "master-db/cache/d1-operational/ua-pl-trial.sql"

def sql_value(value):
    if value is None:
        return "NULL"
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    if isinstance(value, float):
        return repr(value)
    text = str(value)
    if "\n" not in text and "\r" not in text:
        return "'" + text.replace("'", "''") + "'"
    pieces = []
    buffer = []

    def flush():
        if buffer:
            pieces.append("'" + "".join(buffer).replace("'", "''") + "'")
            buffer.clear()

    for character in text:
        if character == "\n":
            flush()
            pieces.append("char(10)")
        elif character == "\r":
            flush()
            pieces.append("char(13)")
        else:
            buffer.append(character)
    flush()
    return " || ".join(pieces)

# Repeat loads skip the existing primary key. DO NOTHING does not replace a row.
CONFLICT = {
    "sources": "ON CONFLICT(source_code) DO NOTHING",
    "cameras": "ON CONFLICT(canonical_id) DO NOTHING",
    "camera_export_ids": "ON CONFLICT(country_code, export_group, export_id, canonical_key) DO NOTHING",
    "camera_moderation": "ON CONFLICT(canonical_id) DO NOTHING",
    "archive_registry": "ON CONFLICT(root_key) DO NOTHING",
    "storage_control": "ON CONFLICT(id) DO NOTHING",
    "import_runs": "ON CONFLICT(master_decoded_sha256) DO NOTHING",
}

def insert_rows(conn, table, query, params=()):
    cursor = conn.execute(query, params)
    columns = [item[0] for item in cursor.description]
    rows = cursor.fetchall()
    lines = []
    quoted_columns = ",".join(columns)
    conflict = CONFLICT[table]
    for row in rows:
        values = ",".join(sql_value(value) for value in row)
        lines.append(f"INSERT INTO {table} ({quoted_columns}) VALUES ({values}) {conflict};")
    return columns, rows, lines

def main():
    conn = sqlite3.connect(SOURCE)
    cameras = conn.execute("SELECT COUNT(*), SUM(published=1), SUM(published=0) FROM cameras WHERE country_code IN ('UA','PL')").fetchone()
    _, camera_rows, camera_sql = insert_rows(conn, "cameras", "SELECT * FROM cameras WHERE country_code IN ('UA','PL') ORDER BY canonical_id")
    _, export_rows, export_sql = insert_rows(conn, "camera_export_ids", "SELECT * FROM camera_export_ids WHERE country_code IN ('UA','PL') ORDER BY country_code, export_group, export_id, canonical_key")
    _, moderation_rows, moderation_sql = insert_rows(conn, "camera_moderation", "SELECT * FROM camera_moderation WHERE country_code IN ('UA','PL') ORDER BY canonical_id")
    _, source_rows, source_sql = insert_rows(conn, "sources", """
        SELECT * FROM sources
        WHERE country_code IN ('UA','PL')
           OR source_code IN (
                SELECT DISTINCT j.value FROM cameras c, json_each(c.source_codes) j
                WHERE c.country_code IN ('UA','PL')
           )
        ORDER BY source_code
    """)
    control = conn.execute("SELECT * FROM storage_control WHERE id=1").fetchone()
    control_columns = [item[1] for item in conn.execute("PRAGMA table_info(storage_control)")]
    control_map = dict(zip(control_columns, control))
    _, registry_rows, registry_sql = insert_rows(conn, "archive_registry", "SELECT * FROM archive_registry WHERE root_key=?", (control_map["archive_root"],))
    published = int(cameras[1])
    unpublished = int(cameras[2])
    conn.row_factory = sqlite3.Row
    delivery = conn.execute("SELECT COUNT(*) FROM camera_export_ids WHERE country_code IN ('UA','PL') AND role='delivery'").fetchone()[0]
    render = conn.execute("SELECT COUNT(*) FROM camera_export_ids WHERE country_code IN ('UA','PL') AND role='render_projection'").fetchone()[0]
    control_map["master_record_count"] = len(camera_rows)
    control_map["delivery_pending"] = 0
    control_sql = "INSERT INTO storage_control ({columns}) VALUES ({values}) {conflict};".format(
        columns=",".join(control_columns),
        values=",".join(sql_value(control_map[column]) for column in control_columns),
        conflict=CONFLICT["storage_control"],
    )
    run_columns = [item[1] for item in conn.execute("PRAGMA table_info(import_runs)")]
    run = {
        "master_decoded_sha256": control_map["master_decoded_sha256"],
        "manifest_sha256": control_map["manifest_sha256"],
        "finished_at": control_map["manifest_generated_at"],
        "camera_count": len(camera_rows),
        "published_count": published,
        "unpublished_count": unpublished,
        "source_count": len(source_rows),
        "moderation_count": len(moderation_rows),
        "delivery_alias_count": delivery,
        "render_projection_count": render,
        "registry_count": len(registry_rows),
        "result": "ua_pl_trial",
    }
    run_sql = "INSERT INTO import_runs ({columns}) VALUES ({values}) {conflict};".format(
        columns=",".join(run_columns),
        values=",".join(sql_value(run[column]) for column in run_columns),
        conflict=CONFLICT["import_runs"],
    )
    body = [
        "-- Ukraine and Poland trial extracted from the verified local SQLite file.",
        "-- Every INSERT uses ON CONFLICT DO NOTHING, so a repeat load skips existing rows.",
        "-- This is not the full 123579-row master and it does not include the 443 prepared points.",
        "PRAGMA foreign_keys = ON;",
        *source_sql,
        *camera_sql,
        *export_sql,
        *moderation_sql,
        *registry_sql,
        control_sql,
        run_sql,
        "",
    ]
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text("\n".join(body))
    report = {
        "sql_file": str(TARGET),
        "sql_bytes": TARGET.stat().st_size,
        "statements": len(source_sql) + len(camera_sql) + len(export_sql) + len(moderation_sql) + len(registry_sql) + 3,
        "cameras": len(camera_rows),
        "published": published,
        "unpublished": unpublished,
        "ua_cameras": conn.execute("SELECT COUNT(*) FROM cameras WHERE country_code='UA'").fetchone()[0],
        "pl_cameras": conn.execute("SELECT COUNT(*) FROM cameras WHERE country_code='PL'").fetchone()[0],
        "sources": len(source_rows),
        "delivery_aliases": delivery,
        "render_projections": render,
        "moderation": len(moderation_rows),
        "registry_rows": len(registry_rows),
        "row_writes": len(source_sql) + len(camera_sql) + len(export_sql) + len(moderation_sql) + len(registry_sql) + 2,
    }
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
