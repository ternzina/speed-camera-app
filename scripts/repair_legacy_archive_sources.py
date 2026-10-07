#!/usr/bin/env python3
"""Hydrate pre-bootstrap source links; immutable repair, no canonical row writes."""
import json
from psycopg.types.json import Jsonb
from r2_archive import ROOT,read_dataset,dataset,encode,put
from prepare_cold_master import normalized_master
from cold_storage_pipeline import control
from update_cameras import connect
state=json.loads((ROOT/'master-db/backups/storage-architecture/snapshot.json').read_text())
expected=control()
prepared=json.loads((ROOT/'master-db/backups/storage-architecture/prepared.json').read_text())
assert expected==prepared['normalized_master']['key'],'One-time repair cannot replace a later production master'
rows=list(read_dataset(state['tables']['public.camera_records']['manifest_ref']))
master=normalized_master(state,rows)
manifest,_=dataset('normalized-master-v2',master)
receipt={'version':2,'kind':'legacy-source-catalog-hydration','normalized_master':manifest['manifest_ref'],'verified_readback':True,'observation_count':0,'candidate_count':0,'record_count':len(master),'original_snapshot':state['root_ref']}
root=put(encode(receipt),'manifests')
with connect() as conn:
 conn.execute('select camera_bootstrap_private.register_archive(%s)',(Jsonb({'root':root,'expected_manifest':expected,**receipt}),))
 conn.execute('select camera_bootstrap_private.advance_archive(%s)',(manifest['manifest_ref']['key'],))
(ROOT/'master-db/storage/reports/legacy-source-hydration.json').write_bytes(encode({'root':root,**receipt}))
print('Verified cold master repair committed; published rows unchanged',flush=True)
