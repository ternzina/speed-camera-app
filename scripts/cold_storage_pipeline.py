#!/usr/bin/env python3
"""R2-first source ingestion. Existing canonical rows are never overwritten."""
import datetime,json,subprocess
from psycopg.types.json import Jsonb
from r2_archive import ROOT,encode,dataset,read_dataset,archive_files,put
from update_cameras import connect
from source_identity import source_identity,verified_aliases

def control():
 with connect() as conn:return conn.execute('select normalized_manifest from camera_bootstrap_private.storage_control where id=1').fetchone()[0]
def master():return list(read_dataset(control()))
def enabled():
 with connect() as conn:return conn.execute("select to_regclass('camera_bootstrap_private.storage_control') is not null").fetchone()[0]
def published(r):return r.get('status') in ('active','missing_source') and str(r.get('confidence','')).lower() in ('high','medium') and (r['country_code'] not in ('UA','PL') or r.get('publication_review')=='ua_pl_official_v1')
def compact(r,key):
 sources=r.get('camera_sources',[])
 result={k:r.get(k) for k in ['canonical_id','country_code','camera_type','latitude','longitude','end_latitude','end_longitude','speed_limit','direction','direction_raw','road_ref','road_name','city','region','confidence','status','first_seen_at','last_seen_at','updated_at']}|{'archive_ref':key,'source_codes':sorted({s['source_code'] for s in sources}),'source_count':len(sources)}
 if r.get('publication_review')=='ua_pl_official_v1':
  assert r['country_code'] in ('UA','PL')
  result['publication_review']=r['publication_review']
  result['delivery']={k:v for k,v in {'id':r['canonical_id'],'type':'speed_camera' if r['camera_type']=='fixed_speed' else r['camera_type'],'camera_type':r['camera_type'],'latitude':r['latitude'],'longitude':r['longitude'],'speed_limit':r.get('speed_limit'),'direction':r.get('direction'),'location':r.get('road_name') or r.get('city'),'road':r.get('road_ref'),'road_index':r.get('road_ref'),'region':r.get('region')}.items() if v is not None}
 return result
def sync(records,append_only=True,observations=None,raw_paths=None):
 # Every observation (including duplicates/rejections) reaches immutable cold
 # history before operational data is touched. Candidates remain only in R2.
 expected=control();old=list(read_dataset(expected));byid={r['canonical_id']:r for r in old}
 existing_identity={source_identity(s) for r in old for s in r.get('camera_sources',[])}
 existing_identity.update(verified_aliases(old))
 new=[r for r in records if r['canonical_id'] not in byid]
 assert len(new)==len({r['canonical_id'] for r in new}),'Duplicate canonical identity'
 for r in new:
  assert not(existing_identity & {source_identity(s) for s in r.get('camera_sources',[])})
  existing_identity.update(source_identity(s) for s in r.get('camera_sources',[]))
  byid[r['canonical_id']]=r
 observations=observations if observations is not None else records
 catalog={}
 for r in observations:
  for source in r.get('camera_sources',[]):catalog[source['source_code']]={k:source.get(k) for k in ['source_code','source_name','source_type','source_url','license','license_url']}|{'country_code':r['country_code']}
 obs,_=dataset('source-observations',observations)
 cand,_=dataset('candidates',[r for r in new if not published(r)])
 norm,pointers=dataset('normalized-master-v2',sorted(byid.values(),key=lambda r:r['canonical_id']))
 files=archive_files(raw_paths or [])
 receipt={'version':2,'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'observations':obs['manifest_ref'],'observation_count':obs['record_count'],'candidates':cand['manifest_ref'],'candidate_count':cand['record_count'],'normalized_master':norm['manifest_ref'],'files':files['manifest_ref'],'verified_readback':True,'source_catalog':list(catalog.values())}
 ref=put(encode(receipt),'manifests')
 batch=[compact(r,pointers[r['canonical_id']]) for r in new if published(r)]
 with connect() as conn:
  # Lock protects pointer publication, preventing concurrent master lost updates.
  conn.execute('select camera_bootstrap_private.register_archive(%s)',(Jsonb({'root':ref,'expected_manifest':expected,**receipt}),))
  for offset in range(0,len(batch),250):conn.execute('select camera_bootstrap_private.ingest_batch(%s)',(Jsonb(batch[offset:offset+250]),))
  conn.execute('select camera_bootstrap_private.advance_archive(%s)',(norm['manifest_ref']['key'],))
 report={'new_published':len(batch),'new_candidates_r2_only':len(new)-len(batch),'observations_r2':obs['record_count'],'canonical_master':len(byid),'receipt':ref,'future_observation_rows_postgres':0}
 (ROOT/'master-db/storage/reports/latest-import.json').write_bytes(encode(report));print(report,flush=True)
 with connect() as conn:delivery_pending=conn.execute('select delivery_pending from camera_bootstrap_private.storage_control where id=1').fetchone()[0]
 if delivery_pending:
  # Canonical commit survives a delivery outage; publication can be retried safely.
  subprocess.run([str(ROOT/'.bootstrap-venv/bin/python'),str(ROOT/'scripts/export_r2_cameras.py')],cwd=ROOT,check=True)
  subprocess.run(['node',str(ROOT/'scripts/publish_r2_exports.cjs')],cwd=ROOT,check=True)
  fingerprint=json.loads((ROOT/'master-db/reports/r2-export-build.json').read_text())['database_fingerprint']
  with connect() as conn:assert conn.execute('select camera_bootstrap_private.complete_delivery(%s)',(fingerprint,)).fetchone()[0],'Canonical data changed; delivery remains pending for retry'
 return report
