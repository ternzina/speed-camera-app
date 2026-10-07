#!/usr/bin/env python3
"""Discover licensed New Taipei district enforcement CSVs from the official OpenAPI."""
import concurrent.futures,hashlib,json,re,collections
from pathlib import Path
from public_download import get
from fetch_expansion_official import download,records,CONFIG,ROOT
DIRECTORY=ROOT/'master-db/raw/coverage-stage/discovery/taiwan'
def main():
 DIRECTORY.mkdir(parents=True,exist_ok=True)
 response=get('https://data.ntpc.gov.tw/api/v1/openapi/units/1250000',timeout=45);response.raise_for_status()
 (DIRECTORY/'ntpc-police-openapi.json').write_bytes(response.content)
 existing=json.loads(CONFIG.read_text());known={s['download_url'] for s in existing};discovered=[];results=[]
 for path,methods in response.json()['paths'].items():
  operation=methods.get('get',{})
  if path.endswith('/csv') and operation.get('summary','').startswith('新北市固定式測速照相-'):
   url='https://data.ntpc.gov.tw'+path+'/file'
   if url not in known:discovered.append((path.split('/')[3],operation['summary'],url))
 assert len(discovered)<=30,'Unexpected source expansion; inspect changed primary schema'
 def acquire(item):
  identity,title,url=item;page='https://data.ntpc.gov.tw/datasets/'+identity
  try:
   response=get(page,timeout=45);response.raise_for_status()
   (DIRECTORY/('ntpc-license-'+identity+'.html')).write_bytes(response.content)
   assert '政府資料開放授權條款-第1版' in response.text,'Explicit municipal dataset license missing'
   source={'code':'TW_NEWTAIPEI_'+identity.split('-')[0].upper(),'name':'New Taipei City Police fixed enforcement: '+title.split('-')[-1],'source_url':page,'download_url':url,'country_code':'TW','format':'csv','delimiter':',','license':'Open Government Data License version 1.0','license_url':'https://data.gov.tw/license','id_fields':['address','direct','longitude','latitude'],'latitude_field':'latitude','longitude_field':'longitude','direction_field':'direct','speed_field':'limit','road_field':'address','city_field':'cityname','enforcement_terms':{'field':'violation types','speed':['超速'],'red_light':['闖紅燈']}}
   envelope=download(source);normalized=list(records(envelope));result={'code':source['code'],'source_url':page,'license_url':source['license_url'],'license_page_sha256':hashlib.sha256(response.content).hexdigest(),'raw_records':len(envelope['rows']),'types':dict(collections.Counter(r['camera_type'] for r in normalized))}
   print(source['code'],result['raw_records'],result['types'],flush=True)
   return source,result
  except Exception as error:
   print('SOURCE HELD',title,str(error)[:180],flush=True)
   return None,{'source_url':page,'download_url':url,'error':str(error)[:400]}
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  for source,result in pool.map(acquire,discovered):
   results.append(result)
   if source:existing.append(source)
 assert len({s['code'] for s in existing})==len(existing),'Source-code collision'
 CONFIG.write_text(json.dumps(existing,ensure_ascii=False,indent=2)+'\n')
 (ROOT/'master-db/coverage/taiwan-municipal-acquisition.json').write_text(json.dumps({'primary_catalog':'https://data.ntpc.gov.tw/api/v1/openapi/units/1250000','discovered_districts':len(discovered),'processed':results},ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
