#!/usr/bin/env python3
"""Resumable small-region OSM enforcement discovery; archive before normalization."""
import argparse,concurrent.futures,datetime,json,math
from pathlib import Path
from fetch_osm import boxes,COUNTRIES,ENDPOINTS
from public_download import get
from r2_archive import archive_files,encode,put
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'master-db/cache/coverage-stage/osm-tiles'
SELECTORS=['node[highway=speed_camera]','nwr[enforcement]','relation[type=enforcement]','relation[type~"^(average_speed|section_control)$"]','node[speed_camera]','node["traffic_signals:camera"]','node["traffic_signals:red_light_camera"]','node[red_light_camera]','node["camera:enforcement"]','node["surveillance:purpose"="traffic_enforcement"]','node["surveillance:type"="speed_camera"]','node["camera:type"~"(^|;)[ ]*(speed|speed_camera|fixed_speed|red_light|redlight|red_light_camera|average_speed|section_control)[ ]*(;|$)"]']
def tiles(code,step=3):
 for south,west,north,east in boxes(code):
  ny=max(1,math.ceil((north-south)/step));nx=max(1,math.ceil((east-west)/step))
  for y in range(ny):
   for x in range(nx):yield tuple(round(v,5) for v in (south+(north-south)*y/ny,west+(east-west)*x/nx,south+(north-south)*(y+1)/ny,west+(east-west)*(x+1)/nx))
def fetch(job):
 code,i,box=job;path=CACHE/f'{code}-{i:04}.json'
 if path.exists():return path,None
 q='[out:json][timeout:35][maxsize:30000000];('+''.join(s+'('+','.join(map(str,box))+');' for s in SELECTORS)+')->.objects;.objects out meta center;node(r.objects:"device");out meta;node(r.objects:"from");out meta;node(r.objects:"to");out meta;'
 errors=[]
 for endpoint in ENDPOINTS+['https://overpass.kumi.systems/api/interpreter']:
  try:
   r=get(endpoint,params={'data':q},headers={'User-Agent':'SpeedCameraApp-Coverage/1.0 (+https://github.com/ternzina/speed-camera-app; licensed OSM enforcement research)'},timeout=(10,50));r.raise_for_status();d=r.json()
   if d.get('remark') or 'elements' not in d:raise ValueError(d.get('remark','Missing elements'))
   d['_bootstrap']={'country_code':code,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'endpoint':endpoint,'query':q,'license':'ODbL-1.0','replication_timestamp':d.get('osm3s',{}).get('timestamp_osm_base')}
   path.write_bytes(encode(d));print(code,i,len(d['elements']),flush=True);return path,None
  except Exception as e:errors.append(type(e).__name__+': '+str(e)[:160])
 print(code,i,'FAILED',flush=True);return None,{'country':code,'tile':i,'bbox':box,'errors':errors}
def main(countries):
 CACHE.mkdir(parents=True,exist_ok=True);jobs=[];unsupported=[]
 for code in countries:
  try:jobs.extend((code,i,b) for i,b in enumerate(tiles(code)))
  except ValueError:unsupported.append(code)
 errors=[];paths=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  for path,error in pool.map(fetch,jobs):
   if path:paths.append(path)
   if error:errors.append(error)
 # Immutable original tile snapshots must be verified remotely before any
 # aggregate can be offered to normalization. Failure stops this stage.
 archived=archive_files(paths)
 out=ROOT/'master-db/cache/expansion/osm';out.mkdir(parents=True,exist_ok=True)
 for code in countries:
  parts=[json.loads(p.read_text()) for p in paths if p.name.startswith(code+'-')]
  if not parts:continue
  elements={}
  for part in parts:
   for e in part['elements']:
    key=(e['type'],e['id'])
    if key not in elements or e.get('version',0)>elements[key].get('version',0):elements[key]=e
  merged={'elements':list(elements.values()),'_bootstrap':{**max(parts,key=lambda p:p['_bootstrap']['retrieved_at'])['_bootstrap'],'source_snapshot_manifest':archived['manifest_ref'],'complete_country':not any(e['country']==code for e in errors)}}
  (out/(code+'-deep.json')).write_bytes(encode(merged))
 report={'countries':countries,'tiles':len(jobs),'successful_tiles':len(paths),'unsupported':unsupported,'failures':errors,'source_snapshot_manifest':archived['manifest_ref'],'archived_before_normalization':True}
 report['receipt']=put(encode(report),'manifests')
 (ROOT/'master-db/cache/coverage-stage/osm-acquisition.json').write_bytes(encode(report))
 print('Tiles archived',len(paths),'failed',len(errors),flush=True)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--countries',nargs='+',default=list(COUNTRIES));main(p.parse_args().countries)
