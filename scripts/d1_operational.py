#!/usr/bin/env python3
"""Build and check a local D1-compatible operational database.

The source is the pinned local normalized master and the local public R2
manifest. This module never opens Supabase, R2, or a remote D1 database.
"""
import gzip,hashlib,json,math,sqlite3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCHEMA_PATH=ROOT/'cloudflare/camera-data/d1/schema.sql'
ARCHIVE_ROOT=ROOT/'master-db/cache/storage-architecture/objects'
PUBLIC_MANIFEST=ROOT/'master-db/cache/r2-migration/manifest.json'
DEFAULT_DATABASE=ROOT/'master-db/cache/d1-operational/camalert-operational.sqlite'
PINNED_MASTER_KEY='archive/v1/manifests/fd4cede54c8cd2e1d513d5ca05c0b520ddd13ccfc7ee0f02bf5ea8f000d9648b.json'
PINNED_MASTER_SHA='5c1d560481035c7a4b8a5805ae50e9088c5ef6e23b092576b0015c21be713d39'
PINNED_MANIFEST_SHA='7824306f2409909985e482bf110b65bf6c21a3444a21716b55c7a081a9159f4b'
PINNED={'cameras':123579,'published':114794,'unpublished':8785,'countries':122,'ua_delivery':426,'pl_delivery':903,'pl_render_sites':68,'master_decoded_sha256':PINNED_MASTER_SHA,'manifest_sha256':PINNED_MANIFEST_SHA,'master_key':PINNED_MASTER_KEY}
DELIVERY_GROUPS=('cameras','speed_cameras','red_light_cameras','checkpoints','average_speed_sections')
CAMERA_FIELDS=('canonical_id','country_code','camera_type','status','confidence','latitude','longitude','end_latitude','end_longitude','speed_limit','direction','direction_raw','road_ref','road_name','city','region','publication_review','first_seen_at','last_seen_at','updated_at','source_codes','source_count','published','lat_cell','lon_cell','chunk_key','row_sha256')

def camera_upsert_sql(publication_guard=False):
    # A repeat with the same row_sha256 writes nothing. A different checksum
    # updates the stored row. The publication guard additionally refuses a
    # published=1 write unless that incoming row already meets the public rule,
    # so a candidate cannot be switched on by a partial correction.
    placeholders=','.join('?' for _ in CAMERA_FIELDS)
    assignments=','.join(f'{name}=excluded.{name}' for name in CAMERA_FIELDS if name!='canonical_id')
    guard='cameras.row_sha256<>excluded.row_sha256'
    if publication_guard:
        guard+=" AND (excluded.published=0 OR (excluded.status IN ('active','missing_source') AND lower(excluded.confidence) IN ('high','medium')))"
    return f'INSERT INTO cameras({",".join(CAMERA_FIELDS)}) VALUES({placeholders}) ON CONFLICT(canonical_id) DO UPDATE SET {assignments} WHERE {guard}'

def safe_update_cameras(conn, rows, archive_ref):
    # Updates only the supplied cameras. A matching row_sha256 writes nothing.
    # published=1 is stored only when the incoming row meets the public rule.
    # Moderation rows for every other camera stay as they are.
    sql=camera_upsert_sql(publication_guard=True)
    updated=[]
    for values in rows:
        record=dict(zip(CAMERA_FIELDS, values))
        before=conn.execute('SELECT row_sha256 FROM cameras WHERE canonical_id=?',(record['canonical_id'],)).fetchone()
        conn.execute(sql, values)
        after=conn.execute('SELECT row_sha256,published FROM cameras WHERE canonical_id=?',(record['canonical_id'],)).fetchone()
        if before is None or before[0]!=after[0]:updated.append(record['canonical_id'])
        if after[1]:
            conn.execute('DELETE FROM camera_moderation WHERE canonical_id=?',(record['canonical_id'],))
        else:
            conn.execute('''INSERT INTO camera_moderation(canonical_id,country_code,status,confidence,archive_ref) VALUES(?,?,?,?,?)
                ON CONFLICT(canonical_id) DO UPDATE SET country_code=excluded.country_code,status=excluded.status,confidence=excluded.confidence,archive_ref=excluded.archive_ref
                WHERE camera_moderation.country_code<>excluded.country_code OR camera_moderation.status<>excluded.status OR camera_moderation.confidence<>excluded.confidence OR camera_moderation.archive_ref<>excluded.archive_ref''',
                (record['canonical_id'],record['country_code'],record['status'],record['confidence'],archive_ref))
    return updated

def sha(data):return hashlib.sha256(data).hexdigest()
def encode(value):return json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
def published(row):return row.get('status') in ('active','missing_source') and str(row.get('confidence','')).lower() in ('high','medium')
def cell(value):return math.floor(float(value)*1000)
def optional_int(value):
    if value in (None,''):return None
    number=int(value)
    if isinstance(value,float) and not number==value:raise ValueError('non-integral speed')
    return number
def optional_float(value):
    if value in (None,''):return None
    return float(value)
def source_codes(row):return sorted({s.get('source_code') for s in row.get('camera_sources') or [] if s.get('source_code')})

def camera_tuple(row,chunk_key):
    codes=source_codes(row)
    stored={
        'canonical_id':row['canonical_id'],'country_code':row['country_code'],'camera_type':row['camera_type'],
        'status':row['status'],'confidence':row['confidence'],'latitude':float(row['latitude']),'longitude':float(row['longitude']),
        'end_latitude':optional_float(row.get('end_latitude')),'end_longitude':optional_float(row.get('end_longitude')),
        'speed_limit':optional_int(row.get('speed_limit')),'direction':optional_float(row.get('direction')),
        'direction_raw':row.get('direction_raw'),'road_ref':row.get('road_ref'),'road_name':row.get('road_name'),
        'city':row.get('city'),'region':row.get('region'),'publication_review':row.get('publication_review'),
        'first_seen_at':row.get('first_seen_at'),'last_seen_at':row.get('last_seen_at'),'updated_at':row.get('updated_at'),
        'source_codes':json.dumps(codes,ensure_ascii=False,separators=(',',':')),'source_count':len(row.get('camera_sources') or []),
        'published':1 if published(row) else 0,'lat_cell':cell(row['latitude']),'lon_cell':cell(row['longitude']),'chunk_key':chunk_key}
    stored['row_sha256']=sha(encode({k:stored[k] for k in stored if k!='row_sha256'}))
    return tuple(stored[k] for k in CAMERA_FIELDS)

def connect(database):
    database.parent.mkdir(parents=True,exist_ok=True)
    conn=sqlite3.connect(database)
    conn.row_factory=sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    return conn

def apply_schema(conn):
    row=conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='camera_export_ids'").fetchone()
    if row and 'canonical_key' not in (row['sql'] or ''):
        conn.execute('DROP TABLE camera_export_ids')
    conn.executescript(SCHEMA_PATH.read_text())

def export_key(canonical):
    return '' if canonical is None else canonical

def seal_dataset(archive_root,name,rows):
    raw=b''.join(encode(row)+b'\n' for row in rows)
    compressed=gzip.compress(raw,compresslevel=6,mtime=0)
    digest=sha(compressed)
    key=f'archive/v1/objects/{digest}.jsonl.gz'
    path=archive_root/key
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(compressed)
    manifest={'schema_version':1,'name':name,'record_count':len(rows),'decoded_sha256':sha(raw),'chunks':[{'key':key,'sha256':digest,'record_count':len(rows),'decoded_sha256':sha(raw),'decoded_size_bytes':len(raw),'size_bytes':len(compressed)}]}
    blob=encode(manifest)
    manifest_key=f'archive/v1/manifests/{sha(blob)}.json'
    target=archive_root/manifest_key
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(blob)
    return manifest_key

def iter_dataset(archive_root,manifest_key):
    # read_verified_dataset both validates and yields. A generator cannot also
    # return the manifest, so validation is streamed and the manifest is read
    # again only as parsed JSON after the checksum of its own file is known.
    path=archive_root/manifest_key
    blob=path.read_bytes()
    if sha(blob)!=path.stem:raise RuntimeError('master manifest is not content-addressed: '+path.name)
    manifest=json.loads(blob)
    whole=hashlib.sha256();count=0
    for chunk in manifest['chunks']:
        compressed=(archive_root/chunk['key']).read_bytes()
        if sha(compressed)!=chunk['sha256']:raise RuntimeError('chunk checksum mismatch: '+chunk['key'])
        raw=gzip.decompress(compressed)
        if sha(raw)!=chunk['decoded_sha256']:raise RuntimeError('decoded chunk checksum mismatch: '+chunk['key'])
        lines=raw.splitlines()
        if len(lines)!=chunk['record_count']:raise RuntimeError('chunk record count mismatch: '+chunk['key'])
        whole.update(raw);count+=len(lines)
        for line in lines:yield chunk['key'],json.loads(line)
    if count!=manifest['record_count'] or whole.hexdigest()!=manifest['decoded_sha256']:
        raise RuntimeError('normalized master checksum mismatch')

def load_public_manifest(path):
    raw=path.read_bytes();data=json.loads(raw)
    return sha(raw),data

def country_export(data_root,entry):
    path=data_root/'master-db/cache/r2-migration/objects'/entry['path']
    raw=path.read_bytes()
    if sha(raw)!=entry['checksum'] or len(raw)!=entry['size_bytes']:
        raise RuntimeError('country export checksum mismatch: '+entry['country_code'])
    return json.loads(raw)

def remember_source(catalog,fields):
    code=fields.get('source_code')
    if not code:return
    current=catalog.get(code)
    if current is None:
        catalog[code]=fields;return
    if fields.get('in_public_manifest'):current['in_public_manifest']=1
    for key,value in fields.items():
        if key=='in_public_manifest' or value in (None,''):continue
        if current.get(key) in (None,''):current[key]=value
        elif current.get(key)!=value and key in ('source_url','source_type','country_code'):
            current.setdefault('conflicts',[]).append(key)

def receipts(archive_root):
    directory=archive_root/'archive/v1/manifests'
    for path in sorted(directory.glob('*.json')):
        blob=path.read_bytes()
        if sha(blob)!=path.stem:continue
        data=json.loads(blob)
        master=data.get('normalized_master') if isinstance(data,dict) else None
        if not isinstance(master,dict) or 'key' not in master or 'candidate_count' not in data:continue
        verified=1 if data.get('verified_readback') is True else 0
        yield {'root_key':'archive/v1/manifests/'+path.name,'created_at':data.get('created_at'),'batch':data.get('batch'),'observation_count':data.get('observation_count'),'candidate_count':data.get('candidate_count'),'normalized_manifest':master['key'],'verified_readback':verified}

def resolve_delivery(country,point,by_id,source_index):
    export_id=str(point.get('id'))
    if export_id in by_id:return export_id
    hits=set()
    for source in point.get('provenance') or []:
        hits|=source_index.get((country,source.get('source_code'),str(source.get('source_id'))),set())
    if len(hits)!=1:raise RuntimeError(f'{country} export id {export_id} matched {len(hits)} canonical rows')
    return next(iter(hits))

def resolve_projection(country,point,source_index):
    hits=set()
    for source in point.get('provenance') or []:
        hits|=source_index.get((country,source.get('source_code'),str(source.get('source_id'))),set())
    return hits

def import_operational(data_root,database,master_key,manifest_path,expectations=None):
    archive_root=data_root/'master-db/cache/storage-architecture/objects'
    manifest_sha,manifest=load_public_manifest(manifest_path)
    if expectations and manifest_sha!=expectations['manifest_sha256']:
        raise RuntimeError('public manifest checksum is not the pinned R2 manifest')
    if sum(c['record_count'] for c in manifest['countries'])!=manifest['total_records']:
        raise RuntimeError('manifest country counts do not add up')
    conn=connect(database)
    try:
        apply_schema(conn)
        before=conn.total_changes
        conn.execute('BEGIN IMMEDIATE')
        conn.execute('CREATE TEMP TABLE imported_camera(canonical_id TEXT PRIMARY KEY)')
        conn.execute('CREATE TEMP TABLE imported_export(country_code TEXT, export_group TEXT, export_id TEXT, canonical_key TEXT NOT NULL, PRIMARY KEY(country_code,export_group,export_id,canonical_key))')
        conn.execute('CREATE TEMP TABLE imported_source(source_code TEXT PRIMARY KEY)')
        conn.execute('CREATE TEMP TABLE imported_registry(root_key TEXT PRIMARY KEY)')
        catalog={};source_index={};by_id={'UA':{},'PL':{}};counts={'cameras':0,'published':0}
        camera_sql=camera_upsert_sql(publication_guard=True)
        for chunk_key,row in iter_dataset(archive_root,master_key):
            values=camera_tuple(row,chunk_key)
            conn.execute(camera_sql,values)
            conn.execute('INSERT INTO imported_camera(canonical_id) VALUES(?)',(row['canonical_id'],))
            counts['cameras']+=1
            if values[CAMERA_FIELDS.index('published')]:counts['published']+=1
            for source in row.get('camera_sources') or []:
                remember_source(catalog,{'source_code':source.get('source_code'),'source_name':source.get('source_name'),'source_type':source.get('source_type'),'country_code':row['country_code'],'source_url':source.get('source_url'),'license':source.get('license'),'license_url':source.get('license_url'),'in_public_manifest':0})
                if row['country_code'] in by_id:
                    source_index.setdefault((row['country_code'],source.get('source_code'),str(source.get('source_id'))),set()).add(row['canonical_id'])
                    by_id[row['country_code']][row['canonical_id']]=row
        if expectations and (counts['cameras']!=expectations['cameras'] or counts['published']!=expectations['published']):
            raise RuntimeError(f"master counts {counts['cameras']}/{counts['published']} do not match the pinned audit")
        for entry in manifest.get('sources') or []:
            remember_source(catalog,{'source_code':entry.get('code'),'source_name':entry.get('name'),'country_code':entry.get('country_code'),'source_url':entry.get('source_url'),'manifest_license':entry.get('license'),'in_public_manifest':1})
        for code,fields in sorted(catalog.items()):
            fields.pop('conflicts',None)
            conn.execute('''INSERT INTO sources(source_code,source_name,source_type,country_code,source_url,license,license_url,manifest_license,in_public_manifest)
                VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(source_code) DO UPDATE SET source_name=excluded.source_name,source_type=excluded.source_type,country_code=excluded.country_code,source_url=excluded.source_url,license=excluded.license,license_url=excluded.license_url,manifest_license=excluded.manifest_license,in_public_manifest=excluded.in_public_manifest
                WHERE sources.source_name IS NOT excluded.source_name OR sources.source_type IS NOT excluded.source_type OR sources.country_code IS NOT excluded.country_code OR sources.source_url IS NOT excluded.source_url OR sources.license IS NOT excluded.license OR sources.license_url IS NOT excluded.license_url OR sources.manifest_license IS NOT excluded.manifest_license OR sources.in_public_manifest<>excluded.in_public_manifest''',
                (code,fields.get('source_name'),fields.get('source_type'),fields.get('country_code'),fields.get('source_url'),fields.get('license'),fields.get('license_url'),fields.get('manifest_license'),fields.get('in_public_manifest',0)))
            conn.execute('INSERT INTO imported_source(source_code) VALUES(?)',(code,))
        delivery=0;render=0
        for entry in manifest['countries']:
            if entry['country_code'] not in ('UA','PL'):continue
            payload=country_export(data_root,entry)
            for group in DELIVERY_GROUPS:
                for point in payload.get(group) or []:
                    canonical=resolve_delivery(entry['country_code'],point,by_id[entry['country_code']],source_index)
                    conn.execute('''INSERT INTO camera_export_ids(country_code,export_group,export_id,canonical_id,canonical_key,role,base_id) VALUES(?,?,?,?,?,?,?)
                        ON CONFLICT(country_code,export_group,export_id,canonical_key) DO UPDATE SET role=excluded.role,base_id=excluded.base_id
                        WHERE camera_export_ids.role<>excluded.role OR camera_export_ids.base_id IS NOT excluded.base_id''',
                        (entry['country_code'],group,str(point.get('id')),canonical,export_key(canonical),'delivery',point.get('base_id')))
                    conn.execute('INSERT INTO imported_export(country_code,export_group,export_id,canonical_key) VALUES(?,?,?,?)',(entry['country_code'],group,str(point.get('id')),export_key(canonical)))
                    delivery+=1
            for point in payload.get('red_light_sites') or []:
                hits=resolve_projection(entry['country_code'],point,source_index) or {None}
                for canonical in sorted(hits,key=lambda item:'' if item is None else item):
                    conn.execute('''INSERT INTO camera_export_ids(country_code,export_group,export_id,canonical_id,canonical_key,role,base_id) VALUES(?,?,?,?,?,?,?)
                        ON CONFLICT(country_code,export_group,export_id,canonical_key) DO NOTHING''',
                        (entry['country_code'],'red_light_sites',str(point.get('id')),canonical,export_key(canonical),'render_projection',point.get('base_id')))
                    conn.execute('INSERT OR IGNORE INTO imported_export(country_code,export_group,export_id,canonical_key) VALUES(?,?,?,?)',(entry['country_code'],'red_light_sites',str(point.get('id')),export_key(canonical)))
                    render+=1
        conn.execute('''INSERT INTO camera_moderation(canonical_id,country_code,status,confidence,archive_ref)
            SELECT canonical_id,country_code,status,confidence,? FROM cameras WHERE published=0
            ON CONFLICT(canonical_id) DO UPDATE SET country_code=excluded.country_code,status=excluded.status,confidence=excluded.confidence,archive_ref=excluded.archive_ref
            WHERE camera_moderation.country_code<>excluded.country_code OR camera_moderation.status<>excluded.status OR camera_moderation.confidence<>excluded.confidence OR camera_moderation.archive_ref<>excluded.archive_ref''',(master_key,))
        registry=0;archive_root_key=None
        for receipt in receipts(archive_root):
            conn.execute('''INSERT INTO archive_registry(root_key,created_at,batch,observation_count,candidate_count,normalized_manifest,verified_readback) VALUES(?,?,?,?,?,?,?)
                ON CONFLICT(root_key) DO UPDATE SET created_at=excluded.created_at,batch=excluded.batch,observation_count=excluded.observation_count,candidate_count=excluded.candidate_count,normalized_manifest=excluded.normalized_manifest,verified_readback=excluded.verified_readback
                WHERE archive_registry.created_at IS NOT excluded.created_at OR archive_registry.batch IS NOT excluded.batch OR archive_registry.observation_count IS NOT excluded.observation_count OR archive_registry.candidate_count IS NOT excluded.candidate_count OR archive_registry.normalized_manifest<>excluded.normalized_manifest OR archive_registry.verified_readback<>excluded.verified_readback''',
                (receipt['root_key'],receipt['created_at'],receipt['batch'],receipt['observation_count'],receipt['candidate_count'],receipt['normalized_manifest'],receipt['verified_readback']))
            conn.execute('INSERT INTO imported_registry(root_key) VALUES(?)',(receipt['root_key'],))
            registry+=1
            if receipt['normalized_manifest']==master_key and receipt['verified_readback'] and (archive_root_key is None or (receipt['created_at'] or '')>(archive_root_key[0] or '')):
                archive_root_key=(receipt['created_at'],receipt['root_key'])
        if archive_root_key is None:raise RuntimeError('no verified archive receipt points at the imported master')
        master_sha=json.loads((archive_root/master_key).read_text())['decoded_sha256']
        if expectations and master_sha!=expectations['master_decoded_sha256']:raise RuntimeError('master decoded checksum is not the pinned audit')
        conn.execute('''INSERT INTO storage_control(id,normalized_manifest,archive_root,delivery_pending,master_decoded_sha256,master_record_count,manifest_sha256,manifest_generated_at,updated_at) VALUES(1,?,?,0,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET normalized_manifest=excluded.normalized_manifest,archive_root=excluded.archive_root,delivery_pending=excluded.delivery_pending,master_decoded_sha256=excluded.master_decoded_sha256,master_record_count=excluded.master_record_count,manifest_sha256=excluded.manifest_sha256,manifest_generated_at=excluded.manifest_generated_at,updated_at=excluded.updated_at
            WHERE storage_control.normalized_manifest<>excluded.normalized_manifest OR storage_control.archive_root<>excluded.archive_root OR storage_control.delivery_pending<>excluded.delivery_pending OR storage_control.master_decoded_sha256<>excluded.master_decoded_sha256 OR storage_control.master_record_count<>excluded.master_record_count OR storage_control.manifest_sha256<>excluded.manifest_sha256 OR storage_control.manifest_generated_at<>excluded.manifest_generated_at OR storage_control.updated_at<>excluded.updated_at''',
            (master_key,archive_root_key[1],master_sha,counts['cameras'],manifest_sha,manifest['generated_at'],manifest['generated_at']))
        unpublished=counts['cameras']-counts['published']
        conn.execute('''INSERT INTO import_runs(master_decoded_sha256,manifest_sha256,finished_at,camera_count,published_count,unpublished_count,source_count,moderation_count,delivery_alias_count,render_projection_count,registry_count,result) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(master_decoded_sha256) DO NOTHING''',(master_sha,manifest_sha,manifest['generated_at'],counts['cameras'],counts['published'],unpublished,len(catalog),unpublished,delivery,render,registry,'passed'))
        conn.execute('DELETE FROM camera_export_ids WHERE (country_code,export_group,export_id,canonical_key) NOT IN (SELECT country_code,export_group,export_id,canonical_key FROM imported_export)')
        conn.execute('DELETE FROM camera_moderation WHERE canonical_id NOT IN (SELECT canonical_id FROM cameras WHERE published=0)')
        conn.execute('DELETE FROM sources WHERE source_code NOT IN (SELECT source_code FROM imported_source)')
        conn.execute('DELETE FROM archive_registry WHERE root_key NOT IN (SELECT root_key FROM imported_registry)')
        conn.execute('DELETE FROM cameras WHERE canonical_id NOT IN (SELECT canonical_id FROM imported_camera)')
        conn.commit()
        # Temporary membership tables are rewritten on every run. Persistent
        # upserts are the only changes that matter for idempotency.
        changed=conn.total_changes-before-(counts['cameras']+len(catalog)+delivery+render+registry)
    except Exception:
        conn.rollback();raise
    finally:
        conn.close()
    report={'database':str(database),'master_key':master_key,'manifest_sha256':manifest_sha,'cameras':counts['cameras'],'published':counts['published'],'unpublished':counts['cameras']-counts['published'],'sources':len(catalog),'delivery_aliases':delivery,'render_projections':render,'registry_rows':registry,'row_changes':changed}
    if expectations:verify_operational(data_root,database,master_key,manifest_path,expectations)
    return report

def verify_operational(data_root,database,master_key,manifest_path,expectations=None):
    archive_root=data_root/'master-db/cache/storage-architecture/objects'
    manifest_sha,manifest=load_public_manifest(manifest_path)
    conn=connect(database)
    try:
        control=conn.execute('SELECT * FROM storage_control WHERE id=1').fetchone()
        if control is None:raise RuntimeError('storage_control is missing')
        if control['normalized_manifest']!=master_key or control['manifest_sha256']!=manifest_sha or control['delivery_pending']!=0:
            raise RuntimeError('storage_control does not point at the verified local master and manifest')
        master_rows=[]
        for chunk_key,row in iter_dataset(archive_root,master_key):
            master_rows.append(camera_tuple(row,chunk_key))
        database_rows=conn.execute(f'SELECT {",".join(CAMERA_FIELDS)} FROM cameras ORDER BY canonical_id').fetchall()
        master_sorted=sorted(master_rows,key=lambda item:item[0])
        if [tuple(row) for row in database_rows]!=master_sorted:
            raise RuntimeError('D1 cameras do not match the local normalized master')
        published_count=sum(row[CAMERA_FIELDS.index('published')] for row in master_sorted)
        by_country={}
        for row in master_sorted:
            if row[CAMERA_FIELDS.index('published')]:by_country[row[1]]=by_country.get(row[1],0)+1
        manifest_countries={entry['country_code']:entry for entry in manifest['countries']}
        if by_country.keys()!=manifest_countries.keys():raise RuntimeError('published countries differ from the R2 manifest')
        for code,entry in manifest_countries.items():
            if by_country[code]!=entry['record_count']:raise RuntimeError(f'{code} published {by_country[code]} != manifest {entry["record_count"]}')
        for code in manifest_countries:
            if code in ('UA','PL'):continue
            payload=country_export(data_root,manifest_countries[code])
            export_ids={str(point.get('id')) for group in DELIVERY_GROUPS for point in payload.get(group) or []}
            canonical={row[0] for row in master_sorted if row[1]==code and row[CAMERA_FIELDS.index('published')]}
            if export_ids!=canonical:raise RuntimeError(code+' delivery ids are not canonical ids')
        for code,expected_group in (('UA','cameras'),('PL',None)):
            if code not in manifest_countries:continue
            payload=country_export(data_root,manifest_countries[code])
            aliases=conn.execute("SELECT export_group,export_id,canonical_id FROM camera_export_ids WHERE country_code=? AND role='delivery'",(code,)).fetchall()
            file_ids={(group,str(point.get('id'))) for group in DELIVERY_GROUPS for point in payload.get(group) or []}
            stored_ids={(row['export_group'],row['export_id']) for row in aliases}
            if file_ids!=stored_ids:raise RuntimeError(code+' delivery ids are not fully stored')
            covered={row['canonical_id'] for row in aliases}
            canonical={row[0] for row in master_sorted if row[1]==code and row[CAMERA_FIELDS.index('published')]}
            if covered!=canonical:raise RuntimeError(code+' canonical rows are missing a delivery id')
            if expected_group and any(row['export_group']!=expected_group for row in aliases):
                raise RuntimeError('Ukraine delivery ids are not in the cameras group')
        moderation=conn.execute('SELECT COUNT(*) FROM camera_moderation').fetchone()[0]
        unpublished=len(master_sorted)-published_count
        if moderation!=unpublished:raise RuntimeError('moderation index does not match unpublished cameras')
        if conn.execute('SELECT COUNT(*) FROM camera_moderation m JOIN cameras c ON c.canonical_id=m.canonical_id WHERE c.published<>0').fetchone()[0]:
            raise RuntimeError('a published camera is in moderation')
        missing_sources=conn.execute('SELECT COUNT(*) FROM json_each(?) ',(json.dumps([entry.get('code') for entry in manifest.get('sources') or []]),)).fetchone()
        del missing_sources
        manifest_codes={entry.get('code') for entry in manifest.get('sources') or []}
        stored_codes={row[0] for row in conn.execute('SELECT source_code FROM sources WHERE in_public_manifest=1')}
        if manifest_codes!=stored_codes:raise RuntimeError('public source catalog is not stored')
        if not conn.execute('SELECT 1 FROM archive_registry WHERE normalized_manifest=? AND verified_readback=1',(master_key,)).fetchone():
            raise RuntimeError('archive registry has no verified receipt for this master')
        duplicates=conn.execute('''SELECT COUNT(*) FROM (SELECT 1 FROM camera_export_ids GROUP BY country_code,export_group,export_id,canonical_key HAVING COUNT(*)>1)''').fetchone()[0]
        if duplicates:raise RuntimeError('duplicate export ids are stored')
        if expectations:
            checks={'cameras':len(master_sorted),'published':published_count,'unpublished':unpublished,'countries':len(manifest_countries),'ua_delivery':conn.execute("SELECT COUNT(*) FROM camera_export_ids WHERE country_code='UA' AND role='delivery'").fetchone()[0],'pl_delivery':conn.execute("SELECT COUNT(*) FROM camera_export_ids WHERE country_code='PL' AND role='delivery'").fetchone()[0],'pl_render_sites':conn.execute("SELECT COUNT(DISTINCT export_id) FROM camera_export_ids WHERE country_code='PL' AND role='render_projection'").fetchone()[0],'master_decoded_sha256':control['master_decoded_sha256'],'manifest_sha256':manifest_sha,'master_key':control['normalized_manifest']}
            for key,value in expectations.items():
                if checks[key]!=value:raise RuntimeError(f'{key} is {checks[key]}, pinned audit expected {value}')
        return {'cameras':len(master_sorted),'published':published_count,'unpublished':unpublished,'countries':len(manifest_countries),'manifest_sha256':manifest_sha,'result':'passed'}
    finally:
        conn.close()

def database_size(database):
    conn=connect(database)
    try:
        conn.execute('VACUUM')
        page_size,pages=conn.execute('PRAGMA page_size').fetchone()[0],conn.execute('PRAGMA page_count').fetchone()[0]
        index_bytes=None
        try:
            index_bytes=conn.execute("SELECT COALESCE(SUM(pgsize),0) FROM dbstat WHERE name NOT LIKE 'sqlite%' AND (SELECT type FROM sqlite_master m WHERE m.name=dbstat.name)='index'").fetchone()[0]
        except sqlite3.OperationalError:
            index_bytes=None
        return {'page_size':page_size,'pages':pages,'database_bytes':page_size*pages,'index_bytes':index_bytes}
    finally:
        conn.close()
