#!/usr/bin/env python3
"""Refresh only UA/PL candidate OSM identities; never run global collectors."""
import json,time,collections,datetime
from pathlib import Path
import requests
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'master-db/raw/ua-pl/osm-primary'
def main():
 BASE.mkdir(parents=True,exist_ok=True)
 rows=json.loads((ROOT/'master-db/cache/ua-pl/candidates.json').read_text());ids=collections.defaultdict(set)
 for r in rows:
  assert r['country_code'] in ('UA','PL')
  for s in r['camera_sources']:
   if s['source_type']=='openstreetmap':
    kind,ident=s['source_id'].split('/');ids[kind].add(int(ident))
 result={}
 for kind,values in ids.items():
  result[kind]={'requested':len(values),'returned':0};values=sorted(values)
  for start in range(0,len(values),100):
   path=BASE/f'{kind}-{start}.json';url=f'https://api.openstreetmap.org/api/0.6/{kind}s.json'
   if not path.exists():
    for attempt in range(3):
     try:
      r=requests.get(url,params={kind+'s':','.join(map(str,values[start:start+100]))},timeout=90);r.raise_for_status();v=r.json();break
     except requests.RequestException:
      if attempt==2:raise
      time.sleep(2**attempt)
    v['_review']={'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_url':r.url,'requested_ids':values[start:start+100],'scope':['UA','PL']};path.write_text(json.dumps(v,ensure_ascii=False))
   data=json.loads(path.read_text());result[kind]['returned']+=len(data['elements']);print(kind,start,result[kind],flush=True)
 (ROOT/'master-db/cache/ua-pl/primary-refresh-summary.json').write_text(json.dumps(result,indent=2))
if __name__=='__main__':main()
