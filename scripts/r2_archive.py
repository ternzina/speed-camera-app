#!/usr/bin/env python3
"""Private content-addressed R2 storage; fail closed before any PostgreSQL write."""
import datetime as dt,gzip,hashlib,json,subprocess,time,re,threading,concurrent.futures,mmap
from audit_git_safety import PATTERNS
from pathlib import Path
import requests
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'master-db/cache/storage-architecture/objects'
URL='https://speed-camera-archive.ternzina.workers.dev'
SESSION=requests.Session()
THREAD_SESSIONS=threading.local()
SECRET_PREFIXES={
 'literal_credential':(b'password',b'api_key',b'service_role_key',b'client_secret',b'access_token',b'refresh_token'),
 'sql_password':(b'password',),'private_key':(b'-----begin ',),
 'github_token':(b'ghp_',b'gho_',b'ghu_',b'ghs_',b'ghr_',b'github_pat_'),
 'aws_access_key':(b'akia',b'asia'),'supabase_secret':(b'sb_secret_',),
 'openai_key':(b'sk-',),'google_api_key':(b'aiza',),'slack_token':(b'xoxb-',b'xoxa-',b'xoxp-',b'xoxr-',b'xoxs-'),
 'jwt_key_or_token':(b'eyj',),'credential_url':(b'http://',b'https://'),
}
def encode(value):return json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
def sha(data):return hashlib.sha256(data).hexdigest()
def check_data_secrets(data,label):
    decoded=gzip.decompress(data) if data.startswith(b'\x1f\x8b') else data
    lowercase=decoded.lower()
    for name,pattern in PATTERNS.items():
        # Search mandatory literal prefixes in C, then apply the original regex
        # at each exact byte offset (including its word-boundary checks). This
        # preserves detection without rescanning every PBF with every regex.
        prefixes=SECRET_PREFIXES.get(name)
        if prefixes is None:
            found=re.search(pattern,decoded)
        else:
            found=None;compiled=re.compile(pattern)
            for prefix in prefixes:
                offset=lowercase.find(prefix)
                while offset!=-1:
                    found=compiled.match(decoded,offset)
                    if found:break
                    offset=lowercase.find(prefix,offset+1)
                if found:break
        if found:raise ValueError('Archive blocked: '+label+' contains '+name)

def request(method,key,body=None):
    if not key.startswith('archive/v1/'):raise ValueError('Invalid archive key')
    data=body or b'';digest=sha(data)
    for attempt in range(3):
        signed=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/sign_r2_archive.cjs'),method,key,digest,str(len(data))],text=True))
        if method=='PUT':signed['Content-Length']=str(len(data))
        try:
            if threading.current_thread() is threading.main_thread():session=SESSION
            else:
                if not hasattr(THREAD_SESSIONS,'session'):THREAD_SESSIONS.session=requests.Session()
                session=THREAD_SESSIONS.session
            response=session.request(method,URL+'/'+key,data=body,headers=signed,timeout=(15,90))
            if response.status_code==404 and method in ('GET','HEAD'):return None
            response.raise_for_status();return response
        except requests.RequestException as error:
            response=getattr(error,'response',None)
            if response is not None and response.status_code==503 and 'Worker exceeded resource limits' in response.text:raise
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
def scan_file_secrets(path):
    # Public PBFs can be gigabytes. Regexes see the complete mapped file,
    # including matches spanning shard boundaries, without heap copies.
    with path.open('rb') as source:prefix=source.read(2)
    if path.suffix!='.pbf' or path.stat().st_size==0 or prefix==b'\x1f\x8b':
        check_data_secrets(path.read_bytes(),str(path.relative_to(ROOT)));return
    with path.open('rb') as source,mmap.mmap(source.fileno(),0,access=mmap.ACCESS_READ) as mapped:
        for name,pattern in PATTERNS.items():
            compiled=re.compile(pattern);prefixes=SECRET_PREFIXES.get(name)
            prefixes={'private_key':(b'-----BEGIN ',),'aws_access_key':(b'AKIA',b'ASIA'),'google_api_key':(b'AIza',),'jwt_key_or_token':(b'eyJ',)}.get(name,prefixes)
            found=None
            if prefixes is None:found=compiled.search(mapped)
            elif compiled.flags & re.IGNORECASE:
                prefix_pattern=re.compile(b'|'.join(re.escape(p) for p in prefixes),re.IGNORECASE)
                for candidate in prefix_pattern.finditer(mapped):
                    found=compiled.match(mapped,candidate.start())
                    if found:break
            else:
                for prefix in prefixes:
                    offset=mapped.find(prefix)
                    while offset!=-1:
                        found=compiled.match(mapped,offset)
                        if found:break
                        offset=mapped.find(prefix,offset+1)
                    if found:break
            if found:raise ValueError('Archive blocked: '+str(path.relative_to(ROOT))+' contains '+name)

def archive_files(paths,chunk_bytes=8000000,workers=4,bounded_cache=False):
    assert 1000000<=chunk_bytes<=8000000,'Raw archive chunk bound invalid'
    assert 1<=workers<=4,'Raw archive concurrency bound invalid'
    # Each worker owns its HTTP session. At most four bounded shards are in flight.
    files=[];buffer=bytearray();pending=[];inflight=[]
    def upload(raw,segments):
        def part(start,end):
            data=raw[start:end]
            try:ref=put(gzip.compress(data,compresslevel=6,mtime=0),'files')
            except requests.HTTPError as error:
                response=error.response
                if response is None or response.status_code!=503 or 'Worker exceeded resource limits' not in response.text or end-start<=1000000:raise
                middle=(start+end)//2
                print('R2 resource-bound raw shard split',end-start,flush=True)
                part(start,middle);part(middle,end);return
            assert gzip.decompress(get(ref['key']))==data
            for entry,offset,length,file_offset in segments:
                a,b=max(start,offset),min(end,offset+length)
                if b>a:entry['chunks'].append({**ref,'offset':a-start,'length':b-a,'file_offset':file_offset+a-offset})
            if bounded_cache:(CACHE/ref['key']).unlink(missing_ok=True)
        part(0,len(raw))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        def flush():
            if not buffer:return
            inflight.append(pool.submit(upload,bytes(buffer),pending.copy()))
            buffer.clear();pending.clear()
            if len(inflight)>=workers:inflight.pop(0).result()
        for path in sorted(set(paths)):
            scan_file_secrets(path)
            size=path.stat().st_size;entry={'path':str(path.relative_to(ROOT)),'size_bytes':size,'chunks':[]};files.append(entry)
            position=0;file_hash=hashlib.sha256()
            with path.open('rb') as source:
                while raw:=source.read(chunk_bytes-len(buffer)):
                    take=len(raw);offset=len(buffer);file_hash.update(raw)
                    buffer.extend(raw);pending.append((entry,offset,take,position));position+=take
                    if len(buffer)==chunk_bytes:flush()
            assert position==size,'Raw source changed size during archive'
            entry['sha256']=file_hash.hexdigest()
        flush()
        for future in inflight:future.result()
    # Completion can be out of order; the manifest is always in original file order.
    for entry in files:
        entry['chunks'].sort(key=lambda chunk:chunk['file_offset'])
        restored_hash=hashlib.sha256();restored_size=0
        for x in entry['chunks']:
            assert x['file_offset']==restored_size,'Raw archive file ranges missing or overlapping'
            decoded=gzip.decompress(get(x['key']))
            restored=memoryview(decoded)[x['offset']:x['offset']+x['length']]
            assert len(restored)==x['length'],'Raw archive range truncated'
            restored_hash.update(restored);restored_size+=len(restored)
            if bounded_cache:(CACHE/x['key']).unlink(missing_ok=True)
        assert restored_hash.hexdigest()==entry['sha256'] and restored_size==entry['size_bytes']
    manifest={'schema_version':2,'name':'local-acquisition-history','files':files}
    return {**manifest,'manifest_ref':put(encode(manifest),'manifests')}
