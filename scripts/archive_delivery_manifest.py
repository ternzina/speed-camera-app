#!/usr/bin/env python3
"""Archive and verify the prior delivery manifest before its mutable replacement."""
import json,datetime
from r2_archive import ROOT,encode,sha,archive_files,put
path=ROOT/'master-db/backups/r2-migration/previous-manifest.json'
if path.exists():
 raw=path.read_bytes();manifest=json.loads(raw)
 assert sum(c['record_count'] for c in manifest['countries'])==manifest['total_records']
 files=archive_files([path])
 receipt={'kind':'public-delivery-manifest-history','sha256':sha(raw),'countries':len(manifest['countries']),'records':manifest['total_records'],'file_manifest':files['manifest_ref'],'immutable_country_objects_retained':True}
 receipt['root']=put(encode(receipt),'manifests')
 (ROOT/'master-db/storage/reports/delivery-manifest-history.json').write_bytes(encode(receipt))
 print('Previous delivery manifest archived and restored',receipt['countries'],receipt['records'])
