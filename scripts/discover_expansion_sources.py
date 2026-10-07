#!/usr/bin/env python3
"""Search public GIS/data catalogs, preserving metadata; no license is inferred."""
import concurrent.futures,json,time,datetime
from pathlib import Path
import requests
ROOT=Path(__file__).resolve().parents[1];RAW=ROOT/'master-db/raw/expansion/discovery';RAW.mkdir(parents=True,exist_ok=True)
QUERIES=['"red light camera"','"red light cameras"','"speed camera"','"speed cameras"','"automated enforcement"','"photo enforcement"','"intersection safety"','"average speed"','"radar fixe"','"fotoradar"','"fotoradary"','"radars"','"flits"','"kamerat"','"fartkamera"','"speed enforcement"','"traffic enforcement"','"safety camera"','"safety cameras"','"blitzer"','"autovelox"','"radares"','"redlichtcamera"','"radari"','"radarji"','"vitesse"','"GoSafe"','"stærekasser"']
HEAD={'User-Agent':'SpeedCameraExpansion/1.0 (+https://github.com/ternzina/speed-camera-app; public licensed-data discovery)'}
def search(pair):
 kind,q=pair;path=RAW/(kind+'-'+str(QUERIES.index(q))+'.json')
 if path.exists():return kind,json.loads(path.read_text())
 for attempt in range(3):
  try:
   if kind=='arcgis':url='https://www.arcgis.com/sharing/rest/search';params={'f':'json','q':q+' (type:"Feature Service" OR type:"Map Service")','num':100,'sortField':'numViews','sortOrder':'desc'}
   else:url='https://api.us.socrata.com/api/catalog/v1';params={'q':q.strip('"'),'limit':1000}
   r=requests.get(url,params=params,headers=HEAD,timeout=40);r.raise_for_status();d=r.json();path.write_text(json.dumps(d,ensure_ascii=False));return kind,d
  except Exception as e:
   if attempt==2:return kind,{'error':str(e),'query':q}
   time.sleep(3)
def main():
 items={};socrata={};errors=[]
 jobs=[('arcgis',q) for q in QUERIES]+[('socrata',q) for q in QUERIES[:9]]
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  for kind,d in pool.map(search,jobs):
   if d.get('error'):errors.append(d);continue
   for r in d.get('results',[]):
    if kind=='arcgis':items[r['id']]=r
    else:
     resource=r.get('resource',{});key=r.get('metadata',{}).get('domain','')+'/'+resource.get('id','');socrata[key]=r
 report={'searched_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'arcgis_items':list(items.values()),'socrata_items':list(socrata.values()),'errors':errors}
 (RAW/'catalog-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print('ArcGIS',len(items),'Socrata',len(socrata),'errors',len(errors),flush=True)
 for r in sorted(items.values(),key=lambda x:x.get('title','')):print('A',r['id'],r.get('owner'),r.get('title'),flush=True)
 for k,r in socrata.items():print('S',k,r['resource'].get('name'),flush=True)
if __name__=='__main__':main()
