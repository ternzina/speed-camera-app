import sqlite3,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import d1_operational as d1

def country_file(root,code,payload):
    raw=d1.encode(payload)
    digest=d1.sha(raw)
    path=root/'master-db/cache/r2-migration/objects/production/v1/countries'/code/f'{digest}.json'
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(raw)
    return {'country_code':code,'record_count':sum(len(payload.get(group) or []) for group in d1.DELIVERY_GROUPS),'checksum':digest,'size_bytes':len(raw),'path':f'production/v1/countries/{code}/{digest}.json'}

class OperationalImport(unittest.TestCase):
    def build(self):
        root=Path(self.directory.name)
        rows=[
            {'canonical_id':'OSM_DE:node/1','country_code':'DE','camera_type':'fixed_speed','status':'active','confidence':'HIGH','latitude':52.5,'longitude':13.4,'speed_limit':50,'direction':90,'camera_sources':[{'source_code':'OSM_DE','source_id':'node/1','source_name':'OSM DE','source_type':'openstreetmap','source_url':'https://www.openstreetmap.org/node/1','license':'ODbL-1.0'}]},
            {'canonical_id':'OSM_DE:node/2','country_code':'DE','camera_type':'fixed_speed','status':'review','confidence':'LOW','latitude':52.6,'longitude':13.5,'camera_sources':[{'source_code':'OSM_DE','source_id':'node/2'}]},
            {'canonical_id':'UA_NPU_CURRENT:1','country_code':'UA','camera_type':'fixed_speed','status':'active','confidence':'HIGH','latitude':50.48,'longitude':30.45,'speed_limit':50,'publication_review':'ua_pl_official_v1','camera_sources':[{'source_code':'UA_NPU_CURRENT','source_id':'1','source_name':'NPU','source_type':'official_government','source_url':'https://data.gov.ua/dataset/example','license':'CC BY 4.0'}]},
            {'canonical_id':'OSM_PL:node/1','country_code':'PL','camera_type':'fixed_speed','status':'active','confidence':'HIGH','latitude':52.2,'longitude':21.0,'speed_limit':50,'direction':10,'publication_review':'ua_pl_official_v1','camera_sources':[{'source_code':'CANARD_PL','source_id':'speed_camera:91780517','source_name':'CANARD','source_type':'official_government','source_url':'https://www.canard.gitd.gov.pl/','license':'reuse'}]}]
        archive=root/'master-db/cache/storage-architecture/objects'
        master_key=d1.seal_dataset(archive,'normalized-master-test',rows)
        de=country_file(root,'DE',{'speed_cameras':[{'id':'OSM_DE:node/1','type':'speed_camera','latitude':52.5,'longitude':13.4}]})
        ua=country_file(root,'UA',{'cameras':[{'id':'UA_NPU_CURRENT:1','provenance':[{'source_code':'UA_NPU_CURRENT','source_id':'1'}]}]})
        pl=country_file(root,'PL',{'speed_cameras':[{'id':'91780517','provenance':[{'source_code':'CANARD_PL','source_id':'speed_camera:91780517'}]}],'red_light_sites':[{'id':'91352745','provenance':[{'source_code':'CANARD_PL','source_id':'speed_camera:91780517'}]},{'id':'pl-red-001','provenance':[]}]})
        manifest={'schema_version':1,'generated_at':'2026-10-17T00:00:00+00:00','total_records':3,'countries':[de,ua,pl],'sources':[{'code':'OSM_DE','name':'OSM DE','country_code':'DE','source_url':'https://www.openstreetmap.org/node/1','license':'ODbL-1.0'}]}
        manifest_path=root/'master-db/cache/r2-migration/manifest.json'
        manifest_path.parent.mkdir(parents=True,exist_ok=True)
        manifest_path.write_bytes(d1.encode(manifest))
        receipt={'created_at':'2026-10-17T00:00:00+00:00','candidate_count':1,'observation_count':4,'normalized_master':{'key':master_key},'verified_readback':True,'batch':'test'}
        blob=d1.encode(receipt)
        (archive/'archive/v1/manifests'/f'{d1.sha(blob)}.json').write_bytes(blob)
        return root,master_key,manifest_path

    def setUp(self):
        self.directory=tempfile.TemporaryDirectory()
        self.root,self.master_key,self.manifest=self.build()
        self.database=Path(self.directory.name)/'operational.sqlite'

    def tearDown(self):
        self.directory.cleanup()

    def test_import_is_idempotent_and_keeps_polish_export_id(self):
        first=d1.import_operational(self.root,self.database,self.master_key,self.manifest)
        self.assertEqual(first['cameras'],4)
        self.assertEqual(first['published'],3)
        self.assertEqual(first['unpublished'],1)
        second=d1.import_operational(self.root,self.database,self.master_key,self.manifest)
        self.assertEqual(second['row_changes'],0)
        report=d1.verify_operational(self.root,self.database,self.master_key,self.manifest)
        self.assertEqual(report['result'],'passed')
        conn=sqlite3.connect(self.database)
        export=conn.execute("SELECT canonical_id FROM camera_export_ids WHERE country_code='PL' AND role='delivery'").fetchone()[0]
        self.assertEqual(export,'OSM_PL:node/1')
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM camera_export_ids WHERE role='render_projection'").fetchone()[0],2)
        self.assertIsNone(conn.execute("SELECT canonical_id FROM camera_export_ids WHERE export_id='pl-red-001'").fetchone()[0])
        self.assertEqual(conn.execute("SELECT canonical_id FROM camera_moderation").fetchone()[0],'OSM_DE:node/2')
        self.assertEqual(conn.execute('SELECT COUNT(*) FROM import_runs').fetchone()[0],1)
        conn.close()

    def test_repeat_sql_keeps_the_existing_source_row(self):
        import d1_export_remaining_batch as batch
        import d1_export_ua_pl_slice as trial
        self.assertTrue(all("DO NOTHING" in clause and "DO UPDATE" not in clause for clause in trial.CONFLICT.values()))
        probe=sqlite3.connect(':memory:')
        self.assertEqual(probe.execute('SELECT '+trial.sql_value('a\nb')).fetchone()[0],'a\nb')
        self.assertEqual(probe.execute('SELECT '+trial.sql_value('a\r\nb')).fetchone()[0],'a\r\nb')
        probe.close()
        schema=(Path(__file__).resolve().parents[2]/'cloudflare/camera-data/d1/schema.sql').read_text()
        origin=sqlite3.connect(':memory:')
        origin.executescript(schema)
        origin.execute("INSERT INTO storage_control(id,normalized_manifest,archive_root,delivery_pending,master_decoded_sha256,master_record_count,manifest_sha256,manifest_generated_at,updated_at) VALUES(1,'manifest','root-key',0,'sha',1,'manifest-sha','2026-10-17T00:00:00Z','2026-10-17T00:00:00Z')")
        origin.execute("INSERT INTO archive_registry(root_key,created_at,batch,observation_count,candidate_count,normalized_manifest,verified_readback) VALUES('root-key','2026-10-17T00:00:00Z','keep',1,0,'manifest',1)")
        origin.execute("INSERT INTO archive_registry(root_key,created_at,batch,observation_count,candidate_count,normalized_manifest,verified_readback) VALUES('later-key','2026-10-17T00:00:00Z','later',1,0,'manifest',1)")
        origin.execute("INSERT INTO sources(source_code,source_name,source_type,country_code,source_url,license,license_url,manifest_license,in_public_manifest) VALUES('OSM_DE','original','openstreetmap','DE',NULL,NULL,NULL,NULL,0)")
        origin.execute("INSERT INTO cameras(canonical_id,country_code,camera_type,status,confidence,latitude,longitude,source_codes,source_count,published,lat_cell,lon_cell,chunk_key,row_sha256) VALUES('OSM_DE:node/1','DE','fixed_speed','active','high',52.5,13.4,'[\"OSM_DE\"]',1,1,52,13,'chunk','sha-1')")
        origin.execute("INSERT INTO cameras(canonical_id,country_code,camera_type,status,confidence,latitude,longitude,source_codes,source_count,published,lat_cell,lon_cell,chunk_key,row_sha256) VALUES('OSM_DE:node/2','DE','fixed_speed','review','low',52.6,13.5,'[\"OSM_DE\"]',1,0,52,13,'chunk','sha-2')")
        origin.execute("INSERT INTO camera_moderation(canonical_id,country_code,status,confidence,archive_ref) VALUES('OSM_DE:node/2','DE','review','low','manifest')")
        rendered=batch.render_sql(origin,{
            'source_rows':1,'registry_rows':1,'cameras':2,'unpublished':1,
            'parts':[{'country_code':'DE','cameras':2,'unpublished':1,'first_canonical_id':'OSM_DE:node/1','last_canonical_id':'OSM_DE:node/2'}],
        },set())
        self.assertNotIn('DO UPDATE',rendered)
        self.assertNotIn('INSERT INTO storage_control',rendered)
        self.assertNotIn('INSERT INTO import_runs',rendered)
        fresh=sqlite3.connect(':memory:')
        fresh.executescript(schema)
        fresh.executescript(rendered)
        before=fresh.total_changes
        fresh.executescript(rendered)
        self.assertEqual(fresh.total_changes-before,0)
        fresh.execute("INSERT INTO sources(source_code,source_name,source_type,country_code,source_url,license,license_url,manifest_license,in_public_manifest) VALUES('OSM_DE','replaced','openstreetmap','DE',NULL,NULL,NULL,NULL,1) "+trial.CONFLICT['sources'])
        self.assertEqual(fresh.execute("SELECT source_name,in_public_manifest FROM sources").fetchone(),('original',0))
        self.assertEqual(fresh.execute("SELECT COUNT(*) FROM cameras").fetchone()[0],2)
        self.assertEqual(fresh.execute("SELECT speed_limit FROM cameras WHERE canonical_id='OSM_DE:node/1'").fetchone()[0],None)
        origin.close();fresh.close()

    def test_guarded_update_changes_a_different_row_and_keeps_a_candidate_unpublished(self):
        schema=(Path(__file__).resolve().parents[2]/'cloudflare/camera-data/d1/schema.sql').read_text()
        def row(**overrides):
            base={'canonical_id':'OSM_DE:node/9','country_code':'DE','camera_type':'fixed_speed','status':'candidate','confidence':'low','latitude':52.5,'longitude':13.4,'end_latitude':None,'end_longitude':None,'speed_limit':50,'direction':None,'direction_raw':None,'road_ref':None,'road_name':None,'city':None,'region':None,'publication_review':None,'first_seen_at':None,'last_seen_at':None,'updated_at':None,'source_codes':'["OSM_DE"]','source_count':1,'published':0,'lat_cell':52,'lon_cell':13,'chunk_key':'chunk','row_sha256':'sha-old'}
            base.update(overrides)
            return tuple(base[name] for name in d1.CAMERA_FIELDS)
        def stored(conn):
            return conn.execute("SELECT speed_limit,status,published,row_sha256 FROM cameras").fetchone()
        unguarded=sqlite3.connect(':memory:')
        unguarded.executescript(schema)
        unguarded.execute(d1.camera_upsert_sql(),row())
        unguarded.execute(d1.camera_upsert_sql(),row(published=1,confidence='high',speed_limit=80,row_sha256='sha-publish'))
        self.assertEqual(stored(unguarded),(80,'candidate',1,'sha-publish'))
        unguarded.close()
        conn=sqlite3.connect(':memory:')
        conn.executescript(schema)
        guarded=d1.camera_upsert_sql(publication_guard=True)
        conn.execute(guarded,row())
        before=conn.total_changes
        conn.execute(guarded,row())
        self.assertEqual(conn.total_changes-before,0)
        conn.execute("INSERT INTO cameras("+",".join(d1.CAMERA_FIELDS)+") VALUES("+",".join("?" for _ in d1.CAMERA_FIELDS)+") ON CONFLICT(canonical_id) DO NOTHING",row(speed_limit=70,row_sha256='sha-ignored'))
        self.assertEqual(stored(conn),(50,'candidate',0,'sha-old'))
        conn.execute(guarded,row(published=1,confidence='high',speed_limit=80,row_sha256='sha-blocked'))
        self.assertEqual(stored(conn),(50,'candidate',0,'sha-old'))
        conn.execute(guarded,row(speed_limit=60,row_sha256='sha-speed'))
        self.assertEqual(stored(conn),(60,'candidate',0,'sha-speed'))
        conn.execute(guarded,row(status='active',confidence='high',published=1,speed_limit=60,row_sha256='sha-public'))
        self.assertEqual(stored(conn),(60,'active',1,'sha-public'))
        before=conn.total_changes
        conn.execute(guarded,row(status='active',confidence='high',published=1,speed_limit=60,row_sha256='sha-public'))
        self.assertEqual(conn.total_changes-before,0)
        conn.close()

    def test_verification_rejects_a_changed_speed_limit(self):
        d1.import_operational(self.root,self.database,self.master_key,self.manifest)
        conn=sqlite3.connect(self.database)
        conn.execute("UPDATE cameras SET speed_limit=30 WHERE canonical_id='OSM_DE:node/1'")
        conn.commit();conn.close()
        with self.assertRaisesRegex(RuntimeError,'do not match'):
            d1.verify_operational(self.root,self.database,self.master_key,self.manifest)

if __name__=='__main__':unittest.main()
