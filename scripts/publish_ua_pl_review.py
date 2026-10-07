#!/usr/bin/env python3
"""Publish a guarded UA/PL review batch after verified private R2 archival."""
import json,datetime,subprocess,collections,copy
from pathlib import Path
from psycopg.types.json import Jsonb
from update_cameras import connect
from cold_storage_pipeline import control,master,compact
from r2_archive import dataset,archive_files,put,encode,read_dataset
from source_identity import source_identity,verified_aliases
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'master-db/cache/ua-pl';REPORT=ROOT/'master-db/ua-pl'
def fingerprint(conn,exclude=()):
 return conn.execute("select count(*),md5(string_agg(md5(row_to_json(r)::text),'' order by id)) from public.camera_records r where not (canonical_id=any(%s))",(list(exclude),)).fetchone()
def main():
 plan=json.loads((BASE/'promotion-plan.json').read_text());promote=plan['promotions'];dupes=plan['duplicates'];old=master();expected=control();prior=json.loads((ROOT/'master-db/backups/ua-pl/master-before.json').read_text());assert old==prior,'Review baseline changed; prepare again'
 byid={r['canonical_id']:r for r in old};target=dict(byid);ids=[r['canonical_id'] for r in promote];assert not set(ids)&set(dupes)
 with connect() as c:
  before=fingerprint(c);size_before=c.execute('select pg_database_size(current_database())').fetchone()[0]
  assert c.execute("select count(*) from public.camera_records where canonical_id=any(%s)",(ids,)).fetchone()[0]==0
  published_ids={x[0] for x in c.execute('select canonical_id from public.camera_records')}
 for r in promote:
  assert r['country_code'] in ('UA','PL') and r['confidence']=='HIGH' and r['status']=='active' and r['publication_review']=='ua_pl_official_v1'
  if r['canonical_id'] in byid:assert r['canonical_id'] not in published_ids
  target[r['canonical_id']]=r
 alias_path=ROOT/'master-db/coverage/verified-source-aliases.json';aliases=json.loads(alias_path.read_text());aliases_before=copy.deepcopy(aliases)
 for cid,destination in dupes.items():
  row=byid[cid];assert row['country_code'] in ('UA','PL') and cid not in published_ids and destination in target
  for s in row['camera_sources']:
   aliases['aliases'].append({'source_identity':list(source_identity(s)),'source_record_id':cid,'canonical_id':destination,'target_source_identity':list(source_identity(target[destination]['camera_sources'][0])),'evidence':'Current official device location code and compatible GPS/type/speed; or exact NPU point plus current primary OSM counterpart'})
  del target[cid]
 assert all(target.get(cid)==r for cid,r in byid.items() if r['country_code'] not in ('UA','PL') or cid in published_ids),'Protected master changed'
 observation_rows=[]
 for d in plan['decisions']:
  observation_rows.append({**byid[d['canonical_id']],'review_decision':d})
 for path in (ROOT/'master-db/raw/ua-pl/device-details').glob('*.json'):observation_rows.append({'country_code':'PL','source':'CANARD current primary','raw_payload':json.loads(path.read_text())})
 for path in (ROOT/'master-db/raw/ua-pl/opp-details').glob('*.json'):observation_rows.append({'country_code':'PL','source':'CANARD current primary OPP','raw_payload':json.loads(path.read_text())})
 files=archive_files([p for directory in (ROOT/'master-db/raw/ua-pl',ROOT/'master-db/backups/ua-pl') for p in directory.rglob('*') if p.is_file()])
 obs,_=dataset('ua-pl-review-observations',observation_rows);norm,pointers=dataset('normalized-master-v2',sorted(target.values(),key=lambda r:r['canonical_id']));cand,_=dataset('ua-pl-review-candidates',[r for r in target.values() if r['country_code'] in ('UA','PL') and r['canonical_id'] not in published_ids and r['canonical_id'] not in ids])
 backup,_=dataset('ua-pl-rollback-review-state',[{'old_master':expected,'published_fingerprint':list(before),'promoted_ids':ids,'aliases_before':aliases_before,'rollback':'Remove only exact checksum-matched new operational IDs; restore old master pointer and previous public manifest; retain every R2 archive.'}])
 catalog={s['source_code']:{k:s.get(k) for k in ('source_code','source_name','source_type','source_url','license','license_url')}|{'country_code':r['country_code']} for r in promote for s in r['camera_sources']}
 receipt={'version':2,'scope':['UA','PL'],'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'observations':obs['manifest_ref'],'observation_count':obs['record_count'],'candidates':cand['manifest_ref'],'candidate_count':cand['record_count'],'normalized_master':norm['manifest_ref'],'files':files['manifest_ref'],'rollback':backup['manifest_ref'],'verified_readback':True,'source_catalog':list(catalog.values()),'promoted_ids':ids,'retired_verified_duplicates':len(dupes),'previous_master':expected}
 ref=put(encode(receipt),'manifests');assert len(list(read_dataset(norm['manifest_ref'])))==len(target)
 with connect() as c:
  assert fingerprint(c)==before,'Operational state changed before publication'
  c.execute('select camera_bootstrap_private.register_archive(%s)',(Jsonb({'root':ref,'expected_manifest':expected,**receipt}),))
  batch=[compact(r,pointers[r['canonical_id']]) for r in promote]
  result=c.execute('select camera_bootstrap_private.ingest_batch(%s)',(Jsonb(batch),)).fetchone()[0];assert result['applied']==len(promote)
  assert fingerprint(c,ids)==before,'Existing operational rows changed'
  c.execute('select camera_bootstrap_private.advance_archive(%s)',(norm['manifest_ref']['key'],))
 alias_path.write_bytes(encode(aliases));verified_aliases(list(target.values()))
 report={'receipt':ref,'normalized_master':norm['manifest_ref'],'database_bytes_before':size_before,'new_published':dict(collections.Counter(r['country_code'] for r in promote)),'existing_operational_rows_preserved':before[0],'retired_verified_duplicate_candidates':len(dupes),'observations_r2':obs['record_count'],'pending_delivery':True};(REPORT/'publication.json').write_bytes(encode(report));print(report,flush=True)
 subprocess.run([str(ROOT/'.bootstrap-venv/bin/python'),str(ROOT/'scripts/export_r2_cameras.py')],check=True,cwd=ROOT)
 subprocess.run(['node',str(ROOT/'scripts/publish_r2_exports.cjs')],check=True,cwd=ROOT)
 build=json.loads((ROOT/'master-db/reports/r2-export-build.json').read_text())
 with connect() as c:
  assert c.execute('select camera_bootstrap_private.complete_delivery(%s)',(build['database_fingerprint'],)).fetchone()[0]
  assert fingerprint(c,ids)==before
  report['database_bytes_after']=c.execute('select pg_database_size(current_database())').fetchone()[0]
 report['pending_delivery']=False;(REPORT/'publication.json').write_bytes(encode(report));print('Completed UA/PL publication',report,flush=True)
if __name__=='__main__':main()
