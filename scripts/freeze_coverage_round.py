#!/usr/bin/env python3
"""Freeze only a completed, verified R2 import and its live operational counts."""
import argparse,datetime,json
from pathlib import Path
from cold_storage_pipeline import control
from r2_archive import get,read_dataset,encode
from update_cameras import connect
ROOT=Path(__file__).resolve().parents[1]
def main():
 p=argparse.ArgumentParser();p.add_argument('round',type=int);a=p.parse_args();directory=ROOT/'master-db/coverage';target=directory/f'round{a.round}.json'
 if target.exists():raise RuntimeError('Round already frozen; preserve its historical receipt')
 report=json.loads((ROOT/'master-db/storage/reports/latest-import.json').read_text());ref=report['receipt'];receipt=json.loads(get(ref['key'],refresh=True))
 assert receipt['verified_readback'] and control()==receipt['normalized_master']['key'],'Import not current'
 for old in directory.glob('round*.json'):
  assert json.loads(old.read_text())['receipt']['key']!=ref['key'],'Import already recorded'
 assert sum(1 for _ in read_dataset(receipt['observations']))==report['observations_r2']
 assert sum(1 for _ in read_dataset(receipt['normalized_master']))==report['canonical_master']
 with connect() as conn:
  counts=dict(conn.execute('select country_code,count(*) from public.camera_records where active and confidence in (\'high\',\'medium\') group by 1'))
  assert conn.execute('select delivery_pending from camera_bootstrap_private.storage_control where id=1').fetchone()[0] is False,'Delivery not completed'
  size=conn.execute('select pg_database_size(current_database())').fetchone()[0]
 report.update(database_bytes=size,published=sum(counts.values()),country_counts=counts,measured_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
 target.write_bytes(encode(report));print({k:v for k,v in report.items() if k!='country_counts'})
if __name__=='__main__':main()
