#!/usr/bin/env python3
"""Prepare a verified, reversible correction of this stage's additions only.

Does not mutate PostgreSQL. The reviewed administrative transaction is applied
separately after the archive, typed restore proof and preservation checks pass.
"""
import datetime,json,sys,xml.etree.ElementTree as ET
from pathlib import Path
from psycopg.types.json import Jsonb
from cold_storage_pipeline import control,master,published
from update_cameras import connect
from bootstrap_cameras import dist
from public_download import get as public_get
from source_identity import source_identity
from r2_archive import dataset,read_dataset,archive_files,encode,put,get
ROOT=Path(__file__).resolve().parents[1]

def render_admin_sql(plan):
 """One atomic, guarded transaction; no cascading deletes or baseline updates."""
 literal=encode(plan).decode().replace("'","''")
 return """DO $coverage_correction$
DECLARE p jsonb := '"""+literal+"""'::jsonb; wanted text[]; n bigint; h text;
BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') THEN RAISE EXCEPTION 'Administrative correction required'; END IF;
 wanted:=ARRAY(SELECT jsonb_array_elements_text(p->'withdraw_ids'));
 PERFORM 1 FROM camera_bootstrap_private.storage_control WHERE id=1 FOR UPDATE;
 IF (SELECT normalized_manifest FROM camera_bootstrap_private.storage_control WHERE id=1) IS DISTINCT FROM p->>'expected_manifest' THEN RAISE EXCEPTION 'Master changed; do not replay correction'; END IF;
 SELECT count(*),md5(string_agg(md5(row_to_json(r)::text),'' ORDER BY canonical_id)) INTO n,h FROM public.camera_records r WHERE canonical_id=ANY(wanted);
 IF n<>jsonb_array_length(p->'withdraw_ids') OR h IS DISTINCT FROM p->>'withdraw_rows_hash' THEN RAISE EXCEPTION 'Correction rows changed'; END IF;
 SELECT md5(string_agg(md5(row_to_json(r)::text),'' ORDER BY id)) INTO h FROM public.camera_records r WHERE NOT(canonical_id=ANY(wanted));
 IF h IS DISTINCT FROM p->>'preserved_operational_hash' THEN RAISE EXCEPTION 'Other operational records changed'; END IF;
 PERFORM camera_bootstrap_private.register_archive(p);
 DELETE FROM public.camera_records WHERE canonical_id=ANY(wanted);
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>jsonb_array_length(p->'withdraw_ids') THEN RAISE EXCEPTION 'Unexpected correction count'; END IF;
 PERFORM camera_bootstrap_private.advance_archive(p#>>'{normalized_master,key}');
 UPDATE camera_bootstrap_private.storage_control SET delivery_pending=true WHERE id=1;
 SELECT count(*) INTO n FROM public.camera_records WHERE active AND confidence IN ('high','medium');
 IF n<>(p->>'published_after_expected')::bigint THEN RAISE EXCEPTION 'Unexpected published count'; END IF;
 SELECT md5(string_agg(md5(row_to_json(r)::text),'' ORDER BY id)) INTO h FROM public.camera_records r;
 IF h IS DISTINCT FROM p->>'preserved_operational_hash' THEN RAISE EXCEPTION 'Protected operational data changed'; END IF;
END $coverage_correction$;"""

def prepare_sql():
 cache=ROOT/'master-db/cache/coverage-stage';path=cache/'prepared-proximity-correction.json';plan=json.loads(path.read_text())
 assert control()==plan['expected_manifest'],'Already applied or another import advanced the master'
 assert json.loads(get(plan['root']['key'],refresh=True))['normalized_master']==plan['normalized_master']
 with connect() as conn:
  plan['preserved_operational_hash']=conn.execute("select md5(string_agg(md5(row_to_json(r)::text),'' order by id)) from public.camera_records r where not(canonical_id=any(%s))",(plan['withdraw_ids'],)).fetchone()[0]
  plan['preserved_operational_count']=conn.execute('select count(*) from public.camera_records where not(canonical_id=any(%s))',(plan['withdraw_ids'],)).fetchone()[0]
 assert plan['preserved_operational_count']==plan['published_after_expected']
 rollback=put(encode({k:plan[k] for k in ('root','expected_manifest','correction','rollback','preserved_operational_hash','preserved_operational_count')}),'manifests')
 assert json.loads(get(rollback['key'],refresh=True))['correction']==plan['correction']
 plan['rollback_plan_archive']=rollback;path.write_bytes(encode(plan));(cache/'apply-proximity-correction.sql').write_text(render_admin_sql(plan))
 print({'prepared_transaction':True,'preserved_rows':plan['preserved_operational_count'],'rollback_plan_archive':rollback},flush=True)
def main(remaining=False):
 cache=ROOT/'master-db/cache/coverage-stage';reportdir=ROOT/'master-db/coverage'
 expected=control();rows=master();byid={r['canonical_id']:r for r in rows}
 baseline=json.loads((reportdir/'baseline.json').read_text());original=list(read_dataset(baseline['master_manifest']));protected={r['canonical_id'] for r in original}
 assert all(byid.get(r['canonical_id'])==r for r in original)
 if remaining:
  proximity=json.loads((cache/'remaining-proximity-findings.json').read_text());held=set()
  def trust(r):
   source_rank=min({'official_government':0,'licensed_open_data':1,'openstreetmap':2}.get(s.get('source_type'),3) for s in r['camera_sources'])
   return ({'HIGH':0,'MEDIUM':1,'LOW':2}.get(r['confidence'],3),source_rank,r['canonical_id'])
  for pair in proximity:
   a,b=byid[pair['source_id']],byid[pair['nearby_id']]
   held.add(a['canonical_id'] if b['canonical_id'] in protected else max((a,b),key=trust)['canonical_id'])
 else:
  proximity=json.loads((cache/'cross-source-proximity-audit.json').read_text());held={r['source_id'] for r in proximity}
 assert held and not(held & protected)
 checks=[] if remaining else json.loads((reportdir/'ireland-candidate-dedupe-check.json').read_text())['checks'];retired={r['canonical_id'] for r in checks}
 assert (not retired if remaining else len(retired)==9 and retired<=held)
 node_ids=[int(next(s['source_id'].split('/')[1] for s in byid[r['nearest_other_id']]['camera_sources'] if s['source_type']=='openstreetmap')) for r in checks]
 url='https://api.openstreetmap.org/api/0.6/nodes?nodes='+','.join(map(str,sorted(node_ids)))
 if not remaining:
  response=public_get(url,timeout=(15,60));response.raise_for_status();payload=response.content
  folder=ROOT/'master-db/raw/coverage-stage/verified-ireland-aliases';folder.mkdir(parents=True,exist_ok=True)
  xmlpath=folder/'current-primary-nodes.xml';xmlpath.write_bytes(payload)
  nodes={int(e.get('id')):e for e in ET.fromstring(payload).findall('node')};assert set(nodes)==set(node_ids)
 else:nodes={}
 aliases=[]
 for check,node_id in zip(checks,node_ids):
  r=byid[check['canonical_id']];target=byid[check['nearest_other_id']];node=nodes[node_id]
  assert target['canonical_id'] in protected and target['camera_type']==r['camera_type']=='fixed_speed'
  assert dict((t.get('k'),t.get('v')) for t in node.findall('tag')).get('highway')=='speed_camera'
  point={'latitude':float(node.get('lat')),'longitude':float(node.get('lon'))}
  assert dist(point,target)<1 and dist(point,r)<=25
  aliases.append({'source_identity':list(source_identity(r['camera_sources'][0])),'canonical_id':target['canonical_id'],
   'target_source_identity':['OpenStreetMap','node/'+str(node_id)],'source_record_id':r['canonical_id'],
   'distance_m':round(dist(point,r),3),'evidence':'Official Garda static GPS, corresponding current primary speed-camera node and existing protected canonical device; no directional approach inferred'})
 if not remaining:
  metadata=folder/'source-metadata.json';metadata.write_bytes(encode({'source_url':url,'license':'ODbL-1.0','license_url':'https://www.openstreetmap.org/copyright','retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'records':9,'aliases':aliases}))
 proof=archive_files([cache/'remaining-proximity-findings.json',reportdir/'proximity-publication-audit.json']) if remaining else archive_files([xmlpath,metadata])
 with connect() as conn:
  pgrows=[r[0] for r in conn.execute('select to_jsonb(r) from public.camera_records r where canonical_id=any(%s) order by canonical_id',(sorted(held),))]
  assert len(pgrows)==len(held) and all(r['active'] and r['confidence'] in ('high','medium') for r in pgrows)
  typed=conn.execute('select count(*),md5(string_agg(md5(row_to_json(r)::text),\'\' order by canonical_id)) from jsonb_populate_recordset(null::public.camera_records,%s) r',(Jsonb(pgrows),)).fetchone()
  live=conn.execute('select count(*),md5(string_agg(md5(row_to_json(r)::text),\'\' order by canonical_id)) from public.camera_records r where canonical_id=any(%s)',(sorted(held),)).fetchone()
  assert typed==live,'Typed restoration differs from live records'
  published_before=conn.execute("select count(*) from public.camera_records where active and confidence in ('high','medium')").fetchone()[0]
 backup,_=dataset('coverage-proximity-operational-rollback',pgrows)
 assert list(read_dataset(backup['manifest_ref'],refresh=True))==pgrows
 repaired=[];observations=[];candidates=[]
 for r in rows:
  if r['canonical_id'] not in held:repaired.append(r);continue
  observation={**r,'_import_disposition':'duplicate_geometry' if r['canonical_id'] in retired else 'retrospective_review'}
  observations.append(observation)
  if r['canonical_id'] in retired:continue
  nearby=sorted({x['nearby_id'] if x['source_id']==r['canonical_id'] else x['source_id'] for x in proximity if r['canonical_id'] in (x['source_id'],x['nearby_id'])})
  review={**r,'confidence':'LOW','status':'review','review_reason':'Nearby cross-source camera identity unresolved; distinct physical device not verified','nearby_review_ids':nearby}
  candidates.append(review);repaired.append(review)
 repaired_byid={r['canonical_id']:r for r in repaired}
 assert all(repaired_byid.get(r['canonical_id'])==r for r in original)
 assert all(repaired_byid.get(r['canonical_id'])==r for r in rows if r['canonical_id'] not in held)
 norm,_=dataset('normalized-master-v2',sorted(repaired,key=lambda r:r['canonical_id']))
 obs,_=dataset('coverage-proximity-correction-observations',observations)
 cand,_=dataset('coverage-proximity-review-candidates',candidates)
 receipt={'version':2,'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'observations':obs['manifest_ref'],'observation_count':len(observations),
  'candidates':cand['manifest_ref'],'candidate_count':len(candidates),'normalized_master':norm['manifest_ref'],'files':proof['manifest_ref'],'verified_readback':True,'source_catalog':[],
  'correction':{'protected_baseline':len(original),'published_withdrawn':len(held),'review_candidates':len(candidates),'retired_verified_aliases':len(retired),
                'operational_rollback':backup['manifest_ref'],'previous_master':expected,'previous_import_receipt':json.loads((ROOT/'master-db/storage/reports/latest-import.json').read_text())['receipt'],
                'typed_restore_count':typed[0],'typed_restore_hash':typed[1]}}
 root=put(encode(receipt),'manifests');assert json.loads(get(root['key'],refresh=True))==receipt
 aliasdoc={'version':1,'verification_archive':proof['manifest_ref'],'license':'ODbL-1.0 primary validation and Irish PSI official source evidence','aliases':aliases}
 if not remaining:(cache/'prepared-verified-source-aliases.json').write_bytes(encode(aliasdoc))
 plan={'expected_manifest':expected,'root':root,**receipt,'withdraw_ids':sorted(held),'withdraw_rows_hash':live[1],'canonical_master':len(repaired),
       'published_after_expected':published_before-len(held),
       'rollback':'Restore exact typed PostgreSQL rows from operational_rollback only after checksum/count verification; restore previous_master pointer and previous production manifest. Remove only this correction\'s curated aliases if reverting. Full pre-correction master remains immutable in private R2.'}
 (cache/'prepared-proximity-correction.json').write_bytes(encode(plan))
 print({k:plan[k] for k in ('root','canonical_master','published_after_expected','correction')},flush=True)
if __name__=='__main__':
 if sys.argv[1:]==['--render-sql']:prepare_sql()
 elif sys.argv[1:]==['--remaining']:main(remaining=True)
 elif len(sys.argv)==1:main()
 else:raise SystemExit('Use no arguments to prepare, or --render-sql to render the guarded administrative transaction')
