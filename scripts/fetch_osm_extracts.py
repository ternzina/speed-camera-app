#!/usr/bin/env python3
"""Daily licensed regional PBF fallback, with complete explicit relation members."""
import argparse,datetime,json,shutil
import osmium
from pathlib import Path
from public_download import get
from bounded_source_download import download as download_source
from r2_archive import archive_files,encode,get as archive_get,CACHE
ROOT=Path(__file__).resolve().parents[1]
REGIONS={'AL':'albania','ME':'montenegro','LU':'luxembourg','MT':'malta','CY':'cyprus','IS':'iceland','IE':'ireland-and-northern-ireland','DK':'denmark','SK':'slovakia','BG':'bulgaria','LV':'latvia','EE':'estonia','MD':'moldova'}
def relevant(tags):
 return tags.get('highway')=='speed_camera' or 'enforcement' in tags or tags.get('type') in ('enforcement','average_speed','section_control') or any(k in tags for k in ('speed_camera','traffic_signals:camera','traffic_signals:red_light_camera','red_light_camera','camera:enforcement')) or tags.get('surveillance:purpose')=='traffic_enforcement' or tags.get('surveillance:type')=='speed_camera' or bool({mode.strip() for mode in tags.get('camera:type','').split(';')} & {'speed','speed_camera','fixed_speed','red_light','redlight','red_light_camera','average_speed','section_control'})
class Extract(osmium.SimpleHandler):
 def __init__(self):super().__init__();self.elements=[];self.members=set();self.ways={}
 def node(self,n):
  tags=dict(n.tags)
  if relevant(tags):self.elements.append({'type':'node','id':n.id,'version':n.version,'timestamp':str(n.timestamp),'lat':n.location.lat,'lon':n.location.lon,'tags':tags})
 def way(self,w):
  tags=dict(w.tags)
  if not relevant(tags):return
  refs=[n.ref for n in w.nodes];self.members.update(refs)
  self.ways[w.id]={'type':'way','id':w.id,'version':w.version,'timestamp':str(w.timestamp),'tags':tags,'nodes':refs}
 def relation(self,r):
  tags=dict(r.tags)
  if not relevant(tags):return
  members=[{'type':{'n':'node','w':'way','r':'relation'}[m.type],'ref':m.ref,'role':m.role} for m in r.members]
  self.members.update(m['ref'] for m in members if m['type']=='node' and m['role'] in ('device','from','to'))
  self.elements.append({'type':'relation','id':r.id,'version':r.version,'timestamp':str(r.timestamp),'tags':tags,'members':members})
class Members(osmium.SimpleHandler):
 def __init__(self,ids):super().__init__();self.ids=ids;self.elements=[]
 def node(self,n):
  if n.id in self.ids:self.elements.append({'type':'node','id':n.id,'version':n.version,'timestamp':str(n.timestamp),'lat':n.location.lat,'lon':n.location.lon,'tags':dict(n.tags)})
def extract_elements(path):
 h=Extract();h.apply_file(str(path),filters=[osmium.filter.KeyFilter('highway','enforcement','type','speed_camera','traffic_signals:camera','traffic_signals:red_light_camera','red_light_camera','camera:enforcement','camera:type','surveillance:purpose','surveillance:type')]);m=Members(h.members)
 if h.members:m.apply_file(str(path),filters=[osmium.filter.IdFilter(h.members)])
 points={e['id']:e for e in m.elements}
 for w in h.ways.values():
  coords=[points[i] for i in w['nodes'] if i in points]
  if coords and len(coords)==len(w['nodes']):w['center']={'lat':sum(n['lat'] for n in coords)/len(coords),'lon':sum(n['lon'] for n in coords)/len(coords)}
 elements={(e['type'],e['id']):e for e in h.elements+m.elements+list(h.ways.values())}
 return elements
def main(countries):
 raw=ROOT/'master-db/raw/coverage-stage/osm-extracts';raw.mkdir(parents=True,exist_ok=True)
 out=ROOT/'master-db/cache/expansion/osm';report=[]
 for code in countries:
  region=REGIONS[code];url=f'https://download.geofabrik.de/{region if '/' in region else 'europe/'+region}-latest.osm.pbf';path=raw/(code+'.osm.pbf')
  country=code.split('-')[0]
  try:
   completed=out/(code+'-extract.json')
   if completed.exists():
    old=json.loads(completed.read_bytes());ref=old.get('_bootstrap',{}).get('source_snapshot_manifest')
    if ref:
     archive_get(ref['key'] if isinstance(ref,dict) else ref,refresh=True)
     if code=='IE':
      from partition_shared_extracts import northern_ireland
      northern_ireland()
     print(code,'reusing verified archived snapshot',flush=True);continue
   download_metadata=download_source(url,path,ROOT,archive_cache_bounded=True) if not path.exists() else {'resumed_completed_local_source':True}
   if shutil.disk_usage(ROOT).free<264000000:raise RuntimeError('Insufficient space for verified archive; completed source retained locally')
   elements=extract_elements(path)
   stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
   payload={'elements':list(elements.values()),'_bootstrap':{'country_code':country,'retrieved_at':stamp,'license':'ODbL-1.0','endpoint':url,'complete_regional_extract':True,'download':download_metadata,'replication_timestamp':'daily Geofabrik extract; current primary API revalidation required'}}
   extracted=raw/(code+'-observations.json');temporary=extracted.with_suffix('.tmp');temporary.write_bytes(encode(payload));temporary.replace(extracted)
   pbf_bytes=path.stat().st_size
   archived=archive_files([path,extracted],chunk_bytes=8000000,bounded_cache=True)
   payload['_bootstrap']['source_snapshot_manifest']=archived['manifest_ref']
   target=out/(code+'-extract.json');temporary=target.with_suffix('.tmp');temporary.write_bytes(encode(payload));temporary.replace(target)
   if code=='IE':
    from partition_shared_extracts import northern_ireland
    northern_ireland()
   # archive_files already performed byte-for-byte restoration and checksum checks.
   for item in archived['files']:
    for chunk in item['chunks']:(CACHE/chunk['key']).unlink(missing_ok=True)
   path.unlink()
   entry={'country':code,'source_url':url,'elements':len(elements),'pbf_bytes':pbf_bytes,'archive':archived['manifest_ref'],'archived_before_normalization':True};report.append(entry);print(code,len(elements),'verified R2 snapshot',flush=True)
  except Exception as e:report.append({'country':code,'error':str(e)});print(code,type(e).__name__,str(e)[:150],flush=True)
  (ROOT/'master-db/cache/coverage-stage'/('extract-acquisition-'+countries[0]+'.json')).write_bytes(encode(report))
REGIONS.update({'US-'+s.upper().replace('-','_'):'north-america/us/'+s for s in ['district-of-columbia','maryland','virginia','florida','oregon','washington','rhode-island','connecticut','new-mexico','delaware','louisiana','georgia','iowa','illinois','colorado']})
REGIONS.update({'CA-AB':'north-america/canada/alberta','CA-BC':'north-america/canada/british-columbia','CA-MB':'north-america/canada/manitoba','CA-SK':'north-america/canada/saskatchewan','CA-NS':'north-america/canada/nova-scotia','CA-QC':'north-america/canada/quebec','CA-ON':'north-america/canada/ontario'})
REGIONS.update({'BE':'belgium','NL':'netherlands','AT':'austria','AD':'andorra','LI':'liechtenstein','MC':'monaco','XK':'kosovo','DE-BREMEN':'europe/germany/bremen','DE-HAMBURG':'europe/germany/hamburg','DE-SAARLAND':'europe/germany/saarland','GB-LONDON':'europe/united-kingdom/england/greater-london','CA-PE':'north-america/canada/prince-edward-island','CA-NB':'north-america/canada/new-brunswick'})
from discover_coverage_catalogs import STATES
REGIONS.update({'US-'+s.upper().replace(' ','_'):'north-america/us/'+s.lower().replace(' ','-') for s in STATES})
for region in json.loads((ROOT/'master-db/coverage/europe-extract-regions.json').read_text()):
 REGIONS[region['region']]=region['pbf_url'].removeprefix('https://download.geofabrik.de/').removesuffix('-latest.osm.pbf')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--countries',nargs='+');p.add_argument('--group',choices=('europe','north-america'));args=p.parse_args()
 codes=args.countries or [c for c in REGIONS if args.group is None or (c.startswith(('US-','CA-'))==(args.group=='north-america'))]
 main(codes)
