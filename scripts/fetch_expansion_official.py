#!/usr/bin/env python3
"""Licensed, paginated government feeds used by the existing Master DB pipeline."""
import concurrent.futures, csv, datetime, io, json, re, time
from xml.etree import ElementTree as ET
from pathlib import Path
from public_download import get
from bootstrap_cameras import base_record, direction, speed

ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'master-db/raw/expansion/official'
CONFIG=ROOT/'master-db/expansion/sources.json'

def csv_rows(content,source):
    rows=[]
    for p in csv.DictReader(io.StringIO(content.decode(source.get('encoding','utf-8-sig'))),delimiter=source.get('delimiter',';')):
        lon=p.get(source['longitude_field']);lat=p.get(source['latitude_field'])
        if not lat or not lon:continue
        rows.append({'type':'Feature','geometry':{'type':'Point','coordinates':[float(lon.replace(',','.')),float(lat.replace(',','.'))]},'properties':p})
    return rows

def download(source):
    path=RAW/(source['code']+'.json');RAW.mkdir(parents=True,exist_ok=True)
    if path.exists():
        cached=json.loads(path.read_text())
        assert cached['source']['download_url']==source['download_url'],'Source URL changed; a fresh acquisition is required'
        if cached['source']!=source:
            cached['source']=source
            path.write_text(json.dumps(cached,ensure_ascii=False))
        return cached
    url=source['download_url'];rows=[]
    if source['format']=='arcgis':
        response=get(url+'/query',params={'f':'json','where':'1=1','returnIdsOnly':'true'},timeout=60)
        response.raise_for_status();ids=response.json().get('objectIds')
        if ids is None:raise ValueError('ArcGIS object ID listing failed: '+source['code'])
        for offset in range(0,len(ids),200):
            response=get(url+'/query',params={'f':'geojson','objectIds':','.join(map(str,ids[offset:offset+200])),'outFields':'*','outSR':4326},timeout=60)
            response.raise_for_status();page=response.json()
            if 'features' not in page or page.get('exceededTransferLimit'):raise ValueError('Incomplete GIS page')
            rows.extend(page['features'])
        if len(rows)!=len(ids):raise ValueError('Incomplete GIS acquisition')
    elif source['format']=='csv':
        response=get(url,timeout=60);response.raise_for_status()
        rows=csv_rows(response.content,source)
    elif source['format']=='datex':
        response=get(url,timeout=60);response.raise_for_status();root=ET.fromstring(response.content)
        for item in root.findall('{*}trafficEquipment'):
            names=[n.findtext('{*}value') for n in item.findall('{*}equipmentName') if n.findtext('{*}lang')=='en']
            lat=item.findtext('.//{*}latitude');lon=item.findtext('.//{*}longitude')
            if not lat or not lon:continue
            rows.append({'type':'Feature','geometry':{'type':'Point','coordinates':[float(lon),float(lat)]},'properties':{'id':item.findtext('.//{*}identifier'),'name':names[0] if names else None,'xml':ET.tostring(item,encoding='unicode'),'publication_time':root.findtext('{*}publicationTime')}})
    else:
        response=get(url,timeout=60);response.raise_for_status();data=response.json()
        rows=data.get('features',[]) if isinstance(data,dict) else data
        if source.get('count_url'):
            response=get(source['count_url'],timeout=60);response.raise_for_status()
            expected=int(ET.fromstring(response.content).get('numberOfFeatures'))
            assert len(rows)==expected,'Incomplete WFS acquisition'
    envelope={'source':source,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rows':rows}
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(envelope,ensure_ascii=False));temp.replace(path)
    print(source['code'],len(rows),'downloaded',flush=True);return envelope

def records(envelope):
    source={**envelope['source'],'retrieved_at':envelope['retrieved_at'],'source_type':'official_government'}
    for row in envelope['rows']:
        p=row.get('properties',row);g=row.get('geometry') or p.get(source.get('geometry_field',''))
        if g and g['type']=='Point':lon,lat=g['coordinates'][:2]
        elif source.get('location_field'):
            location=p.get(source['location_field'],{})
            if not location or location.get('latitude') is None:continue
            lat,lon=float(location['latitude']),float(location['longitude'])
        else:continue
        if source.get('filter') and any(str(p.get(k,''))!=v for k,v in source['filter'].items()):continue
        external='|'.join(str(p.get(k,'')) for k in source['id_fields'])
        if not external.strip('|'):raise ValueError('Missing stable source identity')
        typ=source.get('camera_type','red_light')
        if source.get('type_field'):
            typ=source['types'].get(str(p.get(source['type_field'],'')))
            if not typ:continue
        r=base_record(source,external,float(lat),float(lon),typ,row)
        if typ=='average_speed_section':
            start_lat=p.get(source.get('start_latitude_field',''));start_lon=p.get(source.get('start_longitude_field',''))
            if start_lat and start_lon:
                r.update(latitude=float(str(start_lat).replace(',','.')),longitude=float(str(start_lon).replace(',','.')),end_latitude=float(lat),end_longitude=float(lon))
            else:
                r.update(camera_type='other_enforcement',confidence='LOW',status='review',review_reason='Official section exit exists but its explicit start coordinate is missing; section is not invented',possible_camera_types=['average_speed_end'])
        if source.get('possible_camera_types'):r['possible_camera_types']=source['possible_camera_types']
        rawdir=p.get(source.get('direction_field',''))
        if source.get('direction_pattern'):
            match=re.search(source['direction_pattern'],str(p.get(source['direction_text_field'],'')))
            rawdir=match[1] if match else None
        r.update(direction_raw=rawdir,direction=direction(rawdir),speed_limit=speed(p.get(source.get('speed_field','')),source.get('mph',False)),road_name=p.get(source.get('road_field','')),city=p.get(source.get('city_field','')) or source.get('city'))
        if source.get('candidate_reason'):r.update(confidence='LOW',status='review',review_reason=source['candidate_reason'])
        for field in source.get('retired_fields',[]):
            if p.get(field) not in (None,'',0):r.update(status='candidate')
        if source.get('active_field') and str(p.get(source['active_field'],'')).lower() not in ('yes','active','in service','true','1'):r.update(status='candidate')
        if source.get('activation_date_field'):
            date=p.get(source['activation_date_field'])
            if not date or datetime.datetime.fromisoformat(str(date).replace('/','-')).date()>datetime.datetime.now(datetime.timezone.utc).date():r['status']='candidate'
        if source['code']=='CA_OTTAWA_RLC':
            loc=str(p.get('location_desc','')).lower()
            if ('vineyard' in loc and ('fortune' in loc or 'jeanne' in loc)) or ('berrigan' in loc and rawdir=='Southbound'):r['status']='candidate'
        if source['code']=='US_BOULDER_RLC':
            citation=p.get('CITATIONDATE')
            if not citation or citation/1000>time.time():r['status']='candidate'
        yield r

def main():
    sources=json.loads(CONFIG.read_text());failures=[]
    def run(s):
        for attempt in range(3):
            try:return download(s)
            except Exception as e:
                if attempt==2:failures.append({'source':s['code'],'error':str(e)});return
                time.sleep(2**attempt)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(run,sources))
    (ROOT/'master-db/expansion/reports/official-acquisition.json').write_text(json.dumps({'sources':len(sources),'failures':failures},indent=2)+'\n')

if __name__=='__main__':main()
