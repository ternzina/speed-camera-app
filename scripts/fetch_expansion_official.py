#!/usr/bin/env python3
"""Licensed, paginated government feeds used by the existing Master DB pipeline."""
import concurrent.futures, csv, datetime, io, json, re, time,hashlib,zipfile,math
from xml.etree import ElementTree as ET
from pathlib import Path
from public_download import get
from bootstrap_cameras import base_record, direction, speed

ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'master-db/raw/expansion/official'
CONFIG=ROOT/'master-db/expansion/sources.json'
PAYLOADS=ROOT/'master-db/raw/expansion/official-payloads'

def capture_payload(response,source,extension):
    """Retain the exact successful HTTP body, in addition to parsed source rows."""
    digest=hashlib.sha256(response.content).hexdigest();directory=PAYLOADS/source['code'];directory.mkdir(parents=True,exist_ok=True)
    target=directory/(digest+'.'+extension)
    if not target.exists():target.write_bytes(response.content)
    metadata={'sha256':digest,'size_bytes':len(response.content),'source_code':source['code'],'source_url':source['source_url'],'request_url':response.url,'license':source['license'],'license_url':source['license_url'],'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    metadata['tls_transport']=getattr(response,'_source_transport','python_requests_verified_tls')
    (directory/(digest+'.metadata.json')).write_text(json.dumps(metadata,ensure_ascii=False))

def kmz_points(content,source):
    """Use explicit WGS84 point geometry, never geocode an address or a junction."""
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        files=archive.infolist()
        assert len(files)==1 and files[0].filename=='doc.kml','Unexpected KMZ contents'
        assert files[0].file_size<=20000000,'KMZ expanded payload exceeds bound'
        root=ET.fromstring(archive.read(files[0]))
    rows=[];identities=set()
    for item in root.findall('.//{*}Placemark'):
        points=item.findall('{*}Point')
        assert len(points)==1,'KMZ camera lacks one explicit point'
        text=points[0].findtext('{*}coordinates') or ''
        assert len(text.split())==1,'KMZ point contains multiple coordinates'
        values=list(map(float,text.split(',')))
        assert len(values) in (2,3),'Malformed KMZ point'
        lon,lat=values[:2]
        assert math.isfinite(lat) and math.isfinite(lon) and -90<=lat<=90 and -180<=lon<=180,'Invalid KMZ coordinate'
        props={n.get('name'):n.text for n in item.findall('.//{*}SimpleData')}
        identity=tuple(props.get(k) for k in source['id_fields'])
        assert all(identity) and identity not in identities,'Missing or duplicate KMZ identity'
        identities.add(identity)
        rows.append({'type':'Feature','geometry':{'type':'Point','coordinates':[lon,lat]},'properties':props})
    assert rows,'Empty KMZ camera dataset'
    return rows

def csv_rows(content,source,report=None):
    reader=csv.DictReader(io.StringIO(content.decode(source.get('encoding','utf-8-sig'))),delimiter=source.get('delimiter',';'))
    reader.fieldnames=[name.lstrip('\ufeff') for name in (reader.fieldnames or [])]
    assert all(field in reader.fieldnames for field in (source['longitude_field'],source['latitude_field'])),'CSV coordinate headers missing'
    rows=[];counts={'raw_records':0,'missing_coordinates':0,'invalid_coordinates':0}
    for p in reader:
        counts['raw_records']+=1
        lon=p.get(source['longitude_field']);lat=p.get(source['latitude_field'])
        if not lat or not lon:counts['missing_coordinates']+=1;continue
        try:coordinates=[float(lon.replace(',','.')),float(lat.replace(',','.'))]
        except ValueError:
            if not source.get('skip_invalid_coordinates'):raise
            counts['invalid_coordinates']+=1;continue
        rows.append({'type':'Feature','geometry':{'type':'Point','coordinates':coordinates},'properties':p})
    counts['parsed_records']=len(rows)
    if report is not None:report.update(counts)
    return rows

def singapore_payload(source):
    """Retain public download bytes without archiving short-lived URL credentials."""
    from urllib.parse import urlsplit, urlunsplit
    endpoint=source['download_url']
    assert endpoint.startswith('https://api-open.data.gov.sg/v1/public/api/datasets/') and endpoint.endswith('/poll-download')
    poll=get(endpoint,timeout=60);poll.raise_for_status();ticket=poll.json()
    assert ticket.get('code')==0 and ticket.get('data',{}).get('url'),'Public dataset download unavailable'
    url=ticket['data']['url'];parts=urlsplit(url)
    assert parts.scheme=='https' and parts.hostname=='s3.ap-southeast-1.amazonaws.com','Unexpected public dataset host'
    response=get(url,timeout=60)
    if response.status_code!=200:raise ValueError('Public dataset payload HTTP '+str(response.status_code))
    response.url=urlunsplit(parts._replace(query='',fragment=''))
    return response

def dgt_location_rows(content):
    """DATEX I inventory: keep explicit segment endpoints, never mobile zones."""
    root=ET.fromstring(content);rows=[]
    publication=root.findtext('.//{*}publicationTime')
    assert publication,'Missing DGT publication timestamp'
    for group in root.findall('.//{*}predefinedLocationSet'):
        kind={'GUID_Inventario_CinemometrosVelocidadMedia':'average_speed_section','GUID_Inventario_CabinasCinemometro':'fixed_speed'}.get(group.get('id'))
        assert kind,'Unexpected DGT inventory category'
        for item in group.findall('{*}predefinedLocation'):
            location=item.find('{*}predefinedLocation');assert location is not None
            endpoint=location.find('.//{*}to/{*}pointCoordinates') if kind=='average_speed_section' else location.find('.//{*}pointCoordinates')
            assert endpoint is not None,'DGT location lacks explicit coordinates'
            lat=float(endpoint.findtext('{*}latitude'));lon=float(endpoint.findtext('{*}longitude'))
            p={'id':item.get('id'),'camera_type':kind,'publication_time':publication,'road':location.findtext('.//{*}roadNumber'),'xml':ET.tostring(item,encoding='unicode')}
            if kind=='average_speed_section':
                start=location.find('.//{*}from/{*}pointCoordinates');assert start is not None,'DGT segment lacks explicit start'
                p.update(start_lat=float(start.findtext('{*}latitude')),start_lon=float(start.findtext('{*}longitude')))
            rows.append({'type':'Feature','geometry':{'type':'Point','coordinates':[lon,lat]},'properties':p})
    assert rows and len({r['properties']['id'] for r in rows})==len(rows),'Empty or repeated DGT identities'
    return rows

def garda_static_rows(content):
    from html.parser import HTMLParser
    class Tables(HTMLParser):
        def __init__(self):super().__init__();self.rows=[];self.row=None;self.cell=None
        def handle_starttag(self,tag,attrs):
            if tag=='tr':self.row=[]
            elif tag in ('td','th') and self.row is not None:self.cell=[]
        def handle_data(self,data):
            if self.cell is not None:self.cell.append(data)
        def handle_endtag(self,tag):
            if tag in ('td','th') and self.cell is not None:
                self.row.append(' '.join(' '.join(self.cell).split()));self.cell=None
            elif tag=='tr' and self.row is not None:self.rows.append(self.row);self.row=None
    parser=Tables();parser.feed(content.decode('utf-8'));rows=[];headers=None
    for row in parser.rows:
        if row==['Location','Latitude','Longitude','Name','County']:headers=row;continue
        if headers:
            assert len(row)==len(headers),'Changed Garda coordinate table'
            p=dict(zip(headers,row));lat=float(re.sub(r'\s+','',p['Latitude']));lon=float(re.sub(r'\s+','',p['Longitude']))
            assert 51<=lat<=56 and -11<=lon<=-5,'Non-Irish Garda coordinates'
            p.update(Latitude=lat,Longitude=lon)
            rows.append(p)
    if not rows:
        import html
        text=' '.join(html.unescape(re.sub(r'<[^>]+>',' ',content.decode('utf-8'))).split())
        match=re.search(r'Location:\s*(N\d+|R\d+)\s+Latitude:\s*([+-]?\d+\.\d+)\s+Longitude:\s*([+-]?\d+\.\d+)\s+Name:\s*(.*?)\s+County:\s*([A-Za-z]+)',text)
        if match:
            road,lat,lon,name,county=match.groups();lat=float(lat);lon=float(lon)
            assert 51<=lat<=56 and -11<=lon<=-5,'Non-Irish Garda coordinates'
            rows.append({'Location':road,'Latitude':lat,'Longitude':lon,'Name':name,'County':county})
    assert rows,'No explicit official static camera coordinates'
    return rows

def download(source,refresh=False):
    path=RAW/(source['code']+'.json');RAW.mkdir(parents=True,exist_ok=True)
    if path.exists() and refresh:
        import hashlib,shutil
        backup=ROOT/'master-db/backups/source-refresh'/(source['code']+'-'+hashlib.sha256(path.read_bytes()).hexdigest()+'.json')
        backup.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(path,backup)
    if path.exists() and not refresh:
        cached=json.loads(path.read_text())
        assert cached['source']['download_url']==source['download_url'],'Source URL changed; a fresh acquisition is required'
        if cached['source']!=source:
            cached['source']=source
            path.write_text(json.dumps(cached,ensure_ascii=False))
        return cached
    url=source['download_url'];rows=[];parse_report={}
    if source['format']=='korea_standard':
        from korea_standard import acquire
        rows,parse_report=acquire(source,capture_payload,reuse_local=not refresh)
    elif source['format']=='arcgis':
        response=get(url+'/query',params={'f':'json','where':'1=1','returnIdsOnly':'true'},timeout=60)
        response.raise_for_status();capture_payload(response,source,'json')
        response.raise_for_status();ids=response.json().get('objectIds')
        if ids is None:raise ValueError('ArcGIS object ID listing failed: '+source['code'])
        for offset in range(0,len(ids),200):
            response=get(url+'/query',params={'f':'geojson','objectIds':','.join(map(str,ids[offset:offset+200])),'outFields':'*','outSR':4326},timeout=60)
            response.raise_for_status();capture_payload(response,source,'json')
            response.raise_for_status();page=response.json()
            if 'features' not in page or page.get('exceededTransferLimit'):raise ValueError('Incomplete GIS page')
            rows.extend(page['features'])
        if len(rows)!=len(ids):raise ValueError('Incomplete GIS acquisition')
    elif source['format']=='elasticsearch':
        response=get(url,timeout=60);response.raise_for_status();capture_payload(response,source,'json');data=response.json()
        assert data.get('timed_out') is False and data.get('_shards',{}).get('failed')==0,'Incomplete Elasticsearch search'
        hits=data['hits'];total=hits['total']
        assert total['relation']=='eq' and total['value']==len(hits['hits']),'Truncated Elasticsearch dataset'
        rows=[hit['_source'] for hit in hits['hits']]
        identities=[row[source['id_fields'][0]] for row in rows]
        assert len(set(identities))==len(identities),'Repeated Elasticsearch source identity'
        parse_report={'raw_records':len(rows),'parsed_records':len(rows),'server_count':total['value']}
    elif source['format']=='compact_columns':
        response=get(url,timeout=60);response.raise_for_status();capture_payload(response,source,'json');data=response.json()
        assert data['falt']==source['columns'],'Compact dataset schema changed'
        assert isinstance(data['kameror'],list) and all(len(row)==len(data['falt']) for row in data['kameror']),'Incomplete compact dataset rows'
        updated=datetime.date.fromisoformat(data['uppdaterad'])
        assert 0<=(datetime.date.today()-updated).days<=source.get('max_snapshot_age_days',90),'Dataset snapshot is stale or future-dated'
        rows=[dict(zip(data['falt'],row)) for row in data['kameror']]
        parse_report={'raw_records':len(rows),'parsed_records':len(rows),'source_updated_at':data['uppdaterad']}
    elif source['format']=='data_gov_sg':
        response=singapore_payload(source)
        extension=source.get('payload_format','geojson');capture_payload(response,source,extension)
        rows=csv_rows(response.content,source,parse_report) if extension=='csv' else response.json()['features']
    elif source['format']=='garda_static_html':
        for page_url in source['download_urls']:
            response=get(page_url,timeout=60);response.raise_for_status();capture_payload(response,source,'html');rows.extend(garda_static_rows(response.content))
        assert len(rows)==source['expected_rows'],'Incomplete Garda static camera acquisition'
    elif source['format']=='kmz_points':
        response=get(url,timeout=60);response.raise_for_status();capture_payload(response,source,'kmz')
        rows=kmz_points(response.content,source)
        if source.get('verification_csv_url'):
            response=get(source['verification_csv_url'],timeout=60);response.raise_for_status();capture_payload(response,source,'csv')
            checks=list(csv.DictReader(io.StringIO(response.content.decode('utf-8-sig'))))
            expected={r['No.']:r['Sites (English)'].strip() for r in checks}
            actual={r['properties'][source['id_fields'][0]]:r['properties']['SITE_DESC_ENG'].strip() for r in rows}
            assert len(expected)==len(checks) and expected==actual,'KMZ and official CSV identities/sites differ'
            parse_report['independently_counted_rows']=len(checks)
    elif source['format']=='csv':
        response=get(url,timeout=60);response.raise_for_status()
        capture_payload(response,source,'csv')
        rows=csv_rows(response.content,source,parse_report)
    elif source['format']=='dgt_datex_locations':
        response=get(url,timeout=60);response.raise_for_status();capture_payload(response,source,'xml');rows=dgt_location_rows(response.content)
    elif source['format']=='datex':
        response=get(url,timeout=60);response.raise_for_status();capture_payload(response,source,'xml');root=ET.fromstring(response.content)
        for item in root.findall('{*}trafficEquipment'):
            names=[n.findtext('{*}value') for n in item.findall('{*}equipmentName') if n.findtext('{*}lang')=='en']
            lat=item.findtext('.//{*}latitude');lon=item.findtext('.//{*}longitude')
            if not lat or not lon:continue
            rows.append({'type':'Feature','geometry':{'type':'Point','coordinates':[float(lon),float(lat)]},'properties':{'id':item.findtext('.//{*}identifier'),'name':names[0] if names else None,'xml':ET.tostring(item,encoding='unicode'),'publication_time':root.findtext('{*}publicationTime')}})
    else:
        response=get(url,timeout=60);response.raise_for_status();capture_payload(response,source,'json');data=response.json()
        rows=data.get(source.get('rows_field','features'),[]) if isinstance(data,dict) else data
        if source.get('count_url'):
            response=get(source['count_url'],timeout=60);response.raise_for_status()
            expected=int(ET.fromstring(response.content).get('numberOfFeatures'))
            assert len(rows)==expected,'Incomplete WFS acquisition'
    if source.get('expected_raw_rows') is not None:
        assert parse_report.get('raw_records')==source['expected_raw_rows'],'Incomplete raw source snapshot acquisition'
    if source.get('expected_rows') is not None:
        assert len(rows)==source['expected_rows'],'Incomplete source snapshot acquisition'
    if source.get('count_json_url'):
        response=get(source['count_json_url'],timeout=60);response.raise_for_status();capture_payload(response,source,'json')
        count=response.json();expected=int(count[0][source.get('count_json_field','count')])
        assert len(rows)==expected,'Incomplete JSON dataset acquisition'
        parse_report['independently_counted_rows']=expected
    envelope={'source':source,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rows':rows,'parse_report':parse_report}
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(envelope,ensure_ascii=False));temp.replace(path)
    print(source['code'],len(rows),'downloaded',flush=True);return envelope

def records(envelope):
    source={**envelope['source'],'retrieved_at':envelope['retrieved_at'],'source_type':envelope['source'].get('source_type','official_government')}
    for row in envelope['rows']:
        p=row.get('properties',row)
        if source.get('null_values'):
            p={k:None if isinstance(v,str) and v in source['null_values'] else v for k,v in p.items()}
        g=row.get('geometry') or p.get(source.get('geometry_field',''))
        if g and g['type']=='Point':lon,lat=g['coordinates'][:2]
        elif source.get('latitude_field') and source.get('longitude_field'):
            if p.get(source['latitude_field']) is None or p.get(source['longitude_field']) is None:continue
            lat,lon=float(p[source['latitude_field']]),float(p[source['longitude_field']])
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
        if terms:=source.get('enforcement_terms'):
            text=str(p.get(terms['field'],''))
            section_text=str(p.get(terms.get('section_field',''),''))
            red=any(value in text for value in terms.get('red_light',[]))
            fixed=any(value in text for value in terms.get('speed',[]))
            if any(value in section_text for value in terms.get('section',[])):typ='average_speed_section'
            elif red and fixed:typ='speed_and_red_light'
            elif red:typ='red_light'
            elif fixed:typ='fixed_speed'
            else:typ='other_enforcement'
        r=base_record(source,external,float(lat),float(lon),typ,row)
        if source.get('confidence_override'):r['confidence']=source['confidence_override']
        if typ=='other_enforcement' and source.get('enforcement_terms'):
            r.update(confidence='LOW',status='review',review_reason='Official enforcement device has no explicit speed/red-light capability in the published fields')
        if typ=='average_speed_section':
            start_lat=p.get(source.get('start_latitude_field',''));start_lon=p.get(source.get('start_longitude_field',''))
            if start_lat and start_lon:
                r.update(latitude=float(str(start_lat).replace(',','.')),longitude=float(str(start_lon).replace(',','.')),end_latitude=float(lat),end_longitude=float(lon))
            else:
                r.update(camera_type='other_enforcement',confidence='LOW',status='review',review_reason=source.get('section_endpoint_reason','Official section exit exists but its explicit start coordinate is missing; section is not invented'),possible_camera_types=source.get('section_point_possible_types',['average_speed_end']))
        rawdir=p.get(source.get('direction_field',''))
        if source.get('direction_pattern'):
            match=re.search(source['direction_pattern'],str(p.get(source['direction_text_field'],'')))
            rawdir=match[1] if match else None
        r.update(direction_raw=rawdir,direction=direction(rawdir),speed_limit=speed(p.get(source.get('speed_field','')),source.get('mph',False)),road_name=p.get(source.get('road_field','')),city=p.get(source.get('city_field','')) or source.get('city'))
        if r.get('road_name') is not None:r['road_name']=str(r['road_name'])
        if source.get('candidate_reason'):r.update(confidence='LOW',status='review',review_reason=source['candidate_reason'])
        if source.get('review_reason_field') and p.get(source['review_reason_field']):
            r.update(confidence='LOW',status='review',review_reason=p[source['review_reason_field']])
        if source.get('reference_date_field'):
            r['camera_sources'][0]['source_updated_at']=p.get(source['reference_date_field'])
        if source.get('possible_camera_types'):r['possible_camera_types']=source['possible_camera_types']
        for field in source.get('speed_ambiguity_fields',[]):
            if p.get(field) and '速限' in str(p[field]):r['speed_limit']=None
        for field in source.get('retired_fields',[]):
            if p.get(field) not in (None,'',0):r.update(status='candidate')
        if source.get('active_field') and str(p.get(source['active_field'],'')).lower() not in ('yes','active','in service','true','1'):r.update(status='candidate')
        if source.get('certificate_expiry_field'):
            expiry=p.get(source['certificate_expiry_field'])
            if not expiry or datetime.datetime.fromisoformat(str(expiry).replace('Z','+00:00')).date()<datetime.datetime.now(datetime.timezone.utc).date():r['status']='candidate'
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

def main(refresh=False):
    sources=json.loads(CONFIG.read_text());failures=[]
    def run(s):
        for attempt in range(3):
            try:return download(s,refresh=refresh)
            except Exception as e:
                if attempt==2:failures.append({'source':s['code'],'error':str(e)});return
                time.sleep(2**attempt)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(run,sources))
    (ROOT/'master-db/expansion/reports/official-acquisition.json').write_text(json.dumps({'sources':len(sources),'failures':failures},indent=2)+'\n')

if __name__=='__main__':main()
