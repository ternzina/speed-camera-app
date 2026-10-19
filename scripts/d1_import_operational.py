#!/usr/bin/env python3
"""Import the pinned local master into a local D1-compatible SQLite file.

No remote D1 database is created and no Supabase or R2 request is made.
"""
import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import d1_operational as d1

def main():
    report=d1.import_operational(d1.ROOT,d1.DEFAULT_DATABASE,d1.PINNED_MASTER_KEY,d1.PUBLIC_MANIFEST,d1.PINNED)
    size=d1.database_size(d1.DEFAULT_DATABASE)
    report.update(size)
    limit=500*1024*1024
    # storage_control and import_runs add one row each on a fresh load.
    writes=report['cameras']+report['sources']+report['unpublished']+report['delivery_aliases']+report['render_projections']+report['registry_rows']+2
    report['free_d1']={'max_database_bytes':limit,'fits_database_size':report['database_bytes']<=limit,'daily_row_writes':100000,'import_row_writes':writes,'fits_one_free_write_day':writes<=100000,'rows_written_this_run':report['row_changes'],'note':'import_row_writes is the fresh load. rows_written_this_run is this execution and is 0 on a repeat.'}
    report['scope']={'pinned_cameras':123579,'published':114794,'unpublished':8785,'excluded_prepared_points':443,'supabase_rows_downloaded':0,'remote_d1_created':False,'r2_write':False,'worker_changed':False,'fallback_left_enabled':True}
    target=d1.ROOT/'master-db/reports/d1-local-import.json'
    target.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()
