#!/usr/bin/env python3
"""Discover additional enforcement relations through current primary OSM membership.

Only new relation observations are normalized; existing camera rows are anchors.
"""
import concurrent.futures,datetime,gzip,json,time
from pathlib import Path
from xml.etree import ElementTree as ET
import requests
from bootstrap_cameras import save
from refresh_expansion_primary import fetch,HEADERS,REL_CACHE
from verify_expansion import elements
ROOT=Path(__file__).resolve().parents[1]
TARGETS={'IE','DK','IS','SK','BG','AL','ME','LU','LV','EE','MD','CY','MT'}
CACHE=ROOT/'master-db/cache/expansion/parent-memberships';CACHE.mkdir(parents=True,exist_ok=True)

def main():
    baseline=json.loads(gzip.decompress((ROOT/'master-db/backups/expansion/normalized-50141.json.gz').read_bytes()))
    jobs=set()
    for row in baseline:
        if row['country_code'] not in TARGETS:continue
        for source in row['camera_sources']:
            if source['source_type']=='openstreetmap' and source['source_id'].startswith('node/'):
                jobs.add((row['country_code'],int(source['source_id'].split('/')[1])))
    def run(job):
        country,id=job;path=CACHE/(country+'-'+str(id)+'.json')
        if path.exists():return country,json.loads(path.read_text()),None
        try:
            response=requests.get('https://api.openstreetmap.org/api/0.6/node/'+str(id)+'/relations',headers=HEADERS,timeout=25)
            response.raise_for_status();rels=elements(ET.fromstring(response.content))
            rels=[r for r in rels if r.get('tags',{}).get('enforcement') or r.get('tags',{}).get('type') in ('enforcement','average_speed','section_control')]
            path.write_text(json.dumps(rels));time.sleep(.15);return country,rels,None
        except Exception as exc:return country,[],type(exc).__name__
    found={};errors=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for offset,(country,rels,error) in enumerate(pool.map(run,sorted(jobs)),1):
            found.setdefault(country,{}).update({r['id']:r for r in rels})
            if error:errors.append({'country':country,'error_type':error})
            if offset%100==0:print('Primary parent discovery',offset,'/',len(jobs),flush=True)
    report=[]
    for country,rs in sorted(found.items()):
        nodes=sorted({m['ref'] for r in rs.values() for m in r['members'] if m['type']=='node' and m.get('role') in ('device','from','to')});points=[]
        for offset in range(0,len(nodes),300):points.extend(fetch('node',nodes[offset:offset+300]))
        now=datetime.datetime.now(datetime.timezone.utc).isoformat()
        # Actual primary relations are a resumable authoritative overlay too.
        if rs:
            REL_CACHE.mkdir(parents=True,exist_ok=True)
            (REL_CACHE/('relations-memberships-'+country+'.json')).write_text(json.dumps(list(rs.values())))
        save(ROOT/'master-db/cache/expansion/osm'/(country+'-parent-discovery.json'),{'_bootstrap':{'country_code':country,'retrieved_at':now,'license':'ODbL-1.0','endpoint':'https://api.openstreetmap.org/api/0.6/node/{id}/relations','method':'Current parent membership discovery; explicit from/to/device nodes only'},'elements':list(rs.values())+points})
        report.append({'country':country,'relations':len(rs),'explicit_nodes':len(nodes)})
    save(ROOT/'master-db/expansion/reports/primary-membership-discovery.json',{'nodes_queried':len(jobs),'countries':report,'failures':errors})
    print('Primary membership discovery complete',len(jobs),sum(len(x) for x in found.values()),'relations',flush=True)

if __name__=='__main__':main()
