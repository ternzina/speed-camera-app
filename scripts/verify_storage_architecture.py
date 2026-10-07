#!/usr/bin/env python3
"""Verify original published operational fields, candidate moderation and cold counts."""
import json
from r2_archive import ROOT,read_dataset,encode
from update_cameras import connect
p=json.loads((ROOT/'master-db/backups/storage-architecture/prepared.json').read_text())
original=list(read_dataset(p['canonical_snapshot']))
with connect() as conn:
 actual={};offset=0
 while True:
  page=conn.execute('select to_jsonb(r) from public.camera_records r order by id offset %s limit 1000',(offset,)).fetchall()
  if not page:break
  actual.update({r[0]['canonical_id']:r[0] for r in page});offset+=len(page)
 protected=0
 for row in original:
  cid=row['canonical_id']
  if row['active'] and row['confidence'] in ('high','medium'):
   current=actual[cid]
   assert {k:v for k,v in row.items() if k!='metadata'}=={k:v for k,v in current.items() if k!='metadata'},cid+' operational data changed'
   assert (row['locality'] or row['road'] or row['metadata'].get('road_name') or cid)==(current['locality'] or current['road'] or current['metadata'].get('road_name') or cid),cid+' display label changed'
   if row['country_code'] in ('UA','PL'):assert current['metadata']==row['metadata'],cid+' legacy projection changed'
   else:assert current['metadata']['archive_ref'].startswith('archive/v1/') and 'provenance' not in current['metadata']
   protected+=1
  else:assert cid not in actual,cid+' candidate remains in published index'
 assert conn.execute("select count(*) from public.camera_records where not active or confidence not in ('high','medium')").fetchone()[0]==0
 moderation={cid:(status,confidence,ref) for cid,status,confidence,ref in conn.execute('select canonical_id,status,confidence,archive_ref from camera_bootstrap_private.camera_moderation')}
 for row in original:
  if not(row['active'] and row['confidence'] in ('high','medium')):
   assert moderation[row['canonical_id']][:2]==(row['status'],row['confidence'])
 assert conn.execute("select to_regclass('public.camera_source_links')").fetchone()[0] is None
 size=conn.execute('select pg_database_size(current_database())').fetchone()[0]
 countries=conn.execute('select count(*) from public.camera_country_coverage').fetchone()[0]
 sources=conn.execute('select count(*) from public.camera_sources').fetchone()[0]
 registry=conn.execute('select count(*),sum(observation_count),sum(candidate_count) from camera_bootstrap_private.archive_registry').fetchone()
 receipt={'before_bytes':289699507,'after_bytes':size,'freed_bytes':289699507-size,'published_cameras_postgres':len(actual),'existing_published_unchanged':protected,'moderation_rows':len(moderation),'source_catalog_rows':sources,'countries':countries,'camera_operational_layer_rows':len(actual)+len(moderation)+sources+2+1+registry[0],'import_receipts':registry[0],'archived_observations_receipt_counts':int(registry[1]),'archived_candidates_receipt_counts':int(registry[2]),'initial_cold_counts':p['counts'],'root_receipt':p['root_ref'],'original_snapshot_root':p['snapshot_root'],'schema_archive':p['schema'],'typed_restore_proof':p['restore_proof'],'result':'passed'}
 (ROOT/'master-db/storage/reports/migration.json').write_bytes(encode(receipt))
 print(json.dumps(receipt),flush=True)
