#!/usr/bin/env python3
"""Archive full camera tables and prove restoration before allowing cleanup."""
import json,datetime
from psycopg.types.json import Jsonb
from update_cameras import connect
from r2_archive import ROOT,dataset,read_dataset,put,encode
TABLES=['public.camera_records','public.camera_source_links','public.camera_sources','public.camera_import_runs','public.camera_import_staging']
TABLES += ['camera_backup_20261007.'+n for n in ['camera_records','camera_source_links','camera_sources','camera_import_runs']]
OUT=ROOT/'master-db/backups/storage-architecture/snapshot.json'
def main():
    state=json.loads(OUT.read_text()) if OUT.exists() else {'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'tables':{}}
    with connect() as conn:
        for table in TABLES:
            if table in state['tables']:continue
            def rows():
                offset=0
                while True:
                    page=conn.execute('select * from camera_bootstrap_private.archive_page(%s,%s,1000)',(table,offset)).fetchall()
                    if not page:break
                    for row in page:yield row[0]
                    offset+=len(page)
            manifest,_=dataset(table,rows())
            state['tables'][table]=manifest
            OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_bytes(encode(state))
        proof={}
        schema=json.loads((OUT.parent/'schema.json').read_text())
        types={'int8':'bigint','int4':'integer','float8':'double precision','bool':'boolean','timestamptz':'timestamp with time zone','text':'text','jsonb':'jsonb','uuid':'uuid'}
        source_ids={r['id'] for r in read_dataset(state['tables']['public.camera_sources']['manifest_ref'])}
        for table,manifest in state['tables'].items():
            namespace,name=table.split('.')
            columns=sorted([c for c in schema['columns'] if c['table_schema']==namespace and c['table_name']==name],key=lambda c:c['ordinal_position'])
            definitions=','.join('"'+c['column_name']+'" '+types[c['udt_name']] for c in columns)
            conn.execute('create temp table archive_restore_check ('+definitions+')')
            remote=list(read_dataset(manifest['manifest_ref'],refresh=True))
            for offset in range(0,len(remote),1000):
                conn.execute('insert into archive_restore_check select * from jsonb_populate_recordset(null::pg_temp.archive_restore_check,%s)',(Jsonb(remote[offset:offset+1000]),))
            order='batch_id,chunk_no' if name=='camera_import_staging' else 'id'
            conn.execute('create index on archive_restore_check ('+order+')')
            if table in ('public.camera_records','public.camera_source_links'):
                aggregate="count(*),encode(sha256(convert_to(string_agg(encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex'),'' order by id),'UTF8')),'hex')"
                restored_count,restored_hash=conn.execute('select '+aggregate+' from archive_restore_check r').fetchone()
                live_count,live_hash=conn.execute('select '+aggregate+' from '+table+' r').fetchone()
                assert restored_count==live_count==manifest['record_count'] and restored_hash==live_hash,table+' typed restore fingerprint mismatch'
                restored=remote
            else:
                restored=[row[0] for row in conn.execute('select to_jsonb(r) from archive_restore_check r order by '+order)]
                live=[];offset=0
                while True:
                    page=conn.execute('select * from camera_bootstrap_private.archive_page(%s,%s,1000)',(table,offset)).fetchall()
                    if not page:break
                    live.extend(row[0] for row in page);offset+=len(page)
                assert live==remote==restored,table+' full typed restoration mismatch'
                restored_hash=None
            assert len(restored)==manifest['record_count']
            if name!='camera_import_staging':assert len({r['id'] for r in restored})==len(restored)
            if table=='public.camera_records':camera_ids={r['id'] for r in restored}
            if table=='public.camera_source_links':assert all(r['camera_record_id'] in camera_ids and r['source_id'] in source_ids for r in restored)
            proof[table]={'count':len(restored),'exact_full_row_restoration':True,'typed_postgres_restore':True,'column_count':len(columns),'original_and_restored_row_sha256':restored_hash}
            conn.execute('drop table archive_restore_check')
            print('Restoration verified',table,len(restored),flush=True)
        state['restoration_proof']=proof
        state['verified_at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
        state['root_ref']=put(encode({k:v for k,v in state.items() if k!='root_ref'}),'manifests')
        OUT.write_bytes(encode(state))
    print('All camera archives restored and verified; no original data deleted.',flush=True)
if __name__=='__main__':main()
