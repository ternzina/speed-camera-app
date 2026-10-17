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

    def test_verification_rejects_a_changed_speed_limit(self):
        d1.import_operational(self.root,self.database,self.master_key,self.manifest)
        conn=sqlite3.connect(self.database)
        conn.execute("UPDATE cameras SET speed_limit=30 WHERE canonical_id='OSM_DE:node/1'")
        conn.commit();conn.close()
        with self.assertRaisesRegex(RuntimeError,'do not match'):
            d1.verify_operational(self.root,self.database,self.master_key,self.manifest)

if __name__=='__main__':unittest.main()
