#!/usr/bin/env python3
"""Append coverage using the existing importer; never rewrite baseline cameras.

Downloads and snapshots stay inside master-db. Re-running is safe: source IDs
and conservative spatial deduplication include the actual production database.
"""
import argparse,collections,datetime,gzip,hashlib,json,math
from pathlib import Path
from shapely.geometry import shape,Point
import update_cameras as pipeline
from bootstrap_cameras import osm_records,compatible,dist,clean_raw,save
from fetch_expansion_official import records as official_records

ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'master-db/expansion'
FIELDS=['canonical_id','country_code','camera_type','latitude','longitude','end_latitude','end_longitude','speed_limit','direction_code','active','confidence','status','metadata']

def actual_snapshot(exclude=None):
    with pipeline.connect() as conn:
        query='select '+','.join(FIELDS)+' from public.camera_records'
        if exclude:query+=' where not (canonical_id=any(%s))'
        return [dict(zip(FIELDS,row)) for row in conn.execute(query+' order by canonical_id',(list(exclude),) if exclude else None)]

def normalize():
    baseline=json.loads(gzip.decompress((ROOT/'master-db/backups/expansion/normalized-50141.json.gz').read_bytes()))
    # Include records already appended by an earlier expansion pass.
    byid={r['canonical_id']:r for r in baseline}
    for row in actual_snapshot(exclude=byid):
        if row['canonical_id'] in byid:continue
        meta=row['metadata'];byid[row['canonical_id']]={**meta,'camera_sources':meta.get('provenance',[])}
    anchors=list(byid.values());records=anchors.copy();new=[];duplicates=[];rejected=[]
    grid=collections.defaultdict(list);identities=set()
    def gridkey(r):return r['country_code'],math.floor(r['latitude']/.001),math.floor(r['longitude']/.001)
    for r in anchors:
        grid[gridkey(r)].append(r)
        for s in r.get('camera_sources',[]):identities.add((s['source_code'],s['source_id']))
    polygons={}
    for f in json.loads((ROOT/'master-db/cache/bootstrap/countries.geojson').read_text())['features']:
        c={'France':'FR','Norway':'NO','Kosovo':'XK'}.get(f['properties']['name'],f['properties'].get('ISO3166-1-Alpha-2'))
        if c and c!='-99':polygons[c]=shape(f['geometry'])
    ontario=shape(json.loads((ROOT/'master-db/cache/bootstrap/ontario.geojson').read_text())['features'][0]['geometry'])
    admin={f['properties'].get('iso_3166_2'):shape(f['geometry']) for f in json.loads((ROOT/'master-db/cache/bootstrap/admin1.geojson').read_text())['features'] if f['properties'].get('iso_3166_2') in ('US-NJ','CA-AB')}
    def accept(r):
        s=r['camera_sources'][0];identity=(s['source_code'],s['source_id']);c=r['country_code']
        if identity in identities or r['canonical_id'] in byid:
            duplicates.append({'source_id':r['canonical_id'],'reason':'existing source identity'});return
        lat,lon=r['latitude'],r['longitude'];polygon=polygons.get(c)
        if not polygon or not polygon.covers(Point(lon,lat)):
            rejected.append({'source_id':r['canonical_id'],'reason':'outside validated country polygon'});return
        if r['camera_type']=='average_speed_section' and (not polygon.covers(Point(r['end_longitude'],r['end_latitude'])) or not 50<=dist(r,{'latitude':r['end_latitude'],'longitude':r['end_longitude']})<=200000):
            r.update(confidence='LOW',status='review',review_reason='Uncertain section endpoints')
        if c=='CA' and ontario.covers(Point(lon,lat)) and r['camera_type'] in ('fixed_speed','speed_and_red_light','average_speed_section'):
            r.update(confidence='LOW',status='review',review_reason='Ontario municipal ASE authority ended 2025-11-14; current authorization required')
        for region,country,types in [('US-NJ','US',('red_light','speed_and_red_light')),('CA-AB','CA',('speed_and_red_light',))]:
            if c==country and r['camera_type'] in types and admin[region].covers(Point(lon,lat)):
                r.update(confidence='LOW',status='review',review_reason='Regional enforcement restriction; current device-specific authority required')
        key=gridkey(r);matches=[]
        longitude_cells=min(50,max(1,math.ceil(30/max(.6,111.32*abs(math.cos(math.radians(lat)))))))
        for di in (-1,0,1):
            for dj in range(-longitude_cells,longitude_cells+1):
                for prior in grid.get((c,key[1]+di,key[2]+dj),[]):
                    if any(x['source_code']==s['source_code'] and x['source_id']!=s['source_id'] for x in prior.get('camera_sources',[])):continue
                    if compatible(prior,r):matches.append((dist(prior,r),prior['canonical_id']))
        if matches:
            distance,cid=min(matches);duplicates.append({'source_id':r['canonical_id'],'canonical_id':cid,'distance_m':round(distance,3),'reason':'compatible spatial duplicate'});identities.add(identity);return
        if c in ('UA','PL'):r['status']='candidate'
        if r['confidence']=='LOW':r['status']='review'
        s['raw_payload']=clean_raw(s['raw_payload'])
        s['raw_payload_sha256']=hashlib.sha256(json.dumps(s['raw_payload'],sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()).hexdigest()
        s.update({k:r.get(k) for k in ['latitude','longitude','end_latitude','end_longitude','speed_limit','direction','direction_raw']})
        new.append(r);records.append(r);grid[key].append(r);byid[r['canonical_id']]=r;identities.add(identity)
    for path in sorted((ROOT/'master-db/raw/expansion/official').glob('*.json')):
        for r in official_records(json.loads(path.read_text())):accept(r)
    from refresh_expansion_primary import primary_maps,required,required_versions,START
    primary,primary_relations=primary_maps()
    paths=list((ROOT/'master-db/cache/expansion/osm').glob('*.json'))
    paths += [ROOT/'master-db/cache/bootstrap/osm'/(c+'.json') for c in ('RU','BY','GE','AM','AZ','IM','JE','GG','FO','GI','AX')]
    observations=collections.defaultdict(list);country_meta={}
    for path in sorted(paths):
        if not path.exists() or path.name.endswith('.error.json'):continue
        data=json.loads(path.read_text());code=data['_bootstrap']['country_code']
        observations[code].extend(data['elements'])
        if code not in country_meta or data['_bootstrap']['retrieved_at']>country_meta[code]['retrieved_at']:country_meta[code]=data['_bootstrap']
    # Resolve parent relations across all phases before accepting a device.
    # Otherwise an earlier speed-only pass could hide its combined enforcement mode.
    for code,elements in sorted(observations.items()):
        data={'_bootstrap':country_meta[code],'elements':elements}
        for r in osm_records(data,code,primary,primary_relations):
            raw=r['camera_sources'][0]['raw_payload'];tags=raw.get('tags',{})
            nodes,relations=required([r])
            versions=required_versions([r])
            for rid in relations:
                nodes.update(m['ref'] for m in primary_relations.get(rid,{}).get('members',[]) if m['type']=='node' and m.get('role') in ('from','to','device'))
            if not (all(primary.get(i,{}).get('_observed_at','')>=START and primary[i].get('visible') is not False and primary[i].get('version',0)>=versions['node'].get(i,0) for i in nodes) and all(primary_relations.get(i,{}).get('_observed_at','')>=START and primary_relations[i].get('visible') is not False and primary_relations[i].get('version',0)>=versions['relation'].get(i,0) for i in relations)) or raw.get('osm_type')=='way':
                r.update(confidence='LOW',status='review',review_reason='Current primary OSM object/explicit relation endpoints not fully verified')
            if raw.get('osm_type')=='way':
                r.update(confidence='LOW',status='review',review_reason='Way center is approximate; a precise device point is required')
            if r['camera_type']=='other_enforcement' and tags.get('enforcement') not in ('average_speed','section_control'):
                r.update(confidence='LOW',status='review',review_reason='Additional enforcement tag lacks verified speed/red-light classification')
            accept(r)
    save(BASE/'reports/dedupe.json',{'duplicate_observations':len(duplicates),'items':duplicates})
    save(BASE/'reports/rejected.json',rejected)
    cache=ROOT/'master-db/cache/expansion/new-records.json.gz';cache.write_bytes(gzip.compress(json.dumps(new,ensure_ascii=False).encode(),mtime=0))
    print('Expansion normalized',len(new),'new;',len(duplicates),'duplicates;',len(rejected),'rejected',flush=True)
    return records,new

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--normalize-only',action='store_true');parser.add_argument('--acquire',action='store_true');args=parser.parse_args()
    if args.acquire:
        from fetch_expansion_official import main as acquire_official
        from fetch_expansion_osm import acquire
        acquire_official()
        acquire()
    pipeline.BASE=BASE
    if not args.normalize_only:
        from refresh_expansion_primary import main as refresh_primary
        refresh_primary()
    records,new=normalize();pipeline.validate(records)
    if args.normalize_only:return
    # Resume safely if a previous append partially committed.
    with pipeline.connect() as conn:existing={cid for cid, in conn.execute('select canonical_id from public.camera_records')}
    pipeline.sync([r for r in new if r['canonical_id'] not in existing],append_only=True)
    actual={r['canonical_id']:r for r in actual_snapshot()}
    original=json.loads(gzip.decompress((ROOT/'master-db/backups/expansion/baseline-50141.json.gz').read_bytes()))
    for r in original:assert actual.get(r['canonical_id'])==r,'Expansion changed a baseline record: '+r['canonical_id']
    save(BASE/'reports/baseline-preservation.json',{'baseline_records':len(original),'records_compared_including_metadata':len(original),'changed':0,'deleted':0})

if __name__=='__main__':main()
