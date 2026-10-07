import datetime, sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from korea_standard import normalize_rows,permission_label
from fetch_expansion_official import records

class KoreanStandard(unittest.TestCase):
    def test_license_comes_from_selected_permission_not_boilerplate(self):
        label='<strong class="key">이용허락범위</strong><div class="value">'
        restricted=label+'CC BY-NC</div><footer>이용허락범위 제한 없음</footer>'
        self.assertEqual(permission_label(restricted),'CC BY-NC')
        self.assertEqual(permission_label(label+'<a href="/policy"> 이용허락범위 제한 없음 </a></div>'),'이용허락범위 제한 없음')
        self.assertIsNone(permission_label('<footer>이용허락범위 제한 없음</footer>'))
        self.assertIsNone(permission_label(restricted+restricted))
    def test_changed_count_and_download_limit_fail_before_any_data_page(self):
        import tempfile
        from unittest.mock import Mock,patch
        import korea_standard as k
        for total,expected in [(43763,43764),(51000,51000)]:
            response=Mock();response.content=b'{}'
            response.json.return_value={'totalCount':total,'tableVO':{}}
            with tempfile.TemporaryDirectory(dir=k.ROOT/'master-db/cache') as directory:
                with patch.object(k,'ROOT',Path(directory)),patch.object(k,'get',return_value=response) as fetch:
                    with self.assertRaisesRegex(AssertionError,'Changed count or public download limit'):
                        k.acquire({'expected_raw_rows':expected},Mock())
                    self.assertEqual(fetch.call_count,1)
    def test_cross_source_speed_signal_overlap_requires_device_identity(self):
        from expand_cameras import nearby_ambiguity
        a={'latitude':37.5,'longitude':127.1,'camera_type':'red_light','direction':None,
           'camera_sources':[{'source_code':'KR_DATA_GO_STANDARD','source_id':'a'}]}
        b={'latitude':37.5001,'longitude':127.1,'camera_type':'fixed_speed','direction':None,
           'camera_sources':[{'source_code':'OSM_KR','source_id':'node/1','source_type':'openstreetmap'}]}
        self.assertIn('separate physical identity',nearby_ambiguity(a,b))
        a['direction']=0;b['direction']=180
        self.assertIsNone(nearby_ambiguity(a,b))
    def row(self, **changes):
        return dict(INSTT_NM='Agency',INSTT_CODE='123',CTPRVN_NM='Province',SIGNGU_NM='District',
                    MNLSS_REGLT_CAMERA_MANAGE_NO='a',LATITUDE='37.5',LONGITUDE='127.1',
                    REGLT_SE='01',REFERENCE_DATE='2026-09-01',ROAD_ROUTE_DRC='01',**changes)
    def parse(self, rows):
        return normalize_rows(rows,{'Agency'},datetime.date(2026,10,7))
    def test_code_dictionary_excludes_parking_bus_lanes_and_unknown(self):
        for value in ['03','04','99','5','school_zone','','0001','01+unknown']:
            row=self.row();row['REGLT_SE']=value
            self.assertEqual(self.parse([row])[0],[])
        for code,typ in [('1','fixed_speed'),('02','red_light'),('1+02','speed_and_red_light')]:
            row=self.row();row['REGLT_SE']=code
            self.assertEqual(self.parse([row])[0][0]['properties']['_coverage_type'],typ)
    def test_unknown_rights_and_ambiguous_local_identity_excluded(self):
        row=self.row();row['INSTT_NM']='Other'
        self.assertEqual(self.parse([row])[0],[])
        self.assertEqual(self.parse([self.row(),self.row()])[0],[])
        row=self.row();row['INSTT_CODE']='456'
        self.assertEqual(len(self.parse([self.row(),row])[0]),2)
    def test_invalid_coordinates_not_geocoded(self):
        for value in ['NaN','0',None,'bad','51']:
            row=self.row();row['LATITUDE']=value
            self.assertEqual(self.parse([row])[0],[])
    def test_stale_and_incomplete_sections_remain_low(self):
        for changes in [{'REFERENCE_DATE':'2024-01-01'},{'REFERENCE_DATE':'2099-01-01'},
                        {'REFERENCE_DATE':''},{'REGLT_SCTN_LC_SE':'01'},{'OVRSPD_REGLT_SCTN_LT':'3.3'}]:
            row=self.row();row.update(changes)
            self.assertTrue(self.parse([row])[0][0]['properties']['_coverage_review_reason'])
    def test_route_direction_code_never_becomes_degree_bearing(self):
        rows,_=self.parse([self.row()])
        source={'code':'KR_TEST','country_code':'KR','name':'Government','source_url':'https://example.org',
                'source_type':'official_government','license':'Unrestricted','license_url':'https://example.org/license',
                'id_fields':['_coverage_id'],'type_field':'_coverage_type','types':{'fixed_speed':'fixed_speed'},
                'direction_field':'_coverage_direction','confidence_override':'MEDIUM',
                'review_reason_field':'_coverage_review_reason','reference_date_field':'REFERENCE_DATE'}
        r=list(records({'source':source,'rows':rows,'retrieved_at':'2026-10-07'}))[0]
        self.assertIsNone(r['direction'])
        self.assertEqual(r['direction_raw'],'route_upbound')
        self.assertEqual(r['confidence'],'MEDIUM')
        self.assertEqual(r['camera_sources'][0]['source_updated_at'],'2026-09-01')
