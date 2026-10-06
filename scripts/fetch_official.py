#!/usr/bin/env python3
"""Download licensed government feeds, retaining metadata and retrieval timestamps."""
import datetime as dt
import json
import time
import csv
import io
import xml.etree.ElementTree as ET
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'master-db/raw/official'
REGISTRY = ROOT / 'master-db/bootstrap/sources.json'
SOURCES = [
    dict(code='FR_INTERIEUR',country_code='FR',name="Ministère de l'intérieur Liste des radars fixes en France (December 2025)",
         source_type='official_government',license='Licence Ouverte 2.0',license_url='https://www.etalab.gouv.fr/licence-ouverte-open-licence/',
         url='https://static.data.gouv.fr/resources/liste-des-radars-fixes-en-france/20251230-134204/jeu-de-donnees-liste-des-radars-fixes-en-france-12-2025.csv',
         source_url='https://www.data.gouv.fr/datasets/liste-des-radars-fixes-en-france',adapter='france',format='csv-cp1252'),
    dict(code='ES_DGT',country_code='ES',name='Dirección General de Tráfico fixed and average speed radar locations',
         source_type='official_government',license='CC-BY-4.0',license_url='https://nap.dgt.es/es/dataset/radares-fijos-dgt',
         url='https://infocar.dgt.es/datex2/dgt/PredefinedLocationsPublication/radares/content.xml',
         source_url='https://nap.dgt.es/es/dataset/radares-fijos-dgt',adapter='dgt',format='datex2'),
    dict(code='NO_NVDB',country_code='NO',name='Statens vegvesen NVDB ATK-punkt (162)',
         source_type='official_government',license='NLOD-2.0',license_url='https://data.norge.no/nlod/no/2.0',
         url='https://nvdbapiles.atlas.vegvesen.no/vegobjekter/162?inkluder=alle&srid=4326&antall=800',
         source_url='https://nvdb-docs.atlas.vegvesen.no/nvdbapil/v4/introduksjon/Oversikt/',adapter='nvdb',format='nvdb'),
    dict(code='CHICAGO_SPEED', country_code='US', name='City of Chicago speed camera locations',
         source_type='official_government', license='Chicago Data Portal Terms of Use',
         license_url='https://www.chicago.gov/city/en/narr/foia/data_disclaimer.html',
         url='https://data.cityofchicago.org/resource/4i42-qv3h.json?$limit=50000',
         source_url='https://data.cityofchicago.org/d/4i42-qv3h', adapter='chicago', camera_type='fixed_speed', city='Chicago'),
    dict(code='CHICAGO_RED', country_code='US', name='City of Chicago red light camera locations',
         source_type='official_government', license='Chicago Data Portal Terms of Use',
         license_url='https://www.chicago.gov/city/en/narr/foia/data_disclaimer.html',
         url='https://data.cityofchicago.org/resource/thvf-6diy.json?$limit=50000',
         source_url='https://data.cityofchicago.org/d/thvf-6diy', adapter='chicago', camera_type='red_light', city='Chicago'),
    dict(code='DDOT_DC', country_code='US', name='District Department of Transportation Automated Safety Cameras',
         source_type='official_government', license='CC-BY-4.0', license_url='https://creativecommons.org/licenses/by/4.0/',
         url='https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Public_Safety_WebMercator/MapServer/43',
         source_url='https://www.arcgis.com/home/item.html?id=03d94dc6579949ae9d7c9dd8ffebeb89',
         adapter='dc', arcgis=True, city='Washington DC'),
    dict(code='SEATTLE_ATSC', country_code='US', name='Seattle Department of Transportation active traffic safety cameras',
         source_type='official_government', license='City of Seattle Open Data Terms',
         license_url='https://data.seattle.gov/stories/s/Terms-of-Use/6h3i-jb7p',
         url='https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Automatic_Traffic_Safety_Cameras_(ATSC)_view/FeatureServer/0',
         source_url='https://www.arcgis.com/home/item.html?id=f3879db110b84473b4e3d669157c6a39',
         adapter='seattle', arcgis=True, city='Seattle'),
    dict(code='TORONTO_RLC', country_code='CA', name='City of Toronto Red Light Cameras',
         source_type='official_government', license='Open Government Licence – Toronto',
         license_url='https://open.toronto.ca/open-data-licence/',
         url='https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/9fcff3e1-3737-43cf-b410-05acd615e27b/resource/7e4ac806-4e7a-49d3-81e1-7a14375c9025/download/red-light-cameras-data-4326.geojson',
         source_url='https://open.toronto.ca/dataset/red-light-cameras/', adapter='toronto', city='Toronto'),
    dict(code='QUEBEC_MTQ', country_code='CA', name='Ministère des Transports et de la Mobilité durable Radar photo',
         source_type='official_government', license='CC-BY-4.0', license_url='https://www.donneesquebec.ca/licence/',
         url='https://ws.mapserver.transports.gouv.qc.ca/swtq?service=wfs&version=2.0.0&request=getfeature&typename=ms:radars_photos&outfile=RadarPhoto&srsname=EPSG:4326&outputformat=geojson',
         source_url='https://www.donneesquebec.ca/recherche/dataset/radar-photo', adapter='quebec'),
    dict(code='EDMONTON_ISD', country_code='CA', name='City of Edmonton Intersection Safety Device Locations',
         source_type='official_government', license='City of Edmonton Open Data Terms of Use',
         license_url='https://www.edmonton.ca/city_government/initiatives_innovation/open-data',
         url='https://data.edmonton.ca/resource/7fnd-72gr.json?$limit=50000',
         source_url='https://data.edmonton.ca/d/7fnd-72gr', adapter='edmonton', city='Edmonton'),
    dict(code='OTTAWA_RLC_2025', country_code='CA', name='City of Ottawa red light camera locations in 2025 violations dataset',
         source_type='official_government', license='Open Government Licence – City of Ottawa',
         license_url='https://ottawa.ca/en/city-hall/open-transparent-and-accountable-government/open-data',
         url='https://services.arcgis.com/G6F8XLCl5KtAlZ2G/arcgis/rest/services/Red_Light_Camera_Violations_2025/FeatureServer/0',
         source_url='https://www.arcgis.com/home/item.html?id=ad519955709c4ed78d03726933b531e1',
         adapter='ottawa', arcgis=True, city='Ottawa', historical=True),
]

def main(refresh=False):
    CACHE.mkdir(parents=True, exist_ok=True)
    registry = []
    for source in SOURCES:
        path = CACHE / (source['code'] + '.json')
        try:
            if path.exists() and not refresh:
                envelope = json.loads(path.read_text())
            else:
                data = None
                for attempt in range(3):
                    try:
                        if source.get('arcgis'):
                            features = []
                            offset = 0
                            while True:
                                r = requests.get(source['url']+'/query', params={
                                    'f':'geojson','where':'1=1','outFields':'*','outSR':4326,
                                    'resultRecordCount':1000,'resultOffset':offset}, timeout=80)
                                r.raise_for_status(); page=r.json()
                                if 'error' in page: raise ValueError(page['error'])
                                features.extend(page['features'])
                                if not page.get('exceededTransferLimit') and len(page['features']) < 1000: break
                                offset += len(page['features'])
                                if offset > 50000: raise ValueError('pagination safety limit')
                            data={'type':'FeatureCollection','features':features}
                        elif source.get('format')=='nvdb':
                            rows=[]; url=source['url']
                            while url:
                                r=requests.get(url,headers={'X-Client':'Speed Camera App Bootstrap - ternzina GitHub'},timeout=80);r.raise_for_status();page=r.json()
                                rows.extend(page['objekter'])
                                url=page.get('metadata',{}).get('neste',{}).get('href') if page['objekter'] else None
                            data=rows
                        else:
                            r=requests.get(source['url'],timeout=80);r.raise_for_status()
                            if source.get('format')=='csv-cp1252':data=[{k.strip():v.strip() for k,v in row.items()} for row in csv.DictReader(io.StringIO(r.content.decode('cp1252')),delimiter=';')]
                            elif source.get('format')=='datex2':
                                root=ET.fromstring(r.content)
                                for n in root.iter():n.tag=n.tag.split('}')[-1]
                                data=[]
                                for group in root.findall('.//predefinedLocationSet'):
                                    for loc in group.findall('predefinedLocation'):
                                        entry={'id':loc.attrib['id'],'group':group.attrib['id'],'xml':ET.tostring(loc,encoding='unicode')}
                                        for name in ['latitude','longitude','roadNumber','directionRelative','directionNamed']:
                                            entry[name]=[e.text for e in loc.findall('.//'+name)]
                                        for role in ['from','to']:
                                            lat=loc.find('.//'+role+'/pointCoordinates/latitude');lon=loc.find('.//'+role+'/pointCoordinates/longitude')
                                            if lat is not None and lon is not None:entry[role]=[float(lat.text),float(lon.text)]
                                        data.append(entry)
                            else:data=r.json()
                        break
                    except Exception:
                        if attempt == 2: raise
                        time.sleep(3 * 2 ** attempt)
                envelope = {'source': source, 'retrieved_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'data': data}
                path.write_text(json.dumps(envelope, ensure_ascii=False))
            registry.append({**source, 'retrieved_at':envelope['retrieved_at'], 'status':'downloaded',
                             'raw_count':len(envelope['data'].get('features',[])) if isinstance(envelope['data'],dict) else len(envelope['data'])})
            print(source['code'],registry[-1]['raw_count'],flush=True)
        except Exception as e:
            registry.append({**source,'status':'failed','error':str(e)})
            print(source['code'],'FAILED',str(e)[:200],flush=True)
    REGISTRY.write_text(json.dumps(registry,ensure_ascii=False,indent=2))

if __name__ == '__main__':
    import sys
    main('--refresh' in sys.argv)
