#!/usr/bin/env python3
"""Compare the operational camera database with the cached public R2 delivery.

Reads the local SQLite mirror and the already published country files. It does
not upload anything and does not replace the live R2 objects.
"""
import json, sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATABASE = ROOT / 'master-db/cache/d1-operational/camalert-operational.sqlite'
MANIFEST = ROOT / 'master-db/cache/r2-migration/manifest.json'
OBJECTS = ROOT / 'master-db/cache/r2-migration/objects'
GROUPS = ('cameras', 'speed_cameras', 'red_light_cameras', 'checkpoints', 'average_speed_sections')

def ids_of(payload):
    found = []
    for group in GROUPS:
        for point in payload.get(group) or []:
            found.append((group, str(point.get('id'))))
    return found

def main():
    manifest = json.loads(MANIFEST.read_text())
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    mismatches = []
    polish_sites = None
    for entry in manifest['countries']:
        code = entry['country_code']
        payload = json.loads((OBJECTS / entry['path']).read_text())
        published = {row['canonical_id'] for row in conn.execute('SELECT canonical_id FROM cameras WHERE country_code=? AND published=1', (code,))}
        file_ids = {item[1] for item in ids_of(payload)}
        if code in ('UA', 'PL'):
            stored = {row['export_id'] for row in conn.execute("SELECT export_id FROM camera_export_ids WHERE country_code=? AND role='delivery'", (code,))}
            covered = {row['canonical_id'] for row in conn.execute("SELECT canonical_id FROM camera_export_ids WHERE country_code=? AND role='delivery'", (code,))}
            if file_ids != stored or covered != published:
                mismatches.append({'country_code': code, 'file': len(file_ids), 'stored': len(stored), 'covered': len(covered), 'published': len(published)})
        elif file_ids != published:
            mismatches.append({'country_code': code, 'file': len(file_ids), 'published': len(published)})
        if len(file_ids) != entry['record_count']:
            mismatches.append({'country_code': code, 'file_ids': len(file_ids), 'manifest': entry['record_count']})
        if code == 'PL':
            sites = payload.get('red_light_sites') or []
            stored_sites = {row['export_id'] for row in conn.execute("SELECT export_id FROM camera_export_ids WHERE country_code='PL' AND role='render_projection'")}
            polish_sites = {'file': len(sites), 'stored': len(stored_sites), 'same_ids': {str(point.get('id')) for point in sites} == stored_sites}
            if polish_sites['file'] != 68 or not polish_sites['same_ids']:
                mismatches.append({'country_code': 'PL', 'red_light_sites': polish_sites})
    report = {
        'manifest_sha_matches_pinned': manifest.get('generated_at') == '2026-10-13T15:35:26.807485+00:00',
        'manifest_records': manifest['total_records'],
        'countries': len(manifest['countries']),
        'database_published': conn.execute('SELECT SUM(published) FROM cameras').fetchone()[0],
        'polish_red_light_sites': polish_sites,
        'mismatches': mismatches,
        'live_r2_replaced': False,
        'result': 'passed' if not mismatches and polish_sites and polish_sites['file'] == 68 else 'failed',
    }
    destination = ROOT / 'master-db/reports/d1-r2-delivery-compare.json'
    destination.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    if report['result'] != 'passed':
        raise SystemExit(1)

if __name__ == '__main__':
    main()
