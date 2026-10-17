#!/usr/bin/env python3
"""Plan index-aware D1 write batches for every country except Ukraine and Poland.

Reads the verified local SQLite file and writes a report. It does not call
Cloudflare, does not write SQL, and does not insert a row.
"""
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "master-db/cache/d1-operational/camalert-operational.sqlite"
TARGET = ROOT / "master-db/reports/d1-remaining-batches.json"

# Measured on the Ukraine/Poland import: D1 rows_written was 22158.
# Row + TEXT primary-key index + each secondary index. INTEGER PRIMARY KEY
# does not add an index write. The partial published index is counted only
# when published = 1.
PUBLISHED_CAMERA_WRITES = 5
UNPUBLISHED_CAMERA_WRITES = 4
MODERATION_WRITES = 3
SOURCE_WRITES = 2
REGISTRY_WRITES = 2
FREE_DAILY_WRITES = 100_000
WRITTEN_ON_2026_10_17 = 22_183
REPLAY_WRITES = 0
NEXT_DAY_CAP = 90_000
FIRST_UTC_DAY = "2026-10-18"


def camera_writes(published):
    if published:
        return PUBLISHED_CAMERA_WRITES
    return UNPUBLISHED_CAMERA_WRITES + MODERATION_WRITES


def loaded_source_codes(conn):
    return {row[0] for row in conn.execute("""
        SELECT source_code FROM sources
        WHERE country_code IN ('UA','PL')
           OR source_code IN (
                SELECT DISTINCT j.value FROM cameras c, json_each(c.source_codes) j
                WHERE c.country_code IN ('UA','PL')
           )
    """)}


def plan(conn):
    totals = conn.execute("""
        SELECT COUNT(*), SUM(published=1), SUM(published=0),
               SUM(status='candidate'), SUM(status='review')
        FROM cameras
    """).fetchone()
    if totals != (123579, 114794, 8785, 2131, 6654):
        raise RuntimeError(f"local master counts are {totals}, expected the pinned snapshot")
    loaded = loaded_source_codes(conn)
    if len(loaded) != 6:
        raise RuntimeError(f"expected 6 Ukraine/Poland sources already in D1, found {len(loaded)}")
    remaining_sources = [row[0] for row in conn.execute(
        "SELECT source_code FROM sources WHERE source_code NOT IN ({}) ORDER BY source_code".format(
            ",".join("?" for _ in loaded)
        ),
        tuple(sorted(loaded)),
    )]
    archive_root = conn.execute("SELECT archive_root FROM storage_control WHERE id=1").fetchone()[0]
    registry_rows = conn.execute(
        "SELECT COUNT(*) FROM archive_registry WHERE root_key<>?",
        (archive_root,),
    ).fetchone()[0]
    grouped = {}
    for country, canonical_id, published, status in conn.execute("""
        SELECT country_code, canonical_id, published, status
        FROM cameras
        WHERE country_code NOT IN ('UA','PL')
        ORDER BY country_code, canonical_id
    """):
        grouped.setdefault(country, []).append((canonical_id, published, status))
    countries = []
    for country, rows in grouped.items():
        published = sum(item[1] == 1 for item in rows)
        unpublished = len(rows) - published
        countries.append({
            "country_code": country,
            "cameras": len(rows),
            "published": published,
            "unpublished": unpublished,
            "candidates": sum(item[2] == "candidate" for item in rows),
            "review": sum(item[2] == "review" for item in rows),
            "d1_writes": sum(camera_writes(item[1]) for item in rows),
            "rows": rows,
        })
    countries.sort(key=lambda item: (-item["d1_writes"], item["country_code"]))
    prefix = len(remaining_sources) * SOURCE_WRITES + registry_rows * REGISTRY_WRITES
    days = [new_day(1)]
    days[0]["writes"] = prefix
    days[0]["source_rows"] = len(remaining_sources)
    days[0]["source_writes"] = len(remaining_sources) * SOURCE_WRITES
    days[0]["registry_rows"] = registry_rows
    days[0]["registry_writes"] = registry_rows * REGISTRY_WRITES

    def add_part(day, country, taken):
        published = sum(item[1] == 1 for item in taken)
        unpublished = len(taken) - published
        writes = sum(camera_writes(item[1]) for item in taken)
        day["parts"].append({
            "country_code": country,
            "partial": len(taken) != len(grouped[country]),
            "cameras": len(taken),
            "published": published,
            "unpublished": unpublished,
            "candidates": sum(item[2] == "candidate" for item in taken),
            "review": sum(item[2] == "review" for item in taken),
            "d1_writes": writes,
            "first_canonical_id": taken[0][0],
            "last_canonical_id": taken[-1][0],
        })
        day["writes"] += writes
        day["cameras"] += len(taken)
        day["published"] += published
        day["unpublished"] += unpublished

    for country in countries:
        rows = country["rows"]
        whole = country["d1_writes"]
        if whole <= NEXT_DAY_CAP:
            day = next((item for item in days if item["writes"] + whole <= NEXT_DAY_CAP), None)
            if day is None:
                day = new_day(len(days) + 1)
                days.append(day)
            add_part(day, country["country_code"], rows)
            continue
        index = 0
        while index < len(rows):
            day = next((item for item in days if item["writes"] + camera_writes(rows[index][1]) <= NEXT_DAY_CAP), None)
            if day is None:
                day = new_day(len(days) + 1)
                days.append(day)
            taken = []
            running = day["writes"]
            while index < len(rows):
                cost = camera_writes(rows[index][1])
                if running + cost > NEXT_DAY_CAP:
                    break
                taken.append(rows[index])
                running += cost
                index += 1
            if not taken:
                raise RuntimeError(f"{country['country_code']} camera does not fit in an empty day")
            add_part(day, country["country_code"], taken)

    camera_total = sum(item["d1_writes"] for item in countries)
    expected = camera_total + prefix
    actual = sum(day["writes"] for day in days)
    if actual != expected:
        raise RuntimeError(f"batch writes {actual} do not add up to {expected}")
    placed = sum(day["cameras"] for day in days)
    if placed != sum(item["cameras"] for item in countries):
        raise RuntimeError("a remaining camera is missing from the batches or counted twice")
    for day in days:
        if day["writes"] > NEXT_DAY_CAP:
            raise RuntimeError(f"batch {day['batch']} costs {day['writes']}, above {NEXT_DAY_CAP}")
        for part in day["parts"]:
            count = conn.execute(
                "SELECT COUNT(*) FROM cameras WHERE country_code=? AND canonical_id>=? AND canonical_id<=?",
                (part["country_code"], part["first_canonical_id"], part["last_canonical_id"]),
            ).fetchone()[0]
            if count != part["cameras"]:
                raise RuntimeError(f"{part['country_code']} bounds do not match {part['cameras']} cameras")
    for country in countries:
        country.pop("rows")
    return {
        "generated_from": "master-db/cache/d1-operational/camalert-operational.sqlite",
        "executed": False,
        "cloud_import": "not_run",
        "conflict": "ON CONFLICT DO NOTHING",
        "replaces_existing_rows": False,
        "omitted_from_batches": ["storage_control", "import_runs", "camera_export_ids"],
        "pointer_note": "storage_control id=1 and import_runs already hold the Ukraine/Poland trial under the full master checksum. Country batches skip both tables. A later approved load has to update that pointer on purpose.",
        "write_model": {
            "published_camera": PUBLISHED_CAMERA_WRITES,
            "unpublished_camera": UNPUBLISHED_CAMERA_WRITES,
            "moderation": MODERATION_WRITES,
            "source": SOURCE_WRITES,
            "archive_registry": REGISTRY_WRITES,
            "calibration": "1329*5 + 1615*4 + 1397*3 + 1615*3 + 6*2 + 2 + 2 + 1 = 22158",
            "partial_index": "idx_cameras_published_country counts only when published=1",
            "integer_primary_key": "storage_control.id is the rowid and adds no index write; country batches do not write it",
        },
        "limits": {
            "free_daily_row_writes": FREE_DAILY_WRITES,
            "free_daily_reset": "00:00 UTC",
            "written_utc_2026_10_17": WRITTEN_ON_2026_10_17,
            "idempotent_replay_writes": REPLAY_WRITES,
            "hard_remaining_utc_2026_10_17": FREE_DAILY_WRITES - WRITTEN_ON_2026_10_17 - REPLAY_WRITES,
            "batch_cap": NEXT_DAY_CAP,
            "do_not_start_before": f"{FIRST_UTC_DAY}T00:00:00Z",
        },
        "remaining": {
            "countries": len(countries),
            "cameras": placed,
            "published": sum(item["published"] for item in countries),
            "unpublished": sum(item["unpublished"] for item in countries),
            "candidates": sum(item["candidates"] for item in countries),
            "review": sum(item["review"] for item in countries),
            "sources": len(remaining_sources),
            "archive_registry_rows": registry_rows,
            "export_id_rows": 0,
            "d1_writes": expected,
            "logical_inserts": placed + sum(item["unpublished"] for item in countries) + len(remaining_sources) + registry_rows,
        },
        "source_codes": remaining_sources,
        "countries": countries,
        "batches": [{key: value for key, value in day.items()} for day in days],
    }


def new_day(number):
    return {
        "batch": number,
        "earliest_utc_day": FIRST_UTC_DAY if number == 1 else None,
        "write_cap": NEXT_DAY_CAP,
        "writes": 0,
        "source_rows": 0,
        "source_writes": 0,
        "registry_rows": 0,
        "registry_writes": 0,
        "cameras": 0,
        "published": 0,
        "unpublished": 0,
        "parts": [],
        "executed": False,
    }


def assign_dates(report):
    start = (2026, 10, 18)
    for index, day in enumerate(report["batches"]):
        year, month, day_number = add_days(start, index)
        day["earliest_utc_day"] = f"{year:04d}-{month:02d}-{day_number:02d}"


def add_days(start, offset):
    import datetime
    value = datetime.date(*start) + datetime.timedelta(days=offset)
    return value.year, value.month, value.day


def main():
    conn = sqlite3.connect(SOURCE)
    try:
        report = plan(conn)
    finally:
        conn.close()
    assign_dates(report)
    TARGET.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({
        "batches": len(report["batches"]),
        "d1_writes": report["remaining"]["d1_writes"],
        "logical_inserts": report["remaining"]["logical_inserts"],
        "cameras": report["remaining"]["cameras"],
        "days": [
            {"batch": day["batch"], "day": day["earliest_utc_day"], "writes": day["writes"], "cameras": day["cameras"], "countries": len(day["parts"])}
            for day in report["batches"]
        ],
    }, indent=2))


if __name__ == "__main__":
    main()
