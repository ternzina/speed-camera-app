#!/usr/bin/env python3
"""Check publication source has not changed since the export snapshot. No writes."""
import json
from pathlib import Path
from update_cameras import connect
ROOT=Path(__file__).resolve().parents[1]
def main():
    build=json.loads((ROOT/'master-db/reports/r2-export-build.json').read_text())
    with connect() as c:
        rows,published,fingerprint=c.execute("select count(*),count(*) filter(where active and confidence in ('high','medium')),md5(string_agg(md5(row_to_json(r)::text),'' order by id)) from public.camera_records r").fetchone()
        counts={x[0]:x[1] for x in c.execute('select country_code,total from public.camera_country_coverage')}
    assert fingerprint==build['database_fingerprint'],'Database changed during export; rebuild before publishing'
    assert published==build['published_records']
    assert counts=={x['country_code']:x['r2_records'] for x in build['country_checks']}
    print(json.dumps({'rows':rows,'published':published,'fingerprint':fingerprint,'countries':len(counts),'result':'passed'}))
if __name__=='__main__':main()
