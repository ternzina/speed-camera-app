import copy,sys,unittest
from unittest.mock import patch
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from bootstrap_cameras import osm_records
from fetch_expansion_official import records

class ExpansionSafety(unittest.TestCase):
    def test_append_only_cannot_steal_source_link_under_new_canonical_id(self):
        import update_cameras
        class Connection:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def execute(self,query,*args):
                if query.startswith('select canonical_id from'):return []
                if query.startswith('select s.code,l.external_id'):return [('OSM_BE','node/3')]
                raise AssertionError('Unexpected operation')
        record={'canonical_id':'new-alias','camera_sources':[{'source_code':'OSM_BE','source_id':'node/3'}]}
        with patch('cold_storage_pipeline.enabled',return_value=False),patch.object(update_cameras,'connect',return_value=Connection()):
            with self.assertRaisesRegex(AssertionError,'existing source identity'):update_cameras.sync([record],append_only=True)
    def test_government_section_requires_explicit_start(self):
        source=dict(code='TEST',country_code='ES',name='Test',source_url='https://example.org',license='CC0',license_url='https://example.org/license',id_fields=['id'],camera_type='average_speed_section',start_latitude_field='start_lat',start_longitude_field='start_lon')
        row={'geometry':{'type':'Point','coordinates':[-3.7,40.4]},'properties':{'id':1,'start_lat':'40.39','start_lon':'-3.69'}}
        record=list(records({'source':source,'retrieved_at':'2026-10-07','rows':[row]}))[0]
        self.assertEqual((record['latitude'],record['end_latitude']),(40.39,40.4))
        row['properties'].pop('start_lat')
        record=list(records({'source':source,'retrieved_at':'2026-10-07','rows':[row]}))[0]
        self.assertEqual(record['confidence'],'LOW')
        self.assertNotEqual(record['camera_type'],'average_speed_section')
    def test_inactive_average_speed_relation_is_not_published(self):
        nodes=[{'type':'node','id':i,'lat':50+i/100,'lon':4,'tags':{}} for i in (1,2)]
        relation={'type':'relation','id':9,'tags':{'type':'enforcement','enforcement':'average_speed','disused':'yes'},'members':[{'type':'node','ref':1,'role':'from'},{'type':'node','ref':2,'role':'to'}]}
        result=list(osm_records({'_bootstrap':{'retrieved_at':'2026-10-07'},'elements':nodes+[relation]},'BE'))
        section=next(r for r in result if r['camera_type']=='average_speed_section')
        self.assertEqual(section['status'],'candidate')

    def test_current_relation_uses_its_new_explicit_endpoint(self):
        nodes=[{'type':'node','id':i,'lat':50+i/100,'lon':4,'tags':{}} for i in (1,2)]
        old={'type':'relation','id':9,'version':1,'tags':{'type':'enforcement','enforcement':'average_speed'},'members':[{'type':'node','ref':1,'role':'from'},{'type':'node','ref':2,'role':'to'}]}
        current=copy.deepcopy(old);current['version']=2;current['members'][1]['ref']=3
        extra={'type':'node','id':3,'lat':50.03,'lon':4,'tags':{}}
        result=list(osm_records({'_bootstrap':{'retrieved_at':'2026-10-07'},'elements':nodes+[old]},'BE',{3:extra},{9:current}))
        section=next(r for r in result if r['camera_type']=='average_speed_section')
        self.assertEqual(section['end_latitude'],50.03)
        self.assertEqual(old['members'][1]['ref'],2)
    def test_primary_deletion_overrides_stale_node(self):
        node={'type':'node','id':3,'version':8,'lat':50,'lon':4,'tags':{'highway':'speed_camera'}}
        tombstone={'type':'node','id':3,'visible':False}
        self.assertEqual(list(osm_records({'_bootstrap':{'retrieved_at':'2026-10-07'},'elements':[node]},'BE',{3:tombstone})),[])
    def test_current_relation_removal_does_not_inherit_stale_enforcement(self):
        node={'type':'node','id':3,'lat':50,'lon':4,'tags':{}}
        rel={'type':'relation','id':1,'version':1,'tags':{'type':'enforcement','enforcement':'traffic_signals'},'members':[{'type':'node','ref':3,'role':'device'}]}
        deleted={'type':'relation','id':1,'visible':False}
        self.assertEqual(list(osm_records({'_bootstrap':{'retrieved_at':'2026-10-07'},'elements':[node,rel]},'BE',{}, {1:deleted})),[])
    def test_dual_enforcement_from_separate_parent_relations(self):
        node={'type':'node','id':3,'lat':50,'lon':4,'tags':{}}
        relations=[{'type':'relation','id':i,'tags':{'type':'enforcement','enforcement':mode},'members':[{'type':'node','ref':3,'role':'device'}]} for i,mode in [(1,'maxspeed'),(2,'traffic_signals')]]
        result=list(osm_records({'_bootstrap':{'retrieved_at':'2026-10-07'},'elements':relations+[node]},'BE'))
        self.assertEqual(result[0]['camera_type'],'speed_and_red_light')
        self.assertEqual(result[0]['camera_sources'][0]['raw_payload']['node_tags'],{})
    def test_append_only_rejects_existing_identity_before_any_write(self):
        import update_cameras
        class Connection:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def execute(self,query,*args):
                self.assert_read(query)
                return [('already-present',)]
            def assert_read(self,query):
                if not query.startswith('select canonical_id from'):raise AssertionError('Unexpected operation')
        with patch('cold_storage_pipeline.enabled',return_value=False),patch.object(update_cameras,'connect',return_value=Connection()):
            with self.assertRaisesRegex(AssertionError,'cannot modify existing'):
                update_cameras.sync([{'canonical_id':'already-present'}],append_only=True)
    def test_explicit_alias_preserves_original_tags(self):
        node={'type':'node','id':1,'lat':50,'lon':4,'tags':{'camera:enforcement':'red_light'}}
        original=copy.deepcopy(node)
        result=list(osm_records({'_bootstrap':{'retrieved_at':'2026-10-07'},'elements':[node]},'BE'))
        self.assertEqual(result[0]['camera_type'],'red_light')
        self.assertEqual(node,original)
        self.assertEqual(result[0]['camera_sources'][0]['raw_payload']['node_tags'],original['tags'])
    def test_generic_cctv_is_not_an_enforcement_camera(self):
        node={'type':'node','id':1,'lat':50,'lon':4,'tags':{'man_made':'surveillance','surveillance:type':'camera','surveillance:zone':'traffic'}}
        self.assertEqual(list(osm_records({'_bootstrap':{'retrieved_at':'2026-10-07'},'elements':[node]},'BE')),[])
    def test_retired_and_uncertain_government_records_stay_unpublished(self):
        s=dict(code='TEST',country_code='US',name='Test',source_url='https://example.org',license='CC0',license_url='https://example.org/license',id_fields=['id'],retired_fields=['Retired'])
        row={'geometry':{'type':'Point','coordinates':[-77,39]},'properties':{'id':'a','Retired':123}}
        result=list(records({'source':s,'retrieved_at':'2026-10-07','rows':[row]}))
        self.assertEqual(result[0]['status'],'candidate')
        s['candidate_reason']='Approximate location'
        result=list(records({'source':s,'retrieved_at':'2026-10-07','rows':[row]}))
        self.assertEqual(result[0]['confidence'],'LOW')
        self.assertNotEqual(result[0]['status'],'active')
    def test_conditional_school_limit_is_not_guessed(self):
        s=dict(code='TEST',country_code='US',name='Test',source_url='https://example.org',license='CC0',license_url='https://example.org/license',id_fields=['id'])
        row={'geometry':{'type':'Point','coordinates':[-77,39]},'properties':{'id':'a','BeaconSpeedLimit':20,'NonSchoolSpeedLimit':30}}
        r=list(records({'source':s,'retrieved_at':'2026-10-07','rows':[row]}))[0]
        self.assertIsNone(r['speed_limit'])

if __name__=='__main__':unittest.main()
