#!/usr/bin/env python3
"""Build deterministic compact trip exports from the existing published endpoint.

Generated data and signing key stay in ignored project-local folders. No DB writes.
Publish immutable objects first; verify all; publish manifest last.
"""
import argparse,collections,datetime as dt,gzip,hashlib,json,time
from pathlib import Path
import requests
from update_cameras import connect
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'master-db/cache/r2-migration'
EDGE='https://ydgzsdlwnurychkbgsmn.supabase.co/functions/v1/camera-export'
DELIVERY='https://speed-camera-data.ternzina.workers.dev'
FIELDS=('id','base_id','type','camera_type','latitude','longitude','speed_limit','direction','direction_code','location','road','road_index','region','name','start','end')
GROUPS=('cameras','speed_cameras','red_light_cameras','checkpoints','average_speed_sections')
def compact(p):
    return {k:p[k] for k in FIELDS if p.get(k) is not None and p[k]!=''}
def encode(v):return json.dumps(v,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
def fetch(code):
    for attempt in range(3):
        try:
            r=requests.get(EDGE,params={'country':code},timeout=90);r.raise_for_status();return r.json()
        except requests.RequestException:
            if attempt==2:raise
            time.sleep(2)
def build():
    BASE.mkdir(parents=True,exist_ok=True)
    out=BASE/'objects';out.mkdir(exist_ok=True)
    with connect() as c:
        c.execute('set transaction isolation level repeatable read read only')
        coverage=[dict(zip(('country_code','total','speed_cameras','red_light_cameras','average_speed_sections','checkpoints'),r)) for r in c.execute('select country_code,total,speed_cameras,red_light_cameras,average_speed_sections,checkpoints from public.camera_country_coverage order by country_code')]
        versions={r[0]:r[1].isoformat() for r in c.execute("select country_code,max(updated_at) from public.camera_records where active and confidence in ('high','medium') group by country_code")}
        red=[dict(zip(('canonical_id','latitude','longitude','road','locality','metadata'),r)) for r in c.execute("select canonical_id,latitude,longitude,road,locality,metadata from public.camera_records where country_code='PL' and active and confidence in ('high','medium') and record_type='red_light' order by id")]
        fingerprint=c.execute("select md5(string_agg(md5(row_to_json(r)::text),'' order by id)) from public.camera_records r").fetchone()[0]
    manifest={'schema_version':1,'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),'countries':[],'total_records':sum(x['total'] for x in coverage),'attribution':'Contains official open data and © OpenStreetMap contributors. OSM-derived data: ODbL 1.0.','license_url':'https://www.openstreetmap.org/copyright'}
    comparisons=[];compression=[]
    for entry in coverage:
        code=entry['country_code'];original=fetch(code)
        (BASE/(code+'-edge.json')).write_bytes(encode(original))
        payload={'schema_version':1,'country':code,'updated_at':versions[code],'record_count':entry['total']}
        for group in GROUPS:
            if group in original:payload[group]=[compact(p) for p in original[group] if not p.get('_example_only')]
        payload['counts']=original.get('counts',{'speed_cameras':original.get('count',0)})
        if code=='PL':
            # Preserve every canonical red-light device and the exact existing physical-site UI.
            # Physical sites are an explicit render projection, not extra canonical cameras.
            payload['red_light_sites']=[compact(p) for p in original['red_light_cameras']]
            payload['red_light_cameras']=[compact({'id':r['canonical_id'],'type':'red_light','latitude':r['latitude'],'longitude':r['longitude'],'road':r['road'],'location':r['locality']}) for r in red]
            assert len(red)==payload['counts']['red_light_devices_source']
        actual=sum(len(payload.get(g,[])) for g in GROUPS)
        assert actual==entry['total'],(code,actual,entry['total'])
        raw=encode(payload);digest=hashlib.sha256(raw).hexdigest()
        path=f'production/v1/countries/{code}/{digest}.json'
        target=out/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
        gz=gzip.compress(raw,compresslevel=9,mtime=0);Path(str(target)+'.gz').write_bytes(gz)
        manifest['countries'].append({**entry,'record_count':actual,'version':digest,'updated_at':versions[code],'checksum':digest,'size_bytes':len(raw),'gzip_size_bytes':len(gz),'path':path,'url':DELIVERY+'/'+path})
        comparisons.append({'country_code':code,'supabase_published':entry['total'],'r2_records':actual,'trip_render_records':actual-len(red)+len(payload['red_light_sites']) if code=='PL' else actual,'checksum':digest,'result':'passed'})
        compression.append({'country_code':code,'legacy_json_bytes':len(encode(original)),'compact_json_bytes':len(raw),'gzip_bytes':len(gz)})
        print(code,actual,len(raw),len(gz),flush=True)
    (out/'production/v1/manifest.json').write_bytes(encode(manifest))
    (BASE/'manifest.json').write_bytes(encode(manifest))
    report={'generated_at':manifest['generated_at'],'database_fingerprint':fingerprint,'published_records':manifest['total_records'],'countries':len(coverage),'country_checks':comparisons,'compression':compression,'json_bytes':sum(x['compact_json_bytes'] for x in compression),'gzip_bytes':sum(x['gzip_bytes'] for x in compression),'legacy_json_bytes':sum(x['legacy_json_bytes'] for x in compression),'objects':len(coverage)+1,'compression_delivery':'Compact identity JSON stored in R2; Cloudflare transparently negotiates gzip/brotli over HTTP. Precompressed gzip files remain local benchmarks only.'}
    (ROOT/'master-db/reports/r2-export-build.json').write_text(json.dumps(report,indent=2)+'\n')
    return report
if __name__=='__main__':
    build()
