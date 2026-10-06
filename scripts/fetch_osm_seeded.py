#!/usr/bin/env python3
"""Fallback: use licensed OSM mirror IDs, re-fetch every object from the live OSM API.

The mirror has unknown snapshot freshness. Its coordinates/tags/status are NEVER
published: it only supplies IDs. Current visible objects and tags are revalidated
against api.openstreetmap.org, retaining real last modification timestamps.
"""
import csv
import datetime as dt
import io
import json
import time
import xml.etree.ElementTree as ET
from pathlib import Path
import requests
from fetch_osm import COUNTRIES, CACHE
from osm_cache import replace_phase

ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'master-db/raw/osm-seeds'
API_CACHE=ROOT/'master-db/cache/osm-api'
HEADERS={'User-Agent':'speed-camera-app/1.0 (+https://github.com/ternzina/speed-camera-app; licensed OSM ID verification)'}

def nodes(ids):
    path=API_CACHE/('nodes-'+str(ids[0])+'-'+str(ids[-1])+'.json')
    if path.exists():return json.loads(path.read_text())
    result=[]
    for attempt in range(4):
        try:
            r=requests.get('https://api.openstreetmap.org/api/0.6/nodes',params={'nodes':','.join(map(str,ids))},headers=HEADERS,timeout=45)
            if r.status_code in (400,404,410):
                if len(ids)==1:return []
                mid=len(ids)//2
                return nodes(ids[:mid])+nodes(ids[mid:])
            r.raise_for_status()
            root=ET.fromstring(r.content)
            for n in root.findall('node'):
                if n.get('visible')=='false' or n.get('lat') is None:continue
                result.append({'type':'node','id':int(n.get('id')),'lat':float(n.get('lat')),'lon':float(n.get('lon')),
                               'version':int(n.get('version')),'timestamp':n.get('timestamp'),
                               'tags':{t.get('k'):t.get('v') for t in n.findall('tag')}})
            path.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
            time.sleep(1)
            return result
        except Exception:
            if attempt==3:raise
            time.sleep(min(30,5*2**attempt))

def main(refresh=False,countries=None):
    global API_CACHE
    if refresh:API_CACHE=ROOT/'master-db/cache/osm-api'/dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S')
    RAW.mkdir(parents=True,exist_ok=True);API_CACHE.mkdir(parents=True,exist_ok=True);CACHE.mkdir(parents=True,exist_ok=True)
    reports=[]
    for code in (countries or COUNTRIES):
        csvpath=RAW/(code+'.csv');done=API_CACHE/(code+'.done.json')
        if done.exists():reports.append(json.loads(done.read_text()));continue
        try:
            url='https://speedcams.world/downloads/'+code.lower()+'/'+code.lower()+'-all.csv'
            if refresh or not csvpath.exists():
                r=requests.get(url,headers=HEADERS,timeout=30)
                if r.status_code==404:
                    reports.append({'country_code':code,'status':'no_mirror_dataset','seed_ids':0});continue
                r.raise_for_status();csvpath.write_bytes(r.content)
            text=csvpath.read_text(encoding='utf-8-sig')
            assert 'opendatacommons.org/licenses/odbl' in text[:1000],'missing ODbL attribution'
            rows=list(csv.DictReader(io.StringIO('\n'.join(x for x in text.splitlines() if not x.startswith('#')))))
            ids=sorted({int(r['id']) for r in rows if str(r['id']).isdigit()})
            elements=[]
            for offset in range(0,len(ids),500):
                elements.extend(nodes(ids[offset:offset+500]))
            path=CACHE/(code+'.json')
            prior=json.loads(path.read_text()) if path.exists() else {'elements':[],'_bootstrap':{}}
            timestamp=dt.datetime.now(dt.timezone.utc).isoformat()
            prior=replace_phase(prior,'seed',elements,timestamp,ids)
            prior.setdefault('_bootstrap',{}).setdefault('phases',[])
            prior['_bootstrap'].update(country_code=code,retrieved_at=timestamp,license='ODbL-1.0',
                 live_verification_api='https://api.openstreetmap.org/api/0.6/nodes',seed_url=url,
                 seed_snapshot_freshness='unknown; IDs only; all seed observations independently refreshed',verified_nodes=len(elements))
            path.write_text(json.dumps(prior,ensure_ascii=False,separators=(',',':')))
            report={'country_code':code,'seed_url':url,'seed_ids':len(ids),'current_nodes':len(elements),
                    'speed_camera_nodes':sum(x['tags'].get('highway')=='speed_camera' for x in elements),
                    'retrieved_at':timestamp,'status':'verified_live'}
            done.write_text(json.dumps(report));reports.append(report)
            print(code,report['seed_ids'],'seed IDs;',report['speed_camera_nodes'],'current speed cameras verified',flush=True)
        except Exception as e:
            reports.append({'country_code':code,'status':'failed','error':str(e)});print(code,'failed',str(e)[:140],flush=True)
    target=ROOT/'master-db/bootstrap/reports/osm-api-verification.json'
    previous={r['country_code']:r for r in json.loads(target.read_text())} if target.exists() else {}
    previous.update({r['country_code']:r for r in reports})
    target.write_text(json.dumps(sorted(previous.values(),key=lambda x:x['country_code']),indent=2))

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--refresh',action='store_true');parser.add_argument('--countries',nargs='+')
    args=parser.parse_args();main(args.refresh,args.countries)
