#!/usr/bin/env python3
"""Rollback-only checks of the actual production UA/PL publication guards."""
import json,datetime
import psycopg
from psycopg.types.json import Jsonb
from r2_archive import ROOT,get,encode,put
from cold_storage_pipeline import control
from update_cameras import connect
expected=control();manifest=json.loads(get(expected));receipt={'version':2,'kind':'ua-pl-rollback-only-guard-drill','created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'normalized_master':{'key':expected},'verified_readback':True,'observation_count':0,'candidate_count':0};ref=put(encode(receipt),'manifests')
base={'canonical_id':'__ua_pl_guard_only__','country_code':'PL','camera_type':'fixed_speed','confidence':'HIGH','status':'active','latitude':50,'longitude':20,'source_codes':['PL_CANARD_CURRENT'],'source_count':1,'archive_ref':manifest['chunks'][0]['key'],'publication_review':'ua_pl_official_v1'}
cases=[('unreviewed_country',{'publication_review':None},'unpublishable'),('UA_without_independent',{'country_code':'UA','source_codes':['UA_NPU_CURRENT']},'unpublishable'),('PL_without_CANARD',{'source_codes':['OSM_PL']},'unpublishable'),('LOW_reviewed',{'confidence':'LOW'},'unpublishable'),('full_payload',{'raw_payload':{'forbidden':'data'}},'payloads forbidden'),('private_payload_in_projection',{'delivery':{'raw_payload':'forbidden'}},'invalid operational projection')];checks=[]
with connect() as c:
 before=c.execute('select count(*) from public.camera_records').fetchone()[0];c.rollback()
 for name,change,message in cases:
  try:
   c.execute('select camera_bootstrap_private.register_archive(%s)',(Jsonb({'root':ref,'expected_manifest':expected,**receipt}),));c.execute('select camera_bootstrap_private.ingest_batch(%s)',(Jsonb([{**base,**change}]),))
  except psycopg.errors.RaiseException as e:assert message in str(e);checks.append({'check':name,'blocked':True})
  else:raise AssertionError('Unsafe payload accepted: '+name)
  finally:c.rollback()
 assert c.execute('select count(*) from public.camera_records').fetchone()[0]==before
 assert c.execute('select count(*) from camera_bootstrap_private.archive_registry where root_key=%s',(ref['key'],)).fetchone()[0]==0
report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':checks,'operational_rows_unchanged':before,'result':'passed'};(ROOT/'master-db/ua-pl/sql-guards.json').write_bytes(encode(report));print(report)
