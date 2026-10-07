#!/usr/bin/env python3
"""Real SQL guard checks; all attempts roll back, no camera is inserted."""
import json,datetime,copy
import psycopg
from psycopg.types.json import Jsonb
from r2_archive import ROOT,get,encode,put
from cold_storage_pipeline import control
from update_cameras import connect
expected=control();manifest=json.loads(get(expected))
receipt={'version':2,'kind':'rollback-only-sql-guard-drill','created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'normalized_master':{'key':expected},'verified_readback':True,'observation_count':0,'candidate_count':0}
ref=put(encode(receipt),'manifests')
base={'canonical_id':'__rollback_only_guard_test__','country_code':'US','camera_type':'fixed_speed','confidence':'HIGH','status':'active','latitude':35,'longitude':-90,'source_codes':['OSM_US'],'source_count':1,'archive_ref':manifest['chunks'][0]['key']}
checks=[]
with connect() as conn:
 before=conn.execute('select count(*) from public.camera_records').fetchone()[0];conn.rollback()
 for name,change,expected_error in [('full_payload',{'raw_payload':{'forbidden':'value'}},'payloads forbidden'),('low_candidate',{'confidence':'LOW'},'unpublishable camera'),('missing_pointer',{'archive_ref':None},'pointer required')]:
  try:
   conn.execute('select camera_bootstrap_private.register_archive(%s)',(Jsonb({'root':ref,'expected_manifest':expected,**receipt}),))
   conn.execute('select camera_bootstrap_private.ingest_batch(%s)',(Jsonb([{**base,**change}]),))
  except psycopg.errors.RaiseException as error:
   assert expected_error in str(error),str(error);checks.append({'check':name,'blocked':True})
  else:raise AssertionError('Guard accepted unsafe payload: '+name)
  finally:conn.rollback()
 try:conn.execute('select camera_bootstrap_private.register_archive(%s)',(Jsonb({'root':ref,'expected_manifest':'stale','verified_readback':True}),))
 except psycopg.errors.RaiseException as error:assert 'Concurrent import' in str(error);checks.append({'check':'stale_master_pointer','blocked':True})
 else:raise AssertionError('Stale pointer accepted')
 finally:conn.rollback()
 assert conn.execute('select count(*) from public.camera_records').fetchone()[0]==before
 assert conn.execute('select count(*) from camera_bootstrap_private.archive_registry where root_key=%s',(ref['key'],)).fetchone()[0]==0
report={'checks':checks,'camera_rows_unchanged':before,'result':'passed'}
(ROOT/'master-db/storage/reports/sql-guards.json').write_bytes(encode(report));print(report)
