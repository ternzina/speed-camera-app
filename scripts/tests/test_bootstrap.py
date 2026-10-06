import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from bootstrap_cameras import speed,direction,compatible,reconcile_snapshots,official_records,osm_records
from osm_cache import replace_phase

def camera(cid='a',heading=0,kind='fixed_speed',lon=4):
    return dict(canonical_id=cid,country_code='BE',latitude=50,longitude=lon,camera_type=kind,
                direction=heading,direction_raw=None,speed_limit=50,confidence='MEDIUM',status='active',
                first_seen_at='2026-01-01T00:00:00Z',last_seen_at='2026-01-01T00:00:00Z',
                camera_sources=[dict(source_code='OSM_BE',source_id=cid,retrieved_at='2026-01-01T00:00:00Z')])

class BootstrapSafety(unittest.TestCase):
    def test_malformed_official_row_does_not_abort_feed(self):
        source=dict(code='TEST_FR',country_code='FR',name='Test',source_type='official_government',license='PDDL',license_url='https://example.org/license',source_url='https://example.org/data',adapter='france')
        valid={'Numéro de radar':'1','Type de radar':'ETF','VMA':'50','Latitude':'48','Longitude':'2'}
        errors=[];rows=list(official_records({'source':source,'retrieved_at':'2026-10-07','data':[{**valid,'Longitude':'bad'},valid]},errors))
        self.assertEqual(len(rows),1);self.assertEqual(len(errors),1);self.assertEqual(rows[0]['longitude'],2)
    def test_units_unknowns(self):
        self.assertEqual(speed('25 mph'),40);self.assertEqual(speed(30,mph=True),48)
        for value in ['50;70','50 @ wet','signals','walk',0,999]:self.assertIsNone(speed(value))
        self.assertIsNone(direction('increasing'));self.assertIsNone(direction('both'));self.assertEqual(direction('WB'),270)
    def test_opposing_directions_and_start_end(self):
        self.assertFalse(compatible(camera(),camera(heading=180)))
        self.assertFalse(compatible(camera(kind='average_speed_start'),camera(kind='average_speed_end')))
        self.assertTrue(compatible(camera(),camera(lon=4.0002)))
        self.assertFalse(compatible(camera(heading=None),camera(heading=None,lon=4.0002)))
    def test_reversed_sections(self):
        a=camera(kind='average_speed_section');a.update(end_latitude=50.01,end_longitude=4.01)
        b={**a,'latitude':50.01,'longitude':4.01,'end_latitude':50,'end_longitude':4}
        self.assertFalse(compatible(a,b))
    def test_refresh_removes_missing_objects(self):
        old={'elements':[{'type':'node','id':1,'lat':50,'lon':4,'tags':{'highway':'speed_camera'}}],
             '_bootstrap':{'retrieved_at':'2026-01-01'}}
        new=replace_phase(old,'speed',[],'2026-01-02');self.assertEqual(new['elements'],[])
        new=replace_phase(old,'seed',[],'2026-01-02',[1]);self.assertEqual(new['elements'],[])
    def test_absence_retains_record_last_seen(self):
        old=camera();rows=[];missing=reconcile_snapshots(rows,[old])
        self.assertEqual(rows[0]['status'],'missing_source');self.assertEqual(rows[0]['last_seen_at'],old['last_seen_at'])
        self.assertEqual(len(missing),1)
    def test_identity_first_seen_and_one_missing_source(self):
        old=camera('old');old['camera_sources'][0]['source_id']='node/1'
        old['camera_sources'].append(dict(source_code='OFFICIAL',source_id='a',retrieved_at='2026-01-01'))
        fresh=camera('fresh');fresh['camera_sources'][0].update(source_id='node/1',retrieved_at='2026-10-07')
        fresh['first_seen_at']='2026-10-07';rows=[fresh];reconcile_snapshots(rows,[old])
        self.assertEqual(rows[0]['canonical_id'],'old');self.assertEqual(rows[0]['first_seen_at'],old['first_seen_at'])
        self.assertEqual(rows[0]['status'],'active');self.assertEqual(rows[0]['last_seen_at'],'2026-10-07')
        self.assertEqual(rows[0]['camera_sources'][1]['source_status'],'missing_source')
    def test_explicit_section_endpoints_only(self):
        e={'_bootstrap':{'retrieved_at':'2026-10-07'},'elements':[
            {'type':'relation','id':1,'tags':{'type':'enforcement','enforcement':'average_speed'},'members':[{'type':'node','ref':2,'role':'from'},{'type':'node','ref':3,'role':'to'}]},
            {'type':'node','id':2,'lat':50,'lon':4},{'type':'node','id':3,'lat':50.01,'lon':4.01}]}
        sections=list(osm_records(e,'BE'));self.assertEqual(len(sections),1);self.assertEqual(sections[0]['end_latitude'],50.01)
        self.assertIsNone(sections[0]['direction'])
        e['elements'][0]['members'][1]['role']='device'
        self.assertFalse(any(x['camera_type']=='average_speed_section' for x in osm_records(e,'BE')))

if __name__=='__main__':unittest.main()
