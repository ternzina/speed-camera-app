#!/usr/bin/env python3
"""Live primary-source spot checks of new records and complete baseline comparison."""
import collections,datetime,gzip,json,sys
from pathlib import Path
from xml.etree import ElementTree as ET
import requests
from bootstrap_cameras import osm_records,save
from fetch_expansion_official import records as official_records
from fetch_expansion_official import csv_rows
from expand_cameras import actual_snapshot,ROOT
from update_cameras import connect
from public_download import get as public_get

def elements(root):
    out=[]
    for e in root:
        if e.tag not in ('node','relation'):continue
        r={'type':e.tag,'id':int(e.get('id')),'version':int(e.get('version','0')),'tags':{t.get('k'):t.get('v') for t in e.findall('tag')}}
        if e.tag=='node':r.update(lat=float(e.get('lat')),lon=float(e.get('lon')))
        else:r['members']=[{'type':m.get('type'),'ref':int(m.get('ref')),'role':m.get('role')} for m in e.findall('member')]
        out.append(r)
    return out

def main():
    baseline=json.loads(gzip.decompress((ROOT/'master-db/backups/expansion/baseline-50141.json.gz').read_bytes()))
    baseline_ids={r['canonical_id'] for r in baseline}
    actual=actual_snapshot();byid={r['canonical_id']:r for r in actual}
    for r in baseline:assert byid.get(r['canonical_id'])==r,r['canonical_id']
    new=[r for r in actual if r['canonical_id'] not in baseline_ids and r['active']]
    groups=collections.defaultdict(list)
    for r in new:
        s=r['metadata']['provenance'][0]
        groups['country:'+r['country_code']].append(r)
        if s['source_type']=='official_government':groups['source:'+s['source_code']].append(r)
        if r['camera_type']=='average_speed_section':groups['sections:'+r['country_code']].append(r)
    selected={}
    for key,group in groups.items():
        for r in group[:3]:selected[r['canonical_id']]=r
    chosen=list(selected.values());sources=json.loads((ROOT/'master-db/expansion/sources.json').read_text());source_map={s['code']:s for s in sources}
    with connect() as conn:
        raw={cid:payload for cid,payload in conn.execute('select r.canonical_id,l.raw_payload from public.camera_records r join public.camera_source_links l on l.camera_record_id=r.id where r.canonical_id=any(%s)',(list(selected),))}
    relation_ids=set();node_ids=set()
    for r in chosen:
        s=r['metadata']['provenance'][0]
        if s['source_type']!='openstreetmap':continue
        kind,id=s['source_id'].split('/');(node_ids if kind=='node' else relation_ids).add(int(id))
        relation_ids.update(raw[r['canonical_id']].get('relations',[]))
    live=[];cache=ROOT/'master-db/cache/expansion/qa';cache.mkdir(parents=True,exist_ok=True)
    headers={'User-Agent':'SpeedCameraExpansionQA/1.0 (+https://github.com/ternzina/speed-camera-app)'}
    if relation_ids:
        reply=requests.get('https://api.openstreetmap.org/api/0.6/relations',params={'relations':','.join(map(str,sorted(relation_ids)))},headers=headers,timeout=60);reply.raise_for_status();(cache/'relations.osm').write_bytes(reply.content)
        relations=elements(ET.fromstring(reply.content));live.extend(relations)
        for rel in relations:
            node_ids.update(m['ref'] for m in rel.get('members',[]) if m['type']=='node' and m['role'] in ('from','to','device'))
    if node_ids:
        reply=requests.get('https://api.openstreetmap.org/api/0.6/nodes',params={'nodes':','.join(map(str,sorted(node_ids)))},headers=headers,timeout=60);reply.raise_for_status();(cache/'nodes.osm').write_bytes(reply.content);live.extend(elements(ET.fromstring(reply.content)))
    live_osm={};checks=[];official_live={}
    for country in {r['country_code'] for r in chosen}:
        data={'_bootstrap':{'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat()},'elements':live}
        for r in osm_records(data,country):live_osm[r['canonical_id']]=r
    for r in chosen:
        s=r['metadata']['provenance'][0];code=s['source_code']
        if s['source_type']=='openstreetmap':
            observed=live_osm.get(code+':'+s['source_id']);assert observed,'Current OSM enforcement evidence missing: '+r['canonical_id']
            assert observed['camera_type']==r['camera_type'],r['canonical_id']
            evidence='Live primary OSM API tags/parent relations and coordinates'
        else:
            config=source_map[code]
            if code not in official_live:
                url=config['download_url']
                if config['format']=='arcgis':
                    ids=[raw[x['canonical_id']].get('id') for x in chosen if x['metadata']['provenance'][0]['source_code']==code]
                    response=public_get(url+'/query',params={'f':'geojson','objectIds':','.join(map(str,ids)),'outFields':'*','outSR':4326},timeout=60);response.raise_for_status();rows=response.json()['features']
                else:
                    response=public_get(url,timeout=60);response.raise_for_status()
                    if config['format']=='csv':rows=csv_rows(response.content,config)
                    else:
                        data=response.json();rows=data.get('features',[]) if isinstance(data,dict) else data
                official_live[code]={x['camera_sources'][0]['source_id']:x for x in official_records({'source':config,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rows':rows})}
            observed=official_live[code].get(s['source_id']);assert observed,'Current government identity missing: '+r['canonical_id']
            assert observed['camera_type']==r['camera_type'] and observed['status']=='active',r['canonical_id']
            evidence='Fresh government API geometry/status and stable source ID'
        for field in ('latitude','longitude','end_latitude','end_longitude'):
            a,b=observed.get(field),r.get(field)
            assert (a is None and b is None) or (a is not None and b is not None and abs(a-b)<1e-8),(r['canonical_id'],field)
        checks.append({'canonical_id':r['canonical_id'],'country_code':r['country_code'],'source_code':code,'source_url':s['source_url'],'result':'passed','evidence':evidence})
    assert len(checks)>=30,'Insufficient expansion samples'
    save(ROOT/'master-db/expansion/reports/independent-validation.json',{'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'samples':len(checks),'countries':len({r['country_code'] for r in checks}),'baseline_rows_compared_including_metadata':len(baseline),'baseline_changes':0,'checks':checks,'method':'Live source and database checks; not on-road inspection'})
    print('Expansion live samples passed:',len(checks),'baseline unchanged:',len(baseline),flush=True)

if __name__=='__main__':main()
