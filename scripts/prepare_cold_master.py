#!/usr/bin/env python3
"""Prepare normalized master, candidates, raw/history archive and rollback assets."""
import json,gzip
from r2_archive import ROOT,encode,dataset,read_dataset,archive_files,put
SNAP=ROOT/'master-db/backups/storage-architecture/snapshot.json'
def normalized_master(state,rows):
 catalog={r['id']:r for r in read_dataset(state['tables']['public.camera_sources']['manifest_ref'])}
 links={};fallbacks=0
 for x in read_dataset(state['tables']['public.camera_source_links']['manifest_ref']):
  source=x['raw_payload'].get('_source',{})
  if not source.get('source_code') or not source.get('source_id'):
   c=catalog[x['source_id']];fallbacks+=1
   source={'source_code':c['code'],'source_id':x['external_id'],'source_name':c['name'],'source_type':c['source_type'],'source_url':c['homepage_url'],'license':c['license_notes'],'license_url':c['homepage_url'],'retrieved_at':x.get('last_seen_at') or x['created_at'],'source_updated_at':x.get('source_updated_at'),'source_status':x.get('source_status'),'latitude':x.get('observed_latitude'),'longitude':x.get('observed_longitude'),'end_latitude':x.get('observed_end_latitude'),'end_longitude':x.get('observed_end_longitude'),'speed_limit':x.get('observed_speed_limit'),'direction_raw':x.get('observed_direction')}
  source={**source,'raw_payload':{k:v for k,v in x['raw_payload'].items() if k!='_source'}}
  links.setdefault(x['camera_record_id'],[]).append(source)
 baseline=json.loads(gzip.decompress((ROOT/'master-db/backups/expansion/normalized-50141.json.gz').read_bytes()))
 old={r['canonical_id']:r for r in baseline};master=[]
 for row in rows:
  r=old.get(row['canonical_id']) or {**row['metadata'],'camera_sources':row['metadata'].get('provenance',[])}
  r={**r,'camera_sources':links.get(row['id'],r.get('camera_sources',[]))}
  assert r.get('canonical_id')==row['canonical_id'] and abs(r.get('latitude',999)-row['latitude'])<1e-9 and abs(r.get('longitude',999)-row['longitude'])<1e-9,'Normalized model differs from operational coordinates'
  master.append(r)
 from update_cameras import validate
 validate(master)
 print('Normalized legacy source links hydrated',fallbacks,flush=True)
 return master
def main():
 state=json.loads(SNAP.read_text());assert state.get('restoration_proof')
 rows=list(read_dataset(state['tables']['public.camera_records']['manifest_ref']))
 master=normalized_master(state,rows)
 normalized,pointers=dataset('normalized-master-v2',master)
 candidates,_=dataset('candidate-records-v2',[r for r,row in zip(master,rows) if not(row['active'] and row['confidence'] in ('high','medium'))])
 schema=archive_files([ROOT/'master-db/backups/storage-architecture/schema.json',ROOT/'master-db/backups/storage-architecture/access.json'])
 paths=list((ROOT/'master-db/raw').rglob('*'))
 for directory in ['master-db/cache/bootstrap/osm','master-db/cache/bootstrap/normalized','master-db/cache/bootstrap/earlier-normalized','master-db/cache/expansion/osm','master-db/cache/expansion/primary','master-db/cache/expansion/current-relations','master-db/cache/expansion/parent-memberships','master-db/cache/osm-api','master-db/backups/expansion','master-db/backups/bootstrap','master-db/backups/source-refresh','master-db/backups/r2-migration','master-db/backups/import-snapshots','master-db/backups/pre-bootstrap-20261007','master-db/backups/server-20261005-175609']:
  paths.extend((ROOT/directory).rglob('*'))
 paths=[p for p in paths if p.is_file() and p.suffix in ('.json','.gz','.csv','.geojson','.xml','.zip','.txt') and not any(x in p.name.lower() for x in ['credential','token','secret','.env'])]
 files=archive_files(paths)
 result={'snapshot_root':state['root_ref'],'normalized_master':normalized['manifest_ref'],'canonical_snapshot':state['tables']['public.camera_records']['manifest_ref'],'candidates':candidates['manifest_ref'],'local_files':files['manifest_ref'],'schema':schema['manifest_ref'],'counts':{'canonical':len(master),'candidates':candidates['record_count'],'observations':state['tables']['public.camera_source_links']['record_count'],'local_files':len(paths)},'restore_proof':state['restoration_proof']}
 result['root_ref']=put(encode(result),'manifests')
 target=ROOT/'master-db/backups/storage-architecture/prepared.json';target.write_bytes(encode(result))
 (ROOT/'master-db/backups/storage-architecture/canonical-pointers.json').write_bytes(encode(pointers))
 print('Cold master ready',result['counts'],flush=True)
if __name__=='__main__':main()
