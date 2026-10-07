"""Reuse the verified all-Ireland extract for its Northern Ireland coverage."""
import json
from shapely.geometry import Point,shape
from r2_archive import ROOT,encode,get,archive_files

def northern_ireland():
    source=ROOT/'master-db/cache/expansion/osm/IE-extract.json'
    if not source.exists():return
    data=json.loads(source.read_text());parent=data['_bootstrap']['source_snapshot_manifest']
    get(parent['key'],refresh=True)
    target=ROOT/'master-db/cache/expansion/osm/GB-NORTHERN_IRELAND-extract.json'
    if target.exists() and json.loads(target.read_text())['_bootstrap'].get('parent_source_snapshot_manifest')==parent:return
    borders=json.loads((ROOT/'master-db/cache/bootstrap/countries.geojson').read_text())['features']
    border=shape(next(f['geometry'] for f in borders if f['properties'].get('ISO3166-1-Alpha-2')=='GB'))
    objects={(e['type'],e['id']):e for e in data['elements']}
    def inside(e):
        p={'lat':e['lat'],'lon':e['lon']} if 'lat' in e else e.get('center')
        return bool(p and border.covers(Point(p['lon'],p['lat'])))
    selected={key for key,e in objects.items() if inside(e)}
    inside_keys=set(selected)
    for key,e in objects.items():
        if e['type']=='relation' and any((m['type'],m['ref']) in inside_keys for m in e.get('members',[]) if m.get('role') in ('device','from','to')):
            selected.add(key)
            selected.update((m['type'],m['ref']) for m in e['members'])
    payload={'elements':[e for key,e in objects.items() if key in selected],
             '_bootstrap':{**data['_bootstrap'],'country_code':'GB','complete_country':False,
                'partition':'Northern Ireland from the shared all-Ireland source; actual GB country polygon',
                'parent_source_snapshot_manifest':parent}}
    raw=ROOT/'master-db/raw/coverage-stage/osm-extracts/GB-NORTHERN_IRELAND-observations.json'
    raw.write_bytes(encode(payload));archived=archive_files([raw])
    payload['_bootstrap']['source_snapshot_manifest']=archived['manifest_ref']
    temporary=target.with_suffix('.tmp');temporary.write_bytes(encode(payload));temporary.replace(target)
    print('Northern Ireland shared-source partition',len(payload['elements']),'verified in R2',flush=True)

if __name__=='__main__':northern_ireland()
