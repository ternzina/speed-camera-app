#!/usr/bin/env python3
"""Current primary OSM verification of stage-new objects only; resumable locally."""
import datetime,gzip,json,time,xml.etree.ElementTree as ET
from pathlib import Path
import requests
from bootstrap_cameras import save
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'master-db/cache/osm-api/expansion-current'
REL_CACHE=ROOT/'master-db/cache/expansion/current-relations'
START=max(json.loads((ROOT/'master-db/expansion/reports/baseline.json').read_text())['captured_at'],datetime.datetime.now(datetime.timezone.utc).replace(hour=0,minute=0,second=0,microsecond=0).isoformat())
HEADERS={'User-Agent':'SpeedCameraExpansion/1.0 (+https://github.com/ternzina/speed-camera-app; current primary OSM verification)'}

def primary_maps():
    nodes={};relations={}
    for directory,pattern,target in [(ROOT/'master-db/cache/osm-api','nodes-*.json',nodes),(REL_CACHE,'relations-*.json',relations)]:
        for path in sorted(directory.rglob(pattern)):
            stamp=datetime.datetime.fromtimestamp(path.stat().st_mtime,datetime.timezone.utc).isoformat()
            for e in json.loads(path.read_text()):
                prior=target.get(e['id'])
                if prior is None or stamp>=prior.get('_observed_at',''):
                    target[e['id']]={**e,'_observed_at':stamp}
    return nodes,relations

def fetch(kind,ids,force=False):
    directory=CACHE if kind=='node' else REL_CACHE;directory.mkdir(parents=True,exist_ok=True)
    path=directory/(kind+'s-'+str(ids[0])+'-'+str(ids[-1])+'.json')
    if path.exists() and not force and datetime.datetime.fromtimestamp(path.stat().st_mtime,datetime.timezone.utc).isoformat()>=START:return json.loads(path.read_text())
    result=[]
    for attempt in range(3):
        try:
            r=requests.get('https://api.openstreetmap.org/api/0.6/'+kind+'s',params={kind+'s':','.join(map(str,ids))},headers=HEADERS,timeout=45)
            if r.status_code in (400,404,410):
                if len(ids)>1:
                    mid=len(ids)//2;result=fetch(kind,ids[:mid],force)+fetch(kind,ids[mid:],force);break
                # A bulk 400 alone does not prove deletion. Confirm on the object endpoint.
                single=requests.get('https://api.openstreetmap.org/api/0.6/'+kind+'/'+str(ids[0]),headers=HEADERS,timeout=45)
                if single.status_code in (404,410):
                    result=[{'type':kind,'id':ids[0],'visible':False,'_deleted_verified_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}];break
                single.raise_for_status();r=single
            r.raise_for_status()
            for e in ET.fromstring(r.content).findall(kind):
                x={'type':kind,'id':int(e.get('id')),'version':int(e.get('version','0')),'timestamp':e.get('timestamp'),'tags':{t.get('k'):t.get('v') for t in e.findall('tag')}}
                if e.get('visible')=='false':x['visible']=False
                elif kind=='node':x.update(lat=float(e.get('lat')),lon=float(e.get('lon')))
                else:x['members']=[{'type':m.get('type'),'ref':int(m.get('ref')),'role':m.get('role')} for m in e.findall('member')]
                result.append(x)
            assert {x['id'] for x in result}==set(ids),'Incomplete primary response'
            break
        except Exception:
            if attempt==2:raise
            time.sleep(2**attempt)
    path.write_text(json.dumps(result,ensure_ascii=False));time.sleep(.4)
    return result

def required(records):
    node_ids=set();relation_ids=set()
    for r in records:
        for s in r['camera_sources']:
            if s['source_type']!='openstreetmap':continue
            kind,id=s['source_id'].split('/');raw=s['raw_payload']
            if kind=='node':node_ids.add(int(id))
            elif kind=='relation':relation_ids.add(int(id))
            relation_ids.update(raw.get('relations',[]))
    return node_ids,relation_ids

def required_versions(records):
    versions={'node':{},'relation':{}}
    for row in records:
        for source in row['camera_sources']:
            if source['source_type']!='openstreetmap':continue
            kind,id=source['source_id'].split('/');raw=source['raw_payload']
            if kind in versions:versions[kind][int(id)]=max(versions[kind].get(int(id),0),raw.get('osm_version') or 0)
            for rel in raw.get('enforcement_relations',[]):versions['relation'][rel['id']]=max(versions['relation'].get(rel['id'],0),rel.get('version') or 0)
    return versions

def main():
    from expand_cameras import normalize
    _,pending=normalize()
    first=json.loads(gzip.decompress((ROOT/'master-db/backups/expansion/round1-new-records.json.gz').read_bytes()))
    node_ids,relation_ids=required(first+pending)
    versions=required_versions(first+pending)
    nodes,relations=primary_maps();failures=[]
    for kind,ids,mapping in [('relation',relation_ids,relations),('node',node_ids,nodes)]:
        if kind=='node':
            for rel in relations.values():
                ids.update(m['ref'] for m in rel.get('members',[]) if m['type']=='node' and m.get('role') in ('device','from','to'))
        needed=sorted(i for i in ids if mapping.get(i,{}).get('_observed_at','')<START or (mapping.get(i,{}).get('visible') is not False and mapping.get(i,{}).get('version',0)<versions[kind].get(i,0)))
        print('Current primary',kind,'required',len(ids),'fetch',len(needed),flush=True)
        for offset in range(0,len(needed),300):
            batch=needed[offset:offset+300]
            try:
                current=fetch(kind,batch,force=True);now=datetime.datetime.now(datetime.timezone.utc).isoformat()
                mapping.update({e['id']:{**e,'_observed_at':now} for e in current})
                print(kind,min(offset+len(batch),len(needed)),'/',len(needed),flush=True)
            except Exception as exc:failures.append({'kind':kind,'ids':batch,'error_type':type(exc).__name__})
    save(ROOT/'master-db/expansion/reports/primary-refresh.json',{'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'required_nodes':len(node_ids),'required_relations':len(relation_ids),'failures':failures,'deleted_nodes':sum(nodes.get(i,{}).get('visible') is False for i in node_ids),'deleted_relations':sum(relations.get(i,{}).get('visible') is False for i in relation_ids),'scope':'Only expansion objects and their explicit relation endpoints; original 50141 untouched'})
    from bootstrap_cameras import osm_records,clean_raw
    import update_cameras as pipeline
    holds=[]
    with pipeline.connect() as conn:
        active_ids={cid for cid, in conn.execute('select canonical_id from public.camera_records where active')}
    for old in first:
        source=old['camera_sources'][0]
        if source['source_type']!='openstreetmap' or old['status']!='active' or old['canonical_id'] not in active_ids:continue
        ns,rs=required([old]);fresh=all(nodes.get(i,{}).get('_observed_at','')>=START for i in ns) and all(relations.get(i,{}).get('_observed_at','')>=START for i in rs)
        elements=[nodes[i] for i in ns if i in nodes]+[relations[i] for i in rs if i in relations]
        data={'_bootstrap':{'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat()},'elements':elements}
        observed={r['canonical_id']:r for r in osm_records(data,old['country_code'],nodes,relations)}.get(old['canonical_id'])
        fields=('camera_type','latitude','longitude','end_latitude','end_longitude')
        if fresh and observed and observed['status']=='active' and all(observed.get(f)==old.get(f) for f in fields):continue
        old.update(confidence='LOW',status='review',review_reason='Current primary OSM evidence changed or could not be confirmed; expansion-only observation withheld',primary_api_review={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'fresh':fresh,'observed':{f:observed.get(f) for f in fields} if observed else None})
        holds.append(old)
    if holds:
        baseline={r['canonical_id'] for r in json.loads(gzip.decompress((ROOT/'master-db/backups/expansion/baseline-50141.json.gz').read_bytes()))}
        assert not ({r['canonical_id'] for r in holds}&baseline)
        pipeline.BASE=ROOT/'master-db/expansion';pipeline.sync(holds)
    report=ROOT/'master-db/expansion/reports/primary-review-holds.json'
    prior=json.loads(report.read_text()) if report.exists() else []
    save(report,list({r['canonical_id']:r for r in prior+[{'canonical_id':r['canonical_id'],'reason':r['review_reason']} for r in holds]}.values()))
    print('First-pass new records held for review:',len(holds),flush=True)

if __name__=='__main__':main()
