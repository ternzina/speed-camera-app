#!/usr/bin/env python3
"""Normalize real downloaded enforcement data, preserve provenance and deduplicate.

Existing production rows are immutable anchors. Unknown direction/limits stay null.
Country polygons are Natural Earth 1:10m (public domain); border uncertainty is quarantined.
"""
import collections
import datetime as dt
import gzip
import hashlib
import json
import math
import re
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from shapely.geometry import shape, Point
from fetch_osm import COUNTRIES

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'master-db/bootstrap'
NOW = dt.datetime.now(dt.timezone.utc).isoformat()
LEGACY_TYPES = {'speed_camera':'fixed_speed', 'red_light':'red_light', 'average_speed_section':'average_speed_section', 'checkpoint':'other_enforcement'}
DB_TYPES = {'fixed_speed':'speed_camera', 'red_light':'red_light', 'speed_and_red_light':'red_light',
            'average_speed_section':'average_speed_section', 'average_speed_start':'checkpoint',
            'average_speed_end':'checkpoint', 'other_enforcement':'checkpoint'}

def save(path, data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

def speed(value, mph=False):
    if value is None: return None
    s=str(value).strip().lower()
    m=re.fullmatch(r'(\d+(?:\.\d+)?)\s*(mph|km/h|kmh|kph)?',s)
    if not m: return None
    n=float(m[1])*(1.609344 if mph or m[2]=='mph' else 1)
    return round(n) if 5<=n<=200 else None

def direction(value):
    if value is None: return None
    s=str(value).strip()
    if not s: return None
    try:
        n=float(s)
        if 0<=n<=360:return n%360
    except ValueError: pass
    d={'n':0,'north':0,'northbound':0,'n/b':0,'nb':0,'ne':45,'northeast':45,'northeastbound':45,
       'e':90,'east':90,'eastbound':90,'e/b':90,'eb':90,'se':135,'southeast':135,
       's':180,'south':180,'southbound':180,'s/b':180,'sb':180,'sw':225,'southwest':225,
       'w':270,'west':270,'westbound':270,'w/b':270,'wb':270,'nw':315,'northwest':315}
    return d.get(s.lower())

def dist(a,b,end=False):
    pre='end_' if end else ''
    lat1,lon1=a.get(pre+'latitude'),a.get(pre+'longitude')
    lat2,lon2=b.get(pre+'latitude'),b.get(pre+'longitude')
    if None in (lat1,lon1,lat2,lon2):return math.inf
    p1,p2=math.radians(lat1),math.radians(lat2)
    t=math.sin((p2-p1)/2)**2+math.cos(p1)*math.cos(p2)*math.sin(math.radians(lon2-lon1)/2)**2
    return 12742000*math.asin(min(1,math.sqrt(t)))

def normtext(s):return re.sub(r'\W+','',str(s or '').casefold())

def bearing(a,b):
    p1,p2=map(math.radians,(a[0],b[0]));dl=math.radians(b[1]-a[1])
    return math.degrees(math.atan2(math.sin(dl)*math.cos(p2), math.cos(p1)*math.sin(p2)-math.sin(p1)*math.cos(p2)*math.cos(dl)))%360

def clean_raw(value):
    if isinstance(value,float) and not math.isfinite(value):return str(value)
    if isinstance(value,dict):return {k:clean_raw(v) for k,v in value.items()}
    if isinstance(value,list):return [clean_raw(v) for v in value]
    return value

def base_record(source, external_id, lat, lon, typ, raw, **kw):
    return dict(canonical_id=source['code']+':'+str(external_id),country_code=source['country_code'],
                latitude=lat,longitude=lon,camera_type=typ,speed_limit=None,direction=None,direction_raw=None,
                road_name=None,road_ref=None,city=source.get('city'),region=None,
                confidence='HIGH' if source['source_type']=='official_government' else 'MEDIUM',
                status='candidate' if source.get('historical') else 'active',
                first_seen_at=NOW,last_seen_at=source['retrieved_at'],updated_at=NOW,
                camera_sources=[dict(source_code=source['code'],source_name=source['name'],
                   source_url=source['source_url'],source_type=source['source_type'],license=source['license'],
                   license_url=source['license_url'],source_id=str(external_id),retrieved_at=source['retrieved_at'],
                   source_updated_at=kw.pop('source_updated_at',None),raw_payload=raw)],**kw)

def geometry_point(g):
    if not g:return None
    if g['type']=='Point':return g['coordinates'][:2]
    if g['type']=='MultiPoint' and len(g['coordinates'])==1:return g['coordinates'][0][:2]
    return None

def official_records(envelope, errors=None):
    source={**envelope['source'],'retrieved_at':envelope['retrieved_at']}
    data=envelope['data']
    for index,row in enumerate(data.get('features',[]) if isinstance(data,dict) else data):
        try:
            p=row.get('properties',row); adapter=source['adapter'];coords=geometry_point(row.get('geometry'))
            if adapter=='france':coords=[float(p['Longitude']),float(p['Latitude'])]
            elif adapter=='dgt':coords=[float(p['longitude'][0]),float(p['latitude'][0])]
            elif adapter=='nvdb':
                # NVDB EPSG:4326 WKT uses authority axis order: latitude, longitude.
                m=re.search(r'POINT(?: Z)?\s*\(\s*([\d.-]+)\s+([\d.-]+)',p.get('geometri',{}).get('wkt',''))
                if not m:continue
                coords=[float(m[2]),float(m[1])]
            if coords:lon,lat=coords
            else:
                try:lat,lon=float(p['latitude']),float(p['longitude'])
                except (KeyError,ValueError,TypeError):continue
            typ=source.get('camera_type','red_light');external=None;rawdir=None;limit=None;road=None;city=source.get('city');region=None;status='active'
            extra={}
            if adapter=='france':
                external=p['Numéro de radar'];t=p['Type de radar'];limit=speed(p.get('VMA'))
                typ='red_light' if t=='ETFR' else 'other_enforcement' if t in ('ETPN','ETVM') else 'fixed_speed'
                if t in ('ETT','ETU') and limit is None:
                    typ='other_enforcement';extra['possible_camera_types']=['fixed_speed','red_light','speed_and_red_light']
                    extra['classification_note']='Official turret/urban hardware can enforce speed or red-light; active mode is not specified'
                if t=='ETVM':status='review';extra['unresolved_average_speed_endpoint']=True
            elif adapter=='dgt':
                external=p['id'];road=(p.get('roadNumber') or [None])[0];rawdir=(p.get('directionRelative') or [None])[0]
                if p.get('from') and p.get('to'):
                    typ='average_speed_section';lat,lon=p['from'];extra={'end_latitude':p['to'][0],'end_longitude':p['to'][1]}
                else:typ='fixed_speed'
            elif adapter=='nvdb':
                external=p['id'];props={e['navn']:e.get('verdi') for e in p.get('egenskaper',[])}
                road=props.get('Navn');rawdir=props.get('Kontollretning') or props.get('Kontrollretning');typ='fixed_speed';limit=speed(props.get('Fartsgrense'))
                refs=p.get('lokasjon',{}).get('vegsystemreferanser',[])
                if refs:
                    vs=refs[0].get('vegsystem',{});extra['road_ref']=str(vs.get('vegkategori',''))+str(vs.get('nummer',''))
            elif adapter=='chicago':
                external=p.get('id') or p.get('location_id') or p.get('intersection')
                # One published record can monitor two approaches. Do not assume single direction.
                rawdir=';'.join(str(p[k]) for k in ['first_approach','second_approach','third_approach'] if p.get(k)) or None
                road=p.get('address') or p.get('intersection')
            elif adapter=='dc':
                external=p.get('ENFORCEMENT_SPACE_CODE') or p.get('GLOBALID')
                t=str(p.get('ENFORCEMENT_TYPE','')).lower()
                typ='speed_and_red_light' if 'red' in t and 'speed' in t else 'red_light' if 'red' in t else 'fixed_speed' if 'speed' in t else 'other_enforcement'
                limit=speed(p.get('SPEED_LIMIT'),mph=True) if 'speed' in t else None
                road=p.get('LOCATION_DESCRIPTION'); m=re.search(r'\b([NSEW]/B)\b',road or '')
                rawdir=m[1] if m else None
                if p.get('ACTIVE_STATUS')!='Active' or p.get('CAMERA_STATUS')!='Live':status='candidate'
            elif adapter=='seattle':
                external=p.get('ObjectId');t=str(p.get('Camera_Type','')).lower()
                typ='red_light' if 'red' in t else 'fixed_speed' if 'speed' in t or 'school' in t else 'other_enforcement'
                road=p.get('SPD_Camera_Name');m=re.match(r'^(NB|SB|EB|WB)\b',road or '');rawdir=m[1] if m else None
            elif adapter=='baltimore':
                external=p.get('GIS_ID') or p.get('OBJECTID');road=p.get('Location')
                approaches=re.findall(r'\b(?:NB|SB|EB|WB)\b',road or '')
                rawdir=approaches[0] if len(approaches)==1 else ';'.join(approaches) or None
                if source.get('historical') or p.get('Status') not in ('Final','Active'):status='candidate'
            elif adapter=='sfmta':
                external=p['site_id'];typ='fixed_speed';road=p.get('location');limit=speed(p.get('posted_speed'),mph=True)
                m=re.match(r'^(NB|SB|EB|WB)\b',road or '');rawdir=m[1] if m else None
                extra['source_snapshot_date']=p.get('last_date')
            elif adapter=='toronto':
                external=p.get('RLC') or p.get('ID');road=p.get('NAME');region=p.get('DISTRICT')
            elif adapter=='quebec':
                t=p.get('typeAppareil','').lower();road=p.get('description');city=p.get('municipalite');region=p.get('region')
                external=parse_qs(urlparse(p.get('urlImage','')).query).get('idSite',[None])[0]
                typ='speed_and_red_light' if 'fixe' in t and 'rouge' in t else 'red_light' if 'rouge' in t else 'fixed_speed' if 'fixe' in t else 'other_enforcement'
                if 'mobile' in t or p.get('dateFinService'):status='candidate'
            elif adapter=='edmonton':
                external=p.get('site_id');road=' '.join(str(p.get(k,'')) for k in ['approach','cross_street']);rawdir=p.get('travel_direction');limit=speed(p.get('posted_speed'));typ='red_light'
                # Alberta restricted speed-on-green. Keep posted speed as context, not proof of speed enforcement.
            elif adapter=='ottawa':
                external=(p.get('INTERSECTION','').strip()+'|'+str(p.get('CAMERA_FACING')));road=p.get('INTERSECTION');rawdir=p.get('CAMERA_FACING');status='candidate'
            if external is None:continue  # Do not create unstable row-number IDs.
            r=base_record(source,external,lat,lon,typ,p)
            r.update(direction=direction(rawdir),direction_raw=rawdir,speed_limit=limit,road_name=road,city=city,region=region,status=status,**extra)
            if extra.get('unresolved_average_speed_endpoint'):r['confidence']='LOW'
            yield r
        except (KeyError,ValueError,TypeError,IndexError) as exc:
            if errors is not None:errors.append({'source_code':source['code'],'row_index':index,'error_type':type(exc).__name__,'reason':'Malformed source record; raw retained, other rows continue'})
            continue

def osm_records(data,code,primary_nodes=None,primary_relations=None):
    meta=data['_bootstrap'];retrieved=meta['retrieved_at']
    source=dict(code='OSM_'+code,country_code=code,name='OpenStreetMap contributors ('+code+')',source_type='openstreetmap',
                license='ODbL-1.0',license_url='https://opendatacommons.org/licenses/odbl/1-0/',
                source_url='https://www.openstreetmap.org/copyright',retrieved_at=retrieved)
    # Recursive skel results duplicate nodes; retain the richer meta version.
    elements={}
    for e in data['elements']:
        key=(e['type'],e['id'])
        if key not in elements or len(e)>len(elements[key]):elements[key]=e
    for key,e in list(elements.items()):
        current=((primary_nodes or {}) if e['type']=='node' else (primary_relations or {}) if e['type']=='relation' else {}).get(e['id'])
        if current and (current.get('visible') is False or current.get('version',0)>=e.get('version',0)):elements[key]=current
    # A refreshed relation may have new, explicitly ordered endpoints/devices.
    for e in list(elements.values()):
        if e['type']=='relation' and e.get('visible') is not False:
            for m in e.get('members',[]):
                if m['type']=='node' and m.get('role') in ('device','from','to') and m['ref'] in (primary_nodes or {}):
                    elements[('node',m['ref'])]=primary_nodes[m['ref']]
    device_tags={}; device_relations={}; sections=[]
    def point(e):
        if not e or e.get('visible') is False:return None
        if 'lat' in e:return e['lat'],e['lon']
        if e.get('center'):return e['center']['lat'],e['center']['lon']
        return None
    for key,e in elements.items():
        tags=e.get('tags',{})
        relation_mode=tags.get('enforcement') or (tags.get('type') if tags.get('type') in ('average_speed','section_control') else None)
        if e['type']!='relation' or not (tags.get('type')=='enforcement' or tags.get('type') in ('average_speed','section_control') or (not tags.get('type') and relation_mode)):continue
        devices=[m for m in e.get('members',[]) if m.get('role')=='device']
        for member in devices:
            dkey=(member['type'],member['ref']);inherited=device_tags.setdefault(dkey,{})
            prior_mode=inherited.get('enforcement');inherited.update(tags)
            if prior_mode and tags.get('enforcement') and prior_mode!=tags['enforcement']:
                inherited['enforcement']=';'.join(sorted(set(prior_mode.split(';'))|set(tags['enforcement'].split(';'))))
            device_relations.setdefault(dkey,[]).append(e['id'])
        if set((relation_mode or '').split(';')) & {'average_speed','section_control'}:
            endpoints={}
            for role in ('from','to'):
                nodes=[elements.get((m['type'],m['ref'])) for m in e.get('members',[]) if m.get('role')==role and m['type']=='node']
                if len(nodes)==1 and point(nodes[0]):endpoints[role]=point(nodes[0])
            if len(endpoints)==2:
                a,b=endpoints['from'],endpoints['to'];r=base_record(source,'relation/'+str(e['id']),a[0],a[1],'average_speed_section',{'tags':tags,'members':e.get('members'),'osm_relation':e['id'],'osm_version':e.get('version')},source_updated_at=e.get('timestamp'))
                r.update(end_latitude=b[0],end_longitude=b[1],direction=direction(tags.get('direction')),direction_raw=tags.get('direction'),speed_limit=speed(tags.get('maxspeed')),road_ref=tags.get('ref'),road_name=tags.get('name'))
                r['camera_sources'][0]['source_url']='https://www.openstreetmap.org/relation/'+str(e['id'])
                if tags.get('disused:highway') or tags.get('disused')=='yes' or tags.get('operational_status') in ('inactive','removed') or tags.get('construction')=='yes':r['status']='candidate'
                sections.append(r)
    yield from sections
    for key,e in elements.items():
        tags={**device_tags.get(key,{}),**e.get('tags',{})};coords=point(e)
        enforcement=tags.get('enforcement','')
        alias=tags.get('camera:enforcement') or tags.get('camera:type')
        if not enforcement:
            if alias in ('speed','red_light','average_speed','section_control'):enforcement=alias
            elif tags.get('traffic_signals:red_light_camera')=='yes' or tags.get('red_light_camera')=='yes':enforcement='red_light'
            elif tags.get('speed_camera')=='yes' or tags.get('surveillance:type')=='speed_camera':enforcement='speed'
        if not coords or (tags.get('highway')!='speed_camera' and key not in device_tags and not enforcement):continue
        if e['type']=='relation' and (tags.get('type') in ('enforcement','average_speed','section_control') or (not tags.get('type') and enforcement)):continue # devices emitted once; sections separately
        modes=set(enforcement.split(';'));is_red=bool(modes & {'red_light','redlight','red_light_camera','traffic_signals','traffic_lights'}) or 'red' in enforcement
        is_speed=tags.get('highway')=='speed_camera' or bool(modes & {'speed','maxspeed','speed_camera'})
        if modes & {'average_speed','section_control'}:
            typ='other_enforcement' # unresolved endpoint roles are not invented
        elif is_red and is_speed:typ='speed_and_red_light'
        elif is_red:typ='red_light'
        elif is_speed:typ='fixed_speed'
        else:typ='other_enforcement'
        external=e['type']+'/'+str(e['id']);raw={'tags':tags,'node_tags':e.get('tags',{}),'enforcement_relations':[{'id':rid,'version':elements[('relation',rid)].get('version'),'timestamp':elements[('relation',rid)].get('timestamp'),'tags':elements[('relation',rid)].get('tags',{})} for rid in device_relations.get(key,[])],'osm_id':e['id'],'osm_type':e['type'],'osm_version':e.get('version'),'osm_last_modified':e.get('timestamp'),'relations':device_relations.get(key,[])}
        r=base_record({**source,'retrieved_at':e.get('_observed_at') or retrieved},external,coords[0],coords[1],typ,raw,source_updated_at=e.get('timestamp'))
        rawdir=tags.get('direction') # camera:direction describes optical facing, not necessarily traffic travel
        r.update(direction=direction(rawdir),direction_raw=rawdir,speed_limit=speed(tags.get('maxspeed')),road_name=tags.get('addr:street') or tags.get('name'),road_ref=tags.get('ref'),city=tags.get('addr:city'),region=tags.get('addr:state'))
        r['camera_sources'][0]['source_url']='https://www.openstreetmap.org/'+external
        if tags.get('camera:type')=='mobile' or tags.get('mobile')=='yes' or tags.get('disused:highway') or tags.get('disused')=='yes' or tags.get('operational_status') in ('inactive','removed') or tags.get('construction')=='yes':r['status']='candidate'
        if modes & {'average_speed','section_control'}:r.update(confidence='LOW',status='review')
        yield r

def compatible(a,b):
    if a['camera_type']!=b['camera_type']:
        explicit_possible=(a['camera_type']=='other_enforcement' and b['camera_type'] in a.get('possible_camera_types',[])) or (b['camera_type']=='other_enforcement' and a['camera_type'] in b.get('possible_camera_types',[]))
        if not explicit_possible or dist(a,b)>5:return False
    if a.get('speed_limit') and b.get('speed_limit') and a['speed_limit']!=b['speed_limit']:return False
    if a.get('direction') is not None and b.get('direction') is not None:
        d=abs(a['direction']-b['direction'])%360
        if min(d,360-d)>25:return False
    if a.get('direction_raw') and b.get('direction_raw') and (a.get('direction') is None or b.get('direction') is None):
        if normtext(a['direction_raw'])!=normtext(b['direction_raw']):return False
    if a.get('road_ref') and b.get('road_ref') and normtext(a['road_ref'])!=normtext(b['road_ref']):return False
    if a['camera_type']=='average_speed_section':
        return dist(a,b)<=20 and dist(a,b,end=True)<=20 and a.get('direction') is not None and b.get('direction') is not None
    # Direction missing on either side: require extremely close coordinates.
    radius=30 if a.get('direction') is not None and b.get('direction') is not None else 5
    return dist(a,b)<=radius

def reconcile_snapshots(records,previous):
    """Keep stable source identities, first_seen and missing observations without deletes."""
    old_by_id={r['canonical_id']:r for r in previous if not r.get('protected_existing')}
    old_sources={(s['source_code'],s['source_id']):r['canonical_id'] for r in old_by_id.values() for s in r['camera_sources']}
    used={r['canonical_id'] for r in records if r.get('protected_existing')}
    seen={(s['source_code'],s['source_id']) for r in records for s in r['camera_sources']}
    missing=[]
    for r in records:
        if r.get('protected_existing'):continue
        primary=r['camera_sources'][0]
        previous_id=old_sources.get((primary['source_code'],primary['source_id']),r['canonical_id'])
        if previous_id not in used:r['canonical_id']=previous_id
        if r['canonical_id'] in used:raise ValueError('canonical identity collision after reconciliation')
        used.add(r['canonical_id'])
        old=old_by_id.get(r['canonical_id'])
        if old:
            r['first_seen_at']=old['first_seen_at']
            for source in old['camera_sources']:
                key=(source['source_code'],source['source_id'])
                if key not in seen:
                    r['camera_sources'].append({**source,'source_status':'missing_source'})
                    seen.add(key);missing.append({'canonical_id':r['canonical_id'],'source_code':key[0],'source_id':key[1]})
        observed=[x['retrieved_at'] for x in r['camera_sources'] if x.get('source_status')!='missing_source']
        if observed:r['last_seen_at']=max(observed)
    for cid,old in old_by_id.items():
        if cid in used:continue
        unobserved=[x for x in old['camera_sources'] if (x['source_code'],x['source_id']) not in seen]
        if unobserved:
            retained={**old,'status':'missing_source' if old['status'] in ('active','missing_source') else old['status'],
                      'camera_sources':[{**x,'source_status':'missing_source'} for x in unobserved]}
            for source in unobserved:
                key=(source['source_code'],source['source_id']);seen.add(key)
                missing.append({'canonical_id':cid,'source_code':key[0],'source_id':key[1]})
        else:
            # All observations now belong to another canonical record. Preserve history,
            # stop publishing the obsolete alias, and do not steal source links back.
            retained={**old,'status':'candidate','camera_sources':[],
                      'historical_provenance':old.get('historical_provenance') or old['camera_sources'] or old.get('provenance',[]),'superseded_by_dedupe':True}
        records.append(retained)
    return missing

def main():
    primary_nodes={}
    for path in (ROOT/'master-db/cache/osm-api').rglob('nodes-*.json'):
        observed=dt.datetime.fromtimestamp(path.stat().st_mtime,dt.timezone.utc).isoformat()
        for e in json.loads(path.read_text()):
            current=primary_nodes.get(e['id'])
            if current is None or (e.get('version',0),observed)>(current.get('version',0),current['_observed_at']):primary_nodes[e['id']]={**e,'_observed_at':observed}
    previous=[]
    for path in (ROOT/'master-db/cache/bootstrap/normalized').glob('*.json.gz'):
        previous.extend(json.loads(gzip.decompress(path.read_bytes())))
    polygons={}
    for f in json.loads((ROOT/'master-db/cache/bootstrap/countries.geojson').read_text())['features']:
        code=f['properties'].get('ISO3166-1-Alpha-2')
        code={'France':'FR','Norway':'NO','Kosovo':'XK'}.get(f['properties']['name'],code)
        if code and code!='-99':polygons[code]=shape(f['geometry'])
    ontario_path=ROOT/'master-db/cache/bootstrap/ontario.geojson'
    ontario=shape(json.loads(ontario_path.read_text())['features'][0]['geometry']) if ontario_path.exists() else None
    admin_path=ROOT/'master-db/cache/bootstrap/admin1.geojson'
    reviewed_regions={}
    if admin_path.exists():
        reviewed_regions={f['properties'].get('iso_3166_2'):shape(f['geometry']) for f in json.loads(admin_path.read_text())['features'] if f['properties'].get('iso_3166_2') in ('US-NJ','CA-AB')}
    policy_reviews=[]
    stats={c:dict(country_name=n,existing_before=0,official_found=0,osm_found=0,other_found=0,duplicates_merged=0,new_candidates=0,high_confidence=0,medium_confidence=0,low_confidence=0,with_speed_limit=0,with_direction=0,with_raw_direction=0,average_speed_sections=0,final_total=0,quarantined=0) for c,n in COUNTRIES.items()}
    records=[];grid=collections.defaultdict(list);sources=[];rejected=[];merges=[];conflicts=[];parse_errors=[]
    def gridkey(r):return r['country_code'],math.floor(r['latitude']/.001),math.floor(r['longitude']/.001)
    for b in json.loads((ROOT/'master-db/backups/pre-bootstrap-20261007/baseline-records.json').read_text()):
        r={**b,'camera_type':LEGACY_TYPES[b['record_type']],'direction':direction(b['direction_code']),
           'direction_raw':b.get('direction_code') or b.get('direction_name'),'road_ref':b.get('road'),'road_name':None,
           'city':b.get('locality'),'status':'active' if b['active'] else 'candidate','confidence':b['confidence'].upper(),
           'last_seen_at':b.get('updated_at'),'camera_sources':[],'protected_existing':True}
        records.append(r);grid[gridkey(r)].append(len(records)-1);stats[r['country_code']]['existing_before']+=1
    def accept(r):
        c=r['country_code'];lat,lon=r['latitude'],r['longitude']
        if not isinstance(lat,(float,int)) or not isinstance(lon,(float,int)) or not (-90<=lat<=90 and -180<=lon<=180) or (lat==lon==0):
            rejected.append(dict(id=r['canonical_id'],reason='invalid coordinates'));return
        polygon=polygons.get(c)
        if not polygon or not polygon.covers(Point(lon,lat)):
            # Envelope queries include neighbouring countries: discard non-country OSM rows.
            if r['camera_sources'][0]['source_type']=='openstreetmap':return
            r.update(confidence='LOW',status='review');stats[c]['quarantined']+=1
        source=r['camera_sources'][0]
        if c=='CA' and source['source_type']=='openstreetmap' and r['camera_type'] in ('fixed_speed','speed_and_red_light','average_speed_start','average_speed_end','average_speed_section'):
            if ontario is None:raise ValueError('Ontario boundary required for current enforcement policy review')
            if ontario.covers(Point(lon,lat)):
                r.update(confidence='LOW',status='review',review_reason='Ontario municipal ASE authority ended 2025-11-14; OSM-only speed enforcement needs current authoritative confirmation',review_source_url='https://www.ontario.ca/page/reducing-speeding-real-time',policy_checked_at='2026-10-07')
                policy_reviews.append({'canonical_id':r['canonical_id'],'reason':r['review_reason'],'source_url':r['review_source_url']})
        source['raw_payload']=clean_raw(source['raw_payload'])
        source['raw_payload_sha256']=hashlib.sha256(json.dumps(source['raw_payload'],sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()).hexdigest()
        source.update({k:r.get(k) for k in ['latitude','longitude','end_latitude','end_longitude','speed_limit','direction','direction_raw']})
        category='osm_found' if source['source_type']=='openstreetmap' else 'official_found'
        stats[c][category]+=1
        if r['speed_limit'] is not None and not 5<=r['speed_limit']<=200:raise ValueError('invalid speed')
        if r['camera_type']=='average_speed_section':
            length=dist(r,{'latitude':r['end_latitude'],'longitude':r['end_longitude']})
            r['section_endpoint_distance_m']=round(length,1)
            invalid_end=not (-90<=r['end_latitude']<=90 and -180<=r['end_longitude']<=180) or (r['end_latitude'],r['end_longitude'])==(0,0)
            if invalid_end:
                r.update(camera_type='other_enforcement',end_latitude=None,end_longitude=None)
                source.update(end_latitude=None,end_longitude=None)
            if invalid_end or not polygon.covers(Point(r['end_longitude'],r['end_latitude'])) or not 50<=length<=200000:
                r.update(confidence='LOW',status='review',review_reason='Section endpoints outside country or implausible endpoint distance')
        key=gridkey(r);matches=[];disagreements=[]
        longitude_cells=min(50,max(1,math.ceil(30/max(.6,111.32*abs(math.cos(math.radians(lat)))))))
        for di in (-1,0,1):
            for dj in range(-longitude_cells,longitude_cells+1):
                for i in grid.get((c,key[1]+di,key[2]+dj),[]):
                    prior=records[i]
                    # Different source IDs in the same feed may be different lanes/devices.
                    if any(s['source_code']==source['source_code'] and s['source_id']!=source['source_id'] for s in prior['camera_sources']):continue
                    if compatible(prior,r):matches.append((dist(prior,r),i))
                    elif source['source_type']=='openstreetmap' and prior['confidence']=='HIGH' and prior['camera_type']==r['camera_type'] and dist(prior,r)<=5 and prior.get('speed_limit') and r.get('speed_limit') and prior['speed_limit']!=r['speed_limit']:
                        headings=[prior.get('direction'),r.get('direction')]
                        same_heading=None in headings or min(abs(headings[0]-headings[1])%360,360-abs(headings[0]-headings[1])%360)<=25
                        raw_compatible=not(prior.get('direction_raw') and r.get('direction_raw')) or (None not in headings) or normtext(prior['direction_raw'])==normtext(r['direction_raw'])
                        if same_heading and raw_compatible:disagreements.append(prior['canonical_id'])
        if matches:
            _,i=min(matches);target=records[i]
            if not any(s['source_code']==source['source_code'] and s['source_id']==source['source_id'] for s in target['camera_sources']):
                target['camera_sources'].extend(r['camera_sources']);stats[c]['duplicates_merged']+=1
                merges.append(dict(country_code=c,canonical_id=target['canonical_id'],source_id=r['canonical_id'],distance_m=round(dist(target,r),3)))
            if not target.get('protected_existing'):
                if target['camera_type']=='other_enforcement' and r['camera_type'] in target.get('possible_camera_types',[]):
                    target['camera_type']=r['camera_type'];target['classification_source']=source['source_code']+':'+source['source_id']
                if r['confidence']=='HIGH':target['confidence']='HIGH'
                # Preserve earlier authoritative coordinates; do not average them.
                for field in ['speed_limit','direction','direction_raw','road_ref','road_name','city','region']:
                    if target.get(field) is None:target[field]=r.get(field)
            return
        if disagreements:
            r.update(confidence='LOW',status='review',review_reason='Speed disagreement with a very close authoritative record; identity/lane unresolved',conflicting_records=disagreements)
            conflicts.append({'canonical_id':r['canonical_id'],'official_records':disagreements,'reason':r['review_reason']})
        if c in ('UA','PL'):r['status']='candidate' # current app exports stay unchanged
        stats[c]['new_candidates']+=1
        records.append(r);grid[key].append(len(records)-1)
    for path in sorted((ROOT/'master-db/raw/official').glob('*.json')):
        envelope=json.loads(path.read_text());sources.append({**envelope['source'],'retrieved_at':envelope['retrieved_at']})
        for r in official_records(envelope,parse_errors):accept(r)
    osm_files=list((ROOT/'master-db/cache/bootstrap/osm').glob('*.json'))
    for path in sorted(osm_files):
        if '.error.' in path.name:continue
        data=json.loads(path.read_text());code=path.stem
        if 'remark' in data or '_bootstrap' not in data:continue
        sources.append(dict(code='OSM_'+code,country_code=code,name='OpenStreetMap contributors ('+code+')',source_type='openstreetmap',license='ODbL-1.0',license_url='https://opendatacommons.org/licenses/odbl/1-0/',source_url='https://www.openstreetmap.org/copyright',retrieved_at=data['_bootstrap']['retrieved_at']))
        for r in osm_records(data,code,primary_nodes):accept(r)
    missing=reconcile_snapshots(records,previous)
    for r in records:
        if r['country_code']=='CA' and r['camera_type'] in ('fixed_speed','speed_and_red_light','average_speed_start','average_speed_end','average_speed_section') and ontario is not None and ontario.covers(Point(r['longitude'],r['latitude'])) and not any(x['source_type']!='openstreetmap' for x in r['camera_sources']):
            r.update(confidence='LOW',status='review',review_reason='Ontario municipal ASE authority ended 2025-11-14; OSM-only speed enforcement needs current authoritative confirmation',review_source_url='https://www.ontario.ca/page/reducing-speeding-real-time',policy_checked_at='2026-10-07')
        if not r.get('protected_existing') and r['camera_sources'] and all(x['source_type']=='openstreetmap' for x in r['camera_sources']):
            rules=[('US-NJ','US',('red_light','speed_and_red_light'),'NJDOT ended automated red-light pilot and directed disconnection; OSM-only device requires current authority confirmation','https://www.nj.gov/transportation/refdata/rlr/'),
                   ('CA-AB','CA',('speed_and_red_light',),'Alberta restricted speed-on-green from April 2025; individual approved exceptions exist and require authoritative device confirmation','https://www.camrosepolice.ca/reactivation-of-isds-at-68-street-and-48-avenue/')]
            for region,country,types,reason,url in rules:
                if r['country_code']==country and r['camera_type'] in types and region in reviewed_regions and reviewed_regions[region].covers(Point(r['longitude'],r['latitude'])):
                    r.update(confidence='LOW',status='review',review_reason=reason,review_source_url=url,policy_checked_at='2026-10-07')
                    policy_reviews.append({'canonical_id':r['canonical_id'],'reason':reason,'source_url':url})
    for r in records:
        if r.get('protected_existing') or not r['camera_sources'] or any(x['source_type']!='openstreetmap' for x in r['camera_sources']):continue
        for source in r['camera_sources']:
            if not source['source_id'].startswith('node/'):continue
            current=primary_nodes.get(int(source['source_id'].split('/')[1]));raw=source['raw_payload']
            if current and (current.get('version') or 0)>(raw.get('osm_version') or 0) and not raw.get('relations') and current.get('tags',{}).get('highway')!='speed_camera' and not current.get('tags',{}).get('enforcement'):
                r.update(confidence='LOW',status='review',review_reason='Newer authoritative OSM node version no longer confirms enforcement; historical observation retained',review_source_url=source['source_url'],primary_api_review={'version':current.get('version'),'timestamp':current.get('timestamp'),'tags':current.get('tags',{})})
                policy_reviews.append({'canonical_id':r['canonical_id'],'reason':r['review_reason'],'source_url':source['source_url']})
    save(BASE/'reports/policy-reviews.json',policy_reviews)
    save(BASE/'reports/missing-observations.json',missing)
    for r in records:
        st=stats[r['country_code']];st['final_total']+=1;st[r['confidence'].lower()+'_confidence']+=1
        st['with_speed_limit']+=r.get('speed_limit') is not None;st['with_direction']+=r.get('direction') is not None
        st['with_raw_direction']+=bool(r.get('direction_raw'))
        st['average_speed_sections']+=r['camera_type']=='average_speed_section'
    bycountry=collections.defaultdict(list)
    for r in records:bycountry[r['country_code']].append(r)
    directory=ROOT/'master-db/cache/bootstrap/normalized';directory.mkdir(parents=True,exist_ok=True)
    for c,rs in sorted(bycountry.items()):
        raw=json.dumps(rs,ensure_ascii=False,separators=(',',':')).encode()
        (directory/(c+'.json.gz')).write_bytes(gzip.compress(raw,mtime=0))
    save(BASE/'source-registry.json',sources)
    save(BASE/'reports/country-statistics.json',stats)
    save(BASE/'reports/dedupe-merges.json',merges)
    save(BASE/'reports/rejected.json',rejected)
    save(BASE/'reports/source-conflicts.json',conflicts)
    save(BASE/'reports/source-parse-errors.json',parse_errors)
    sample=[]
    for c in sorted(bycountry):
        new=[r for r in bycountry[c] if not r.get('protected_existing')]
        for r in new[:2]:sample.append({k:v for k,v in r.items() if k!='camera_sources'}|{'sources':[{k:v for k,v in s.items() if k!='raw_payload'} for s in r['camera_sources']]})
    save(BASE/'reports/sample-checks.json',sample)
    print('Normalized',len(records),'records across',len(bycountry),'countries;',len(merges),'merged;',len(sample),'samples')
    return records

if __name__=='__main__':main()
