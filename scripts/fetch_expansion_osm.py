#!/usr/bin/env python3
"""Additional OSM predicates and countries; acquisition never alters previous phases."""
import argparse,concurrent.futures,datetime,gzip,json,time,urllib.request,urllib.parse
from pathlib import Path
from fetch_osm import COUNTRIES,ENDPOINTS
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'master-db/cache/expansion/osm';CACHE.mkdir(parents=True,exist_ok=True)
NEW={'RU':'Russia','BY':'Belarus','GE':'Georgia','AM':'Armenia','AZ':'Azerbaijan','IM':'Isle of Man','JE':'Jersey','GG':'Guernsey','FO':'Faroe Islands','GI':'Gibraltar','AX':'Åland Islands'}
COUNTRIES.update(NEW)
EXTRA='[enforcement];node(area.a)[speed_camera];node(area.a)["traffic_signals:camera"];node(area.a)["traffic_signals:red_light_camera"];node(area.a)[red_light_camera];node(area.a)["camera:enforcement"];node(area.a)["surveillance:purpose"="traffic_enforcement"];node(area.a)["surveillance:type"="speed_camera"];node(area.a)["camera:type"~"^(speed|red_light|average_speed|section_control)$"]'
def fetch(code,relations=False,speed=False):
 path=CACHE/(code+('-speed-refresh' if speed else '-relations' if relations else '')+'.json')
 if path.exists():return code,len(json.loads(path.read_text())['elements']),'cached'
 prefix=f'[out:json][timeout:60][maxsize:100000000];area["ISO3166-1"="{code}"][admin_level=2]->.a;'
 predicates='node(area.a)[enforcement];'+EXTRA.split(';',1)[1]
 if relations:predicates='rel(area.a)[enforcement];rel(area.a)[type~"^(average_speed|section_control)$"];way(area.a)[enforcement];way(area.a)[highway=speed_camera]'
 # New countries need the normal speed and relation/device selectors too.
 if code in NEW and not relations:predicates+=';node(area.a)[highway=speed_camera];rel(area.a)[type=enforcement]'
 query=prefix+'('+predicates+';)->.objects;.objects out meta center;node(r.objects:"device");out meta;node(r.objects:"from");out meta;node(r.objects:"to");out meta;'
 # Country-area indexes have repeatedly timed out. Bounding-box tree searches
 # are faster; the normalizer still requires independent polygon containment.
 from fetch_osm import boxes
 try:regions=boxes(code)
 except ValueError:regions=None
 if regions and not speed:
  parts=[]
  for box in regions:parts.append(predicates.replace('(area.a)','('+','.join(map(str,box))+')')+';')
  query='[out:json][timeout:60][maxsize:100000000];('+''.join(parts)+')->.objects;.objects out meta center;node(r.objects:"device");out meta;node(r.objects:"from");out meta;node(r.objects:"to");out meta;'
 if speed:
  from fetch_osm import boxes
  query='[out:json][timeout:60][maxsize:100000000];('+''.join('node[highway=speed_camera]('+','.join(map(str,b))+');' for b in boxes(code))+');out meta;'
 # Discovery needs IDs, original tags and explicit member roles. Versions and
 # modification metadata come from the current primary API before publication.
 query=query.replace('out meta','out body')
 errors=[]
 for endpoint in [ENDPOINTS[2],ENDPOINTS[1],ENDPOINTS[0]]:
  try:
   req=urllib.request.Request(endpoint+'?'+urllib.parse.urlencode({'data':query}),headers={'User-Agent':'SpeedCameraExpansion/1.0 (+https://github.com/ternzina/speed-camera-app)','Accept-Encoding':'gzip'})
   with urllib.request.urlopen(req,timeout=85) as r:
    payload=r.read();d=json.loads(gzip.decompress(payload) if r.headers.get('Content-Encoding')=='gzip' else payload)
   if d.get('remark'):raise ValueError(d['remark'])
   if 'elements' not in d:raise ValueError('invalid response')
   d['_bootstrap']={'country_code':code,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'endpoint':endpoint,'query':query,'replication_timestamp':d.get('osm3s',{}).get('timestamp_osm_base'),'license':'ODbL-1.0'}
   temp=path.with_suffix('.tmp');temp.write_text(json.dumps(d,ensure_ascii=False));temp.replace(path)
   print(code,len(d['elements']),'downloaded',flush=True);return code,len(d['elements']),'downloaded'
  except Exception as e:
   errors.append(str(e));print(code,'endpoint failed',str(e)[:100],flush=True)
   if 'Connection refused' not in str(e):time.sleep(5)
 (CACHE/(code+'.error.json')).write_text(json.dumps(errors));return code,0,'failed'
def acquire(countries=None,resume=False):
 from fetch_osm import boxes
 countries=countries or list(COUNTRIES)
 jobs=[];results=[]
 for code in countries:
  for phase in ('extra','relations','speed'):
   if phase=='speed':
    try:boxes(code)
    except ValueError:
     results.append({'country':code,'phase':phase,'result':'no validated boundary','elements':0});continue
   jobs.append((code,phase))
 def run(job):
  journal=ROOT/'master-db/cache/expansion/acquisition-journal';journal.mkdir(parents=True,exist_ok=True)
  checkpoint=journal/(job[0]+'-'+job[1]+'.json')
  suffix='-relations' if job[1]=='relations' else '-speed-refresh' if job[1]=='speed' else ''
  if resume and checkpoint.exists() and json.loads(checkpoint.read_text())['result']=='failed' and not (CACHE/(job[0]+suffix+'.json')).exists():return json.loads(checkpoint.read_text())
  code,phase=job;c,n,state=fetch(code,relations=phase=='relations',speed=phase=='speed')
  result={'country':c,'phase':phase,'elements':n,'result':state}
  # Each distinct phase owns its checkpoint; interrupted catalog runs resume safely.
  checkpoint.write_text(json.dumps(result))
  return result
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results.extend(pool.map(run,jobs))
 (ROOT/'master-db/expansion/reports/osm-all-acquisition.json').write_text(json.dumps(results,indent=2)+'\n')
 return results

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--relations',action='store_true');parser.add_argument('--speed',action='store_true');parser.add_argument('--all-phases',action='store_true');parser.add_argument('--resume',action='store_true',help='Reuse recorded failed attempts as well as completed downloads');parser.add_argument('--countries',nargs='+',default=list(COUNTRIES));args=parser.parse_args()
 if args.all_phases:return acquire(args.countries,args.resume)
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as p:results=list(p.map(lambda c:fetch(c,args.relations,args.speed),args.countries))
 report='osm-speed-acquisition.json' if args.speed else 'osm-relations-acquisition.json' if args.relations else 'osm-acquisition.json'
 (ROOT/'master-db/expansion/reports'/report).write_text(json.dumps(results,indent=2)+'\n')
if __name__=='__main__':main()
