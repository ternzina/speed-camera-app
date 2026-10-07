#!/usr/bin/env python3
"""Private content-addressed R2 storage; fail closed before any PostgreSQL write."""
import datetime as dt,gzip,hashlib,json,subprocess,time,re
from audit_git_safety import PATTERNS
from pathlib import Path
import requests
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'master-db/cache/storage-architecture/objects'
URL='https://speed-camera-archive.ternzina.workers.dev'
SESSION=requests.Session()
def encode(value):return json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
def sha(data):return hashlib.sha256(data).hexdigest()
def check_data_secrets(data,label):
    decoded=gzip.decompress(data) if data.startswith(b'\x1f\x8b') else data
    for name,pattern in PATTERNS.items():
        if re.search(pattern,decoded):raise ValueError('Archive blocked: '+label+' contains '+name)

def request(method,key,body=None):
    if not key.startswith('archive/v1/'):raise ValueError('Invalid archive key')
    data=body or b'';digest=sha(data)
    for attempt in range(3):
        signed=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/sign_r2_archive.cjs'),method,key,digest,str(len(data))],text=True))
        if method=='PUT':signed['Content-Length']=str(len(data))
        try:
            response=SESSION.request(method,URL+'/'+key,data=body,headers=signed,timeout=(15,90))
            if response.status_code==404 and method in ('GET','HEAD'):return None
            response.raise_for_status();return response
        except requests.RequestException:
            if attempt==2:raise
            time.sleep(2**attempt)
def get(key,refresh=False):
    target=CACHE/key
    if target.exists() and not refresh:
        data=target.read_bytes()
        if sha(data)==key.split('/')[-1].split('.')[0]:return data
    response=request('GET',key)
    if response is None:raise FileNotFoundError('Archive not available: '+key)
    data=response.content
    assert sha(data)==key.split('/')[-1].split('.')[0],'R2 object checksum mismatch'
    target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);return data
def put(data,kind='objects'):
    check_data_secrets(data,kind)
    digest=sha(data);suffix={'objects':'.jsonl.gz','files':'.bin.gz','manifests':'.json'}[kind]
    key=f'archive/v1/{kind}/{digest}{suffix}'
    assert len(data)<=16000000,'Archive object exceeds bounded upload limit; shard it'
    remote=request('HEAD',key)
    if remote is None:
        result=request('PUT',key,data).json();assert result['sha256']==digest and result['size']==len(data)
    else:assert int(remote.headers['Content-Length'])==len(data) and remote.headers['X-Object-SHA256']==digest
    # A real read-back is mandatory even when an immutable key already existed.
    restored=get(key,refresh=True);assert restored==data
    return {'key':key,'sha256':digest,'size_bytes':len(data)}
def dataset(name,records,chunk_size=5000):
    chunks=[];batch=[];count=0;batch_bytes=0;whole=hashlib.sha256();pointers={}
    def flush(batch):
        raw=b''.join(encode(r)+b'\n' for r in batch);whole.update(raw)
        ref=put(gzip.compress(raw,compresslevel=6,mtime=0));decoded=gzip.decompress(get(ref['key']));assert decoded==raw
        ref.update(record_count=len(batch),decoded_sha256=sha(raw),decoded_size_bytes=len(raw));chunks.append(ref)
        for r in batch:
            identity=str(r.get('canonical_id',r.get('id','')))
            if identity:pointers[identity]=ref['key']
    for record in records:
        length=len(encode(record))+1
        assert length<=8000000,'Single normalized record exceeds archive shard bound'
        if batch and batch_bytes+length>8000000:flush(batch);batch=[];batch_bytes=0
        batch.append(record);count+=1;batch_bytes+=length
        if len(batch)>=chunk_size:flush(batch);batch=[];batch_bytes=0;print('R2 archive',name,count,flush=True)
    if batch:flush(batch)
    manifest={'schema_version':1,'name':name,'record_count':count,'decoded_sha256':whole.hexdigest(),'chunks':chunks}
    manifest_ref=put(encode(manifest),'manifests')
    return {**manifest,'manifest_ref':manifest_ref},pointers
def read_dataset(manifest_ref,refresh=False):
    key=manifest_ref['key'] if isinstance(manifest_ref,dict) else manifest_ref
    manifest=json.loads(get(key,refresh=refresh));count=0;whole=hashlib.sha256()
    for chunk in manifest['chunks']:
        compressed=get(chunk['key'],refresh=refresh);assert sha(compressed)==chunk['sha256']
        raw=gzip.decompress(compressed);assert sha(raw)==chunk['decoded_sha256'];whole.update(raw)
        rows=[json.loads(line) for line in raw.splitlines()];assert len(rows)==chunk['record_count']
        count+=len(rows);yield from rows
    assert count==manifest['record_count'] and whole.hexdigest()==manifest['decoded_sha256']
def archive_files(paths):
    # Bundle small source files; manifests retain each original byte range/hash.
    files=[];buffer=bytearray();pending=[]
    def flush():
        if not buffer:return
        raw=bytes(buffer);ref=put(gzip.compress(raw,compresslevel=6,mtime=0),'files')
        assert gzip.decompress(get(ref['key']))==raw
        for entry,offset,length in pending:entry['chunks'].append({**ref,'offset':offset,'length':length})
        buffer.clear();pending.clear()
    for path in sorted(set(paths)):
        raw=path.read_bytes();check_data_secrets(raw,str(path.relative_to(ROOT)));entry={'path':str(path.relative_to(ROOT)),'size_bytes':len(raw),'sha256':sha(raw),'chunks':[]};files.append(entry)
        position=0
        while position<len(raw):
            take=min(8000000-len(buffer),len(raw)-position);offset=len(buffer)
            buffer.extend(raw[position:position+take]);pending.append((entry,offset,take));position+=take
            if len(buffer)==8000000:flush()
    flush()
    decoded={}
    for entry in files:
        for x in entry['chunks']:
            if x['key'] not in decoded:decoded[x['key']]=gzip.decompress(get(x['key']))
        restored=b''.join(decoded[x['key']][x['offset']:x['offset']+x['length']] for x in entry['chunks'])
        assert sha(restored)==entry['sha256'] and len(restored)==entry['size_bytes']
    manifest={'schema_version':2,'name':'local-acquisition-history','files':files}
    return {**manifest,'manifest_ref':put(encode(manifest),'manifests')}
