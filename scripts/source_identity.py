"""Stable source identities across overlapping regional acquisitions."""
import json
from pathlib import Path

def source_identity(source):
    namespace = 'OpenStreetMap' if source.get('source_type') == 'openstreetmap' else source['source_code']
    return namespace, str(source['source_id'])

def distinct_same_source_devices(a,b):
    return any(source_identity(x)[0]==source_identity(y)[0] and source_identity(x)[1]!=source_identity(y)[1]
               for x in a.get('camera_sources',[]) for y in b.get('camera_sources',[]))

def verified_aliases(records,path=None):
    path=path or Path(__file__).resolve().parents[1]/'master-db/coverage/verified-source-aliases.json'
    if not path.exists():return {}
    byid={r['canonical_id']:r for r in records};result={}
    for alias in json.loads(path.read_text())['aliases']:
        target=byid[alias['canonical_id']]
        assert alias['target_source_identity'] in [list(source_identity(s)) for s in target['camera_sources']], 'Verified alias target identity changed'
        key=tuple(alias['source_identity']);assert key not in result,'Duplicate source alias'
        result[key]=alias['canonical_id']
    return result
