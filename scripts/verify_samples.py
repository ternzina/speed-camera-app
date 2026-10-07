#!/usr/bin/env python3
"""Independent live OSM spot checks plus government source geometry and DB read-back."""
import collections
import datetime as dt
import json
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path
import requests
from bootstrap_cameras import dist,save
from update_cameras import load_records,connect
ROOT=Path(__file__).resolve().parents[1]

def close(a,b):return abs(float(a)-float(b))<1e-8

def main():
    records=load_records();chosen=[];seen=set()
    by_country=collections.defaultdict(list);by_official=collections.defaultdict(list)
    for r in records:
        if r['status']!='active':continue
        for s in r['camera_sources']:
            if s.get('source_status')=='missing_source':continue
            if s['source_type']=='openstreetmap' and s['source_id'].startswith('node/'):by_country[r['country_code']].append((r,s))
            elif s['source_type']=='official_government':by_official[s['source_code']].append((r,s))
    for group in list(by_country.values())+list(by_official.values()):
        for r,s in group[:2]:
            key=(s['source_code'],s['source_id'])
            if key not in seen:chosen.append((r,s));seen.add(key)
    section_countries=set()
    for r in records:
        if r['camera_type']=='average_speed_section' and r['status']=='active' and r['country_code'] not in section_countries and r['camera_sources']:
            source=r['camera_sources'][0];key=(source['source_code'],source['source_id'])
            if key not in seen:chosen.append((r,source));seen.add(key);section_countries.add(r['country_code'])
        if len(section_countries)>=6:break
    nodes=sorted({int(s['source_id'].split('/')[1]) for r,s in chosen if s['source_type']=='openstreetmap' and s['source_id'].startswith('node/')})
    response=requests.get('https://api.openstreetmap.org/api/0.6/nodes',params={'nodes':','.join(map(str,nodes))},timeout=60)
    response.raise_for_status();xml=response.content
    cache=ROOT/'master-db/cache/bootstrap/qa';cache.mkdir(parents=True,exist_ok=True);(cache/'live-sample-nodes.osm').write_bytes(xml)
    live={int(n.get('id')):n for n in ET.fromstring(xml).findall('node')}
    official={p.stem:json.loads(p.read_text()) for p in (ROOT/'master-db/raw/official').glob('*.json')}
    checks=[]
    live_relations={}
    with connect() as conn:
        db={cid:(lat,lon,kind) for cid,lat,lon,kind in conn.execute('select canonical_id,latitude,longitude,camera_type from public.camera_records')}
        for r,s in chosen:
            a=db[r['canonical_id']];assert close(a[0],r['latitude']) and close(a[1],r['longitude']) and a[2]==r['camera_type']
            if s['source_type']=='openstreetmap' and s['source_id'].startswith('relation/'):
                relation_id=s['source_id'].split('/')[1]
                response=requests.get('https://api.openstreetmap.org/api/0.6/relation/'+relation_id+'/full',timeout=60);response.raise_for_status()
                root=ET.fromstring(response.content);relation=root.find('relation');points={x.get('id'):x for x in root.findall('node')}
                roles={m.get('role'):points.get(m.get('ref')) for m in relation.findall('member') if m.get('type')=='node' and m.get('role') in ('from','to')}
                assert all(roles.get(k) is not None for k in ('from','to'))
                assert close(roles['from'].get('lat'),s['latitude']) and close(roles['from'].get('lon'),s['longitude'])
                assert close(roles['to'].get('lat'),s['end_latitude']) and close(roles['to'].get('lon'),s['end_longitude'])
                evidence='Live OSM enforcement relation and explicit ordered from/to member coordinates; Supabase read-back';observed_version=relation.get('version')
            elif s['source_type']=='openstreetmap':
                n=live[int(s['source_id'].split('/')[1])];tags={x.get('k'):x.get('v') for x in n.findall('tag')}
                assert close(n.get('lat'),s['latitude']) and close(n.get('lon'),s['longitude']),s['source_id']
                if tags.get('highway')!='speed_camera' and not tags.get('enforcement'):
                    confirmed=False
                    for rid in s['raw_payload'].get('relations',[]):
                        if rid not in live_relations:
                            response=requests.get('https://api.openstreetmap.org/api/0.6/relation/'+str(rid),timeout=60);response.raise_for_status()
                            live_relations[rid]=ET.fromstring(response.content).find('relation')
                        rel=live_relations[rid];rtags={t.get('k'):t.get('v') for t in rel.findall('tag')}
                        confirmed=confirmed or (rtags.get('type')=='enforcement' and bool(rtags.get('enforcement')) and any(m.get('type')=='node' and m.get('ref')==n.get('id') and m.get('role')=='device' for m in rel.findall('member')))
                    assert confirmed,'No current enforcement evidence: '+s['source_id']
                evidence='Live official OSM API object, coordinates/tags/version; Supabase canonical read-back'
                observed_version=n.get('version')
            else:
                p=s['raw_payload'];env=official[s['source_code']];adapter=env['source']['adapter'];lat=lon=None
                if adapter=='france':lat,lon=float(p['Latitude']),float(p['Longitude'])
                elif adapter=='dgt':lat,lon=p['from'] if p.get('from') else (float(p['latitude'][0]),float(p['longitude'][0]))
                elif adapter=='nvdb':
                    m=re.search(r'POINT(?: Z)?\s*\(\s*([\d.-]+)\s+([\d.-]+)',p['geometri']['wkt']);lat,lon=map(float,m.groups())
                elif adapter in ('chicago','edmonton','sfmta'):lat,lon=float(p['latitude']),float(p['longitude'])
                else:
                    for f in env['data']['features']:
                        if f['properties']==p:
                            g=f['geometry'];coordinates=g['coordinates'];lon,lat=coordinates[0][:2] if g['type']=='MultiPoint' else coordinates[:2];break
                assert lat is not None and close(lat,s['latitude']) and close(lon,s['longitude']),s['source_code']
                evidence='Downloaded primary government geometry, authority axis order/explicit section endpoints; Supabase canonical read-back'
                observed_version=None
            checks.append({'canonical_id':r['canonical_id'],'country_code':r['country_code'],'source_code':s['source_code'],
                           'source_id':s['source_id'],'source_url':s['source_url'],'license':s['license'],
                           'latitude':r['latitude'],'longitude':r['longitude'],'observed_latitude':s['latitude'],'observed_longitude':s['longitude'],
                           'merge_distance_m':round(dist(r,s),3),'camera_type':r['camera_type'],'speed_limit':r['speed_limit'],
                           'direction':r['direction'],'current_osm_version':observed_version,'result':'passed','evidence':evidence})
    assert len(checks)>=50,len(checks)
    save(ROOT/'master-db/bootstrap/reports/independent-sample-validation.json',{'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),
         'sample_count':len(checks),'countries':len({x['country_code'] for x in checks}),'sources':len({x['source_code'] for x in checks}),
         'method':'Automated source/geometry and actual database spot checks; not on-road inspection','checks':checks})
    print('Independent sample validation:',len(checks),'passed across',len({x['country_code'] for x in checks}),'countries')

if __name__=='__main__':main()
