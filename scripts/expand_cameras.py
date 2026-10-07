#!/usr/bin/env python3
"""Append coverage using the existing importer; never rewrite baseline cameras.

Downloads and snapshots stay inside master-db. Re-running is safe: source IDs
and conservative spatial deduplication include the actual production database.
"""
import argparse,collections,datetime,gzip,hashlib,json,math,sys,time
from pathlib import Path
from shapely.geometry import shape,Point
import update_cameras as pipeline
from bootstrap_cameras import osm_records,compatible,dist,clean_raw,save
from fetch_expansion_official import records as official_records
from source_identity import source_identity,distinct_same_source_devices,verified_aliases

ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'master-db/expansion'
FIELDS=['canonical_id','country_code','camera_type','latitude','longitude','end_latitude','end_longitude','speed_limit','direction_code','active','confidence','status','metadata']
OSM_INPUT_SNAPSHOT=None
OFFICIAL_INPUT_SNAPSHOT=None

def texas_authorization_review(record, polygon):
    """OSM position alone cannot establish a surviving grandfathered contract."""
    from shapely.geometry import Point
    return (record['country_code']=='US' and record['camera_type'] in ('red_light','speed_and_red_light')
            and polygon.covers(Point(record['longitude'],record['latitude']))
            and not any(s.get('source_type')=='official_government' for s in record.get('camera_sources',[])))

def observation_priority(record):
    """Resolve newly acquired evidence before ambiguous candidates, leaving anchors intact."""
    return (record.get('status') not in ('active','missing_source'),
            {'HIGH':0,'MEDIUM':1,'LOW':2}.get(record.get('confidence'),3),
            record['camera_type']=='other_enforcement',
            not any(s.get('source_type')=='official_government' for s in record.get('camera_sources',[])),
            record['canonical_id'])

def actual_snapshot(exclude=None):
    query='select '+','.join(FIELDS)+' from public.camera_records'
    if exclude:query+=' where not (canonical_id=any(%s))'
    for attempt in range(3):
        try:
            with pipeline.connect() as conn:
                with conn.cursor(name='coverage_operational_snapshot') as cursor:
                    cursor.itersize=2000
                    cursor.execute(query+' order by canonical_id',(list(exclude),) if exclude else None)
                    rows=[]
                    for row in cursor:
                        rows.append(dict(zip(FIELDS,row)))
                        if len(rows)%20000==0:print('Operational snapshot read',len(rows),flush=True)
                    return rows
        except pipeline.psycopg.OperationalError:
            # Retry only this read; never replay a failed mutation here.
            if attempt==2:raise
            time.sleep(2**attempt)

def nearby_ambiguity(a,b):
    """Hold unresolved cross-source disagreements, preserving explicit paired devices."""
    distance=dist(a,b)
    if distance>30 or distinct_same_source_devices(a,b):return None
    headings=(a.get('direction'),b.get('direction'))
    if None not in headings:
        delta=abs(headings[0]-headings[1])%360
        if min(delta,360-delta)>25:return None
    if a['camera_type']==b['camera_type']=='average_speed_section' and dist(a,b,end=True)>30:return None
    # Korea's speed/signal standard and OSM may describe one combined device
    # with different capabilities. Unknown bearings do not prove separate poles.
    korean=any(s.get('source_code')=='KR_DATA_GO_STANDARD' for r in (a,b) for s in r.get('camera_sources',[]))
    if korean and None in headings and {a['camera_type'],b['camera_type']}=={'fixed_speed','red_light'}:
        return 'Nearby Korean speed/signal cross-source points may describe a combined device; separate physical identity unresolved'
    if a['camera_type']==b['camera_type']:
        from bootstrap_cameras import normtext
        if a.get('speed_limit') and b.get('speed_limit') and a['speed_limit']!=b['speed_limit']:
            return 'Nearby cross-source camera with conflicting speed metadata; distinct physical device not verified'
        if a.get('road_ref') and b.get('road_ref') and normtext(a['road_ref'])!=normtext(b['road_ref']):
            return 'Nearby cross-source camera with conflicting road metadata; distinct physical device not verified'
    if distance>5:
        if a['camera_type']==b['camera_type'] and None in headings:
            return 'Nearby cross-source camera with unknown heading; distinct physical device not verified'
        capabilities={'fixed_speed':{'speed'},'red_light':{'red_light'},'speed_and_red_light':{'speed','red_light'}}
        if a['camera_type']!=b['camera_type'] and capabilities.get(a['camera_type'],set()) & capabilities.get(b['camera_type'],set()):
            return 'Nearby cross-source camera with overlapping enforcement capability; distinct physical device not verified'
        return None
    capabilities={'fixed_speed':{'speed'},'red_light':{'red_light'},'speed_and_red_light':{'speed','red_light'}}
    if not (capabilities.get(a['camera_type'],set()) & capabilities.get(b['camera_type'],set())):return None
    if a['camera_type']!=b['camera_type']:return 'Nearby known camera with conflicting enforcement type; distinct device not verified'
    if None in headings and a.get('direction_raw') and b.get('direction_raw'):
        from bootstrap_cameras import normtext
        if normtext(a['direction_raw'])!=normtext(b['direction_raw']):return 'Nearby known camera with unresolved direction disagreement; distinct device not verified'
    return None

def normalize():
    from cold_storage_pipeline import enabled,master
    if enabled():byid={r['canonical_id']:r for r in master()}
    else:
        baseline=json.loads(gzip.decompress((ROOT/'master-db/backups/expansion/normalized-50141.json.gz').read_bytes()))
        byid={r['canonical_id']:r for r in baseline}
        for row in actual_snapshot(exclude=byid):
            meta=row['metadata'];byid[row['canonical_id']]={**meta,'camera_sources':meta.get('provenance',[])}
    anchors=list(byid.values());records=anchors.copy();new=[];duplicates=[];rejected=[]
    aliases=verified_aliases(anchors)
    grid=collections.defaultdict(list);identities=set()
    def gridkey(r):return r['country_code'],math.floor(r['latitude']/.001),math.floor(r['longitude']/.001)
    for r in anchors:
        grid[gridkey(r)].append(r)
        for s in r.get('camera_sources',[]):identities.add(source_identity(s))
    polygons={}
    for f in json.loads((ROOT/'master-db/cache/bootstrap/countries.geojson').read_text())['features']:
        c={'France':'FR','Norway':'NO','Kosovo':'XK','Taiwan':'TW'}.get(f['properties']['name'],f['properties'].get('ISO3166-1-Alpha-2'))
        if c and c!='-99':polygons[c]=shape(f['geometry'])
    ontario=shape(json.loads((ROOT/'master-db/cache/bootstrap/ontario.geojson').read_text())['features'][0]['geometry'])
    admin_features=json.loads((ROOT/'master-db/cache/bootstrap/admin1.geojson').read_text())['features']
    admin={f['properties'].get('iso_3166_2'):shape(f['geometry']) for f in admin_features if f['properties'].get('iso_3166_2') in ('US-NJ','CA-AB','US-TX')}
    # Independent high-resolution subdivisions include offshore islands omitted
    # by the country layer. No point buffering or address-based inference.
    from shapely.ops import unary_union
    polygons['TW']=unary_union([polygons['TW']]+[shape(f['geometry']) for f in admin_features if f['properties'].get('adm0_a3')=='TWN'])
    collected=[];pending=[]
    global OFFICIAL_INPUT_SNAPSHOT
    if OFFICIAL_INPUT_SNAPSHOT is None:
        OFFICIAL_INPUT_SNAPSHOT={p:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((ROOT/'master-db/raw/expansion/official').glob('*.json'))}
    # Source observations are staged in memory, archived and read back before
    # identity/spatial deduplication or any operational write.
    if enabled():
        from r2_archive import archive_files,dataset
        raw_paths=list((ROOT/'master-db/raw/expansion/official-payloads').rglob('*'))+list(OFFICIAL_INPUT_SNAPSHOT)+list((ROOT/'master-db/cache/expansion/osm').glob('*.json'))+list((ROOT/'master-db/raw/osm-seeds').glob('*.csv'))+list((ROOT/'master-db/cache/bootstrap/osm').glob('*.json'))
        archive_files([p for p in raw_paths if p.is_file() and not p.name.endswith('.error.json')])
        archive_files([ROOT/'master-db/cache/bootstrap'/name for name in ('countries.geojson','admin1.geojson','ontario.geojson')])
    def accept(r):
        collected.append(r)
        r['_import_disposition']='observed'
        s=r['camera_sources'][0];identity=source_identity(s);c=r['country_code']
        if identity in aliases:
            r['_import_disposition']='duplicate_geometry'
            duplicates.append({'source_id':r['canonical_id'],'canonical_id':aliases[identity],'reason':'verified cross-source device alias'});return
        if identity in identities or r['canonical_id'] in byid:
            r['_import_disposition']='duplicate_identity'
            duplicates.append({'source_id':r['canonical_id'],'reason':'existing source identity'});return
        lat,lon=r['latitude'],r['longitude'];polygon=polygons.get(c)
        if not polygon or not polygon.covers(Point(lon,lat)):
            r['_import_disposition']='rejected_country_polygon'
            rejected.append({'source_id':r['canonical_id'],'reason':'outside validated country polygon'});return
        if r['camera_type']=='average_speed_section' and (not polygon.covers(Point(r['end_longitude'],r['end_latitude'])) or not 50<=dist(r,{'latitude':r['end_latitude'],'longitude':r['end_longitude']})<=200000):
            r.update(confidence='LOW',status='review',review_reason='Uncertain section endpoints')
        if c=='CA' and ontario.covers(Point(lon,lat)) and r['camera_type'] in ('fixed_speed','speed_and_red_light','average_speed_section'):
            r.update(confidence='LOW',status='review',review_reason='Ontario municipal ASE authority ended 2025-11-14; current authorization required')
        if texas_authorization_review(r,admin['US-TX']):
            r.update(confidence='LOW',status='review',review_reason='Texas red-light camera ban has grandfathered contract exceptions; OSM alone does not verify current operation')
        for region,country,types in [('US-NJ','US',('red_light','speed_and_red_light')),('CA-AB','CA',('speed_and_red_light',))]:
            if c==country and r['camera_type'] in types and admin[region].covers(Point(lon,lat)):
                r.update(confidence='LOW',status='review',review_reason='Regional enforcement restriction; current device-specific authority required')
        key=gridkey(r);matches=[];ambiguities=[]
        longitude_cells=min(50,max(1,math.ceil(30/max(.6,111.32*abs(math.cos(math.radians(lat)))))))
        for di in (-1,0,1):
            for dj in range(-longitude_cells,longitude_cells+1):
                for prior in grid.get((c,key[1]+di,key[2]+dj),[]):
                    if distinct_same_source_devices(prior,r):continue
                    if compatible(prior,r):matches.append((dist(prior,r),prior['canonical_id']))
                    elif reason:=nearby_ambiguity(prior,r):ambiguities.append((prior['canonical_id'],reason))
        if matches:
            r['_import_disposition']='duplicate_geometry'
            distance,cid=min(matches);duplicates.append({'source_id':r['canonical_id'],'canonical_id':cid,'distance_m':round(distance,3),'reason':'compatible spatial duplicate'});identities.add(identity);return
        if ambiguities:r.update(confidence='LOW',status='review',review_reason=ambiguities[0][1],nearby_review_ids=sorted({cid for cid,_ in ambiguities}))
        if c in ('UA','PL'):r['status']='candidate'
        if r['confidence']=='LOW':r['status']='review'
        s['raw_payload']=clean_raw(s['raw_payload'])
        s['raw_payload_sha256']=hashlib.sha256(json.dumps(s['raw_payload'],sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()).hexdigest()
        s.update({k:r.get(k) for k in ['latitude','longitude','end_latitude','end_longitude','speed_limit','direction','direction_raw']})
        r['_import_disposition']='accepted'
        new.append(r);records.append(r);grid[key].append(r);byid[r['canonical_id']]=r;identities.add(identity)
    for path,digest in OFFICIAL_INPUT_SNAPSHOT.items():
        raw_input=path.read_bytes()
        assert hashlib.sha256(raw_input).hexdigest()==digest,'Official source changed during import; retry from a fresh snapshot'
        for r in official_records(json.loads(raw_input)):pending.append(r)
    from refresh_expansion_primary import primary_maps,required,required_versions,START
    primary,primary_relations=primary_maps()
    paths=list((ROOT/'master-db/cache/expansion/osm').glob('*.json'))
    paths += [ROOT/'master-db/cache/bootstrap/osm'/(c+'.json') for c in ('RU','BY','GE','AM','AZ','IM','JE','GG','FO','GI','AX','BR','AU','NZ','JP','ZA','KR','CL','AR','IR','AE','OM','UZ','IN','ID','CN','IQ','SA','KZ','TM','SG','QA','IL','KG','MY','MN','KW','TH','JO','VN','PH','NP','BH','MM','SY','LK','KH','BN','BD','LB','PK','TJ','CO','EC','UY','PE','BO','VE','PY','MX','SV','CU','GT','PA','CR','TT','EG','DZ','MA','MU','AO','CI','TN','RW','UG','KE','SN','BW','NA','TZ','PG','PS','TW','HK')]
    global OSM_INPUT_SNAPSHOT
    if OSM_INPUT_SNAPSHOT is None:
        OSM_INPUT_SNAPSHOT={p:hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.exists() and not p.name.endswith('.error.json')}
    paths=list(OSM_INPUT_SNAPSHOT)
    observations=collections.defaultdict(list);country_meta={}
    for path in sorted(paths):
        if not path.exists() or path.name.endswith('.error.json'):continue
        raw_input=path.read_bytes()
        assert hashlib.sha256(raw_input).hexdigest()==OSM_INPUT_SNAPSHOT[path],'OSM source changed during import; retry from a fresh snapshot'
        data=json.loads(raw_input);code=data['_bootstrap']['country_code']
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
            pending.append(r)
    if enabled():
        manifest,_=dataset('pre-dedupe-source-observations',pending)
        save(ROOT/'master-db/cache/coverage-stage/pre-dedupe-archive.json',manifest)
    for r in sorted(pending,key=observation_priority):accept(r)
    save(ROOT/'master-db/cache/expansion/observations.json',collected)
    save(ROOT/'master-db/cache/coverage-stage/dedupe-detail.json',duplicates)
    save(BASE/'reports/dedupe.json',{'duplicate_observations':len(duplicates),'samples':duplicates[:50]})
    save(ROOT/'master-db/cache/coverage-stage/rejected-detail.json',rejected)
    save(BASE/'reports/rejected.json',{'count':len(rejected),'samples':rejected[:50]})
    cache=ROOT/'master-db/cache/expansion/new-records.json.gz';cache.write_bytes(gzip.compress(json.dumps(new,ensure_ascii=False).encode(),mtime=0))
    print('Expansion normalized',len(new),'new;',len(duplicates),'duplicates;',len(rejected),'rejected',flush=True)
    return records,new

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--normalize-only',action='store_true');parser.add_argument('--acquire',action='store_true');parser.add_argument('--resume',action='store_true');parser.add_argument('--countries',nargs='+');args=parser.parse_args()
    if args.acquire:
        from fetch_expansion_official import main as acquire_official
        from fetch_expansion_osm import acquire
        acquire_official(refresh=not args.resume)
        acquire(countries=args.countries,resume=args.resume,refresh=not args.resume)
    pipeline.BASE=BASE
    if not args.normalize_only:
        from refresh_expansion_primary import main as refresh_primary
        refresh_primary()
    records,new=normalize();pipeline.validate(records)
    if args.normalize_only:return
    from cold_storage_pipeline import enabled,sync as cold_sync
    if enabled():
        before=actual_snapshot()
        before_bytes=json.dumps(before,sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
        before_path=ROOT/'master-db/backups/coverage-stage'/('operational-before-'+hashlib.sha256(before_bytes).hexdigest()+'.json.gz')
        before_path.parent.mkdir(parents=True,exist_ok=True)
        before_path.write_bytes(gzip.compress(before_bytes,mtime=0))
        cold_sync(new,observations=json.loads((ROOT/'master-db/cache/expansion/observations.json').read_text()),raw_paths=[p for directory in ['master-db/raw/expansion/official','master-db/raw/expansion/official-payloads','master-db/cache/expansion/osm','master-db/cache/osm-api','master-db/cache/expansion/current-relations','master-db/cache/expansion/parent-memberships','master-db/backups/source-refresh','master-db/raw/osm-seeds','master-db/raw/coverage-stage','master-db/cache/bootstrap/osm'] for p in (ROOT/directory).rglob('*') if p.is_file() and p.suffix in ('.json','.csv','.xlsx','.html','.xml','.zip','.kmz','.ttl','.rdf','.txt')]+[before_path]+[ROOT/'master-db/cache/bootstrap'/name for name in ('countries.geojson','admin1.geojson','ontario.geojson')])
        after={r['canonical_id']:r for r in actual_snapshot()}
        assert all(after.get(r['canonical_id'])==r for r in before),'Existing operational row changed'
        save(BASE/'reports/baseline-preservation.json',{'baseline_records':len(before),'changed':0,'deleted':0})
        return
    # Legacy-only resume lookup; R2-first already checks the archived master.
    with pipeline.connect() as conn:existing={cid for cid, in conn.execute('select canonical_id from public.camera_records')}
    pipeline.sync([r for r in new if r['canonical_id'] not in existing],append_only=True)
    actual={r['canonical_id']:r for r in actual_snapshot()}
    original=json.loads(gzip.decompress((ROOT/'master-db/backups/expansion/baseline-50141.json.gz').read_bytes()))
    for r in original:assert actual.get(r['canonical_id'])==r,'Expansion changed a baseline record: '+r['canonical_id']
    save(BASE/'reports/baseline-preservation.json',{'baseline_records':len(original),'records_compared_including_metadata':len(original),'changed':0,'deleted':0})

if __name__=='__main__':
    # Primary refresh imports normalize; share the same frozen source set.
    sys.modules['expand_cameras']=sys.modules[__name__]
    main()
