#!/usr/bin/env python3
"""State/province catalog discovery; metadata alone never authorizes ingestion."""
import concurrent.futures,datetime,json,requests,re,hashlib,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];RAW=ROOT/'master-db/raw/coverage-stage/state-catalogs'
STATES='Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming'.split('|')
CANADA='Ontario|Quebec|British Columbia|Alberta|Manitoba|Saskatchewan|Nova Scotia|Toronto|Ottawa|Montreal|Quebec City|Vancouver|Calgary|Edmonton|Winnipeg|Hamilton|Peel|York'.split('|')
def sanitize_catalog(value):
 """Drop signed download URLs from descriptive metadata, never weaken scanning."""
 if isinstance(value,dict):return {k:sanitize_catalog(v) for k,v in value.items()}
 if isinstance(value,list):return [sanitize_catalog(v) for v in value]
 if not isinstance(value,str):return value
 return re.sub(r'https?://[^\s<>\"\']+',lambda m:'[REDACTED SIGNED DOWNLOAD URL]' if re.search(r'(?i)(?:X-Amz-|X-Goog-)(?:Credential|Signature|Security-Token)=',m.group()) else m.group(),value)

def save_catalog(path,result):
 from r2_archive import check_data_secrets
 original=json.dumps(result,ensure_ascii=False).encode();clean=sanitize_catalog(result)
 if clean!=result:
  digest=hashlib.sha256(original).hexdigest()
  quarantine=ROOT/'master-db/cache/coverage-stage/catalog-quarantine';quarantine.mkdir(parents=True,exist_ok=True)
  local=quarantine/(digest+'.json');local.write_bytes(original);os.chmod(local,0o600)
  clean['_metadata_redaction']={'original_local_only_sha256':digest,'policy':'Signed URLs removed from descriptions; original quarantined locally and excluded from all archive/Git inputs.'}
 encoded=json.dumps(clean,ensure_ascii=False).encode();check_data_secrets(encoded,str(path.relative_to(ROOT)))
 path.write_bytes(encoded)
 return clean

def search(job):
 group,region=job;path=RAW/(group+'-'+region.lower().replace(' ','-')+'.json')
 if path.exists():return save_catalog(path,json.loads(path.read_text()))
 query='("speed camera" OR "red light" OR "photo enforcement" OR "automated enforcement" OR "intersection safety") '+region+' (type:"Feature Service" OR type:"Map Service")'
 try:
  r=requests.get('https://www.arcgis.com/sharing/rest/search',params={'f':'json','q':query,'num':100,'sortField':'modified','sortOrder':'desc'},timeout=30);r.raise_for_status();d=r.json()
  result={'region':region,'group':group,'query':query,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'total':d.get('total'),'items':d.get('results',[]),'truncated':d.get('nextStart',-1)!=-1}
 except Exception as e:result={'region':region,'group':group,'error':str(e)}
 result=save_catalog(path,result);print(group,region,len(result.get('items',[])),flush=True);return result
def global_search(extra=False):
 RAW.mkdir(parents=True,exist_ok=True)
 query='("speed camera" OR "red light camera" OR "automated enforcement") (type:"Feature Service" OR type:"Map Service")'
 if extra:query='("photo enforcement" OR "photo radar" OR "intersection safety" OR "safety camera" OR "enforcement camera" OR "section control" OR "redlight") (type:"Feature Service" OR type:"Map Service")'
 rows=[];start=1;visited=set()
 while start!=-1:
  assert start not in visited,'Catalog pagination loop'
  visited.add(start)
  response=requests.get('https://www.arcgis.com/sharing/rest/search',params={'f':'json','q':query,'num':100,'start':start,'sortField':'modified','sortOrder':'desc'},timeout=30)
  response.raise_for_status();data=response.json();assert 'error' not in data,'Catalog API error'
  rows.extend(data.get('results',[]));start=data.get('nextStart',-1)
 assert len({r['id'] for r in rows})==len(rows)==data['total'],'Catalog changed during acquisition; retry'
 result={'query':query,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'total':data['total'],'pages':len(visited),'pagination_complete':True,'items':rows,'note':'Metadata and public access do not establish dataset reuse rights or current camera operation.'}
 result=save_catalog(RAW/('global-enforcement-additional-catalog.json' if extra else 'global-enforcement-catalog.json'),result)
 print('Global catalog',len(rows),'items;',len(visited),'verified pages',flush=True)
 return result

def main(global_only=False,global_extra=False):
 if global_only or global_extra:return global_search(extra=global_extra)
 RAW.mkdir(parents=True,exist_ok=True)
 jobs=[('US',s) for s in STATES]+[('CA',s) for s in CANADA]
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as p:results=list(p.map(search,jobs))
 unique={r['id']:r for x in results for r in x.get('items',[])}
 save_catalog(RAW/'catalog.json',{'regions':results,'unique_items':list(unique.values())})
 print('Distinct items',len(unique),flush=True)
if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser();parser.add_argument('--global-only',action='store_true')
 parser.add_argument('--global-extra',action='store_true');args=parser.parse_args()
 main(args.global_only,args.global_extra)
