#!/usr/bin/env python3
"""Acquire only UA/PL public primary feeds. Run before preparing a review batch."""
import datetime,json,re,hashlib,subprocess,concurrent.futures
from pathlib import Path
import requests
ROOT=Path(__file__).resolve().parents[1];RAW=ROOT/'master-db/raw/ua-pl';CACHE=ROOT/'master-db/cache/ua-pl'
def fetch(url,path,data=None):
 r=requests.get(url,timeout=90) if data is None else requests.post(url,data=data,timeout=90);r.raise_for_status();assert r.content;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(r.content);return r

def parse_mvs(text):
 value=re.search(r'window.pkdList\s*=\s*(\[.*?\]);',text,re.S).group(1)
 try:rows=json.loads(value)
 except json.JSONDecodeError:rows=json.loads(value.replace('\\"','"').replace('\\\\u','\\u'))
 assert rows and len({x['uuid'] for x in rows})==len(rows)
 return rows

def main():
 RAW.mkdir(parents=True,exist_ok=True);CACHE.mkdir(parents=True,exist_ok=True)
 h=fetch('https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen',RAW/'canard-map.html').text
 for name in ('fotoradaryPP','fotoradaryOPP','fotoradaryRL'):(RAW/(name+'.base64')).write_text(re.search(name+r'\s*:\s*"([^"]+)"',h).group(1))
 fetch('https://www.canard.gitd.gov.pl/cms/o/pl.canard.cms.portlet.mapa/js/lz-string.min.js',CACHE/'lz-string.js')
 subprocess.run(['node','scripts/decode_canard_review.cjs'],cwd=ROOT,check=True)
 namespace=re.search(r'namespace:"([^"]+)"',h).group(1);work=[]
 for name,kind,directory in [('fotoradaryPP','PP','device-details'),('fotoradaryRL','RL','device-details'),('fotoradaryOPP','OPP','opp-details')]:
  url=re.search(r'obj'+kind+r'DataURL:"([^"]+)"',h).group(1)
  for item in json.loads((RAW/(name+'.json')).read_text()):work.append((url,RAW/directory/(str(item['id'])+'.utf16'),{namespace+'id':str(item['id'])}))
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(lambda x:fetch(x[0],x[1],x[2]),work))
 subprocess.run(['node','scripts/decode_canard_review.cjs'],cwd=ROOT,check=True)
 r=fetch('https://bdr.mvs.gov.ua/pkd/',RAW/'mvs-map.html');(RAW/'mvs-devices.json').write_text(json.dumps(parse_mvs(r.text),ensure_ascii=False))
 d=fetch('https://data.gov.ua/api/3/action/package_show?id=b7b6349c-d109-45e7-af37-b73310f73cf5',RAW/'npu-metadata.json').json()['result'];assert d['license_id']=='cc-by'
 for resource in d['resources']:
  if resource.get('format','').lower() in ('csv','cvs'):fetch(resource['url'],RAW/('npu-'+resource['id']+'.csv'))
 fetch('https://www.gov.pl/web/gitd/ponowne-wykorzystanie-informacji-sektora-publicznego',RAW/'gitd-reuse.html')
 report={'scope':['UA','PL'],'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_files':[{'path':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in RAW.rglob('*') if p.is_file()]};(CACHE/'acquisition.json').write_text(json.dumps(report,ensure_ascii=False))
if __name__=='__main__':main()
