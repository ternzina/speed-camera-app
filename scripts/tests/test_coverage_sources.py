import datetime,sys,unittest,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fetch_expansion_official import records
from fetch_osm_extracts import relevant
class CoverageSources(unittest.TestCase):
 def source(self):
  return {'code':'TEST_PRF','country_code':'BR','name':'Test government source','source_url':'https://example.org/cameras','license':'Open data','license_url':'https://example.org/license','id_fields':['id'],'camera_type':'fixed_speed','latitude_field':'lat','longitude_field':'lon','certificate_expiry_field':'expiry','speed_field':'speed'}
 def parse(self,row):return list(records({'source':self.source(),'retrieved_at':'2026-10-07','rows':[row]}))
 def test_certificate_and_actual_coordinates(self):
  r=self.parse({'id':'a','lat':-23.2,'lon':-46.5,'expiry':'2099-01-01T00:00:00Z','speed':80})[0]
  self.assertEqual((r['latitude'],r['longitude'],r['speed_limit'],r['status']),(-23.2,-46.5,80,'active'))
 def test_expired_or_missing_certificate_is_unpublished(self):
  for expiry in ('2000-01-01T00:00:00Z',None):
   self.assertEqual(self.parse({'id':'a','lat':-23.2,'lon':-46.5,'expiry':expiry})[0]['status'],'candidate')
 def test_missing_coordinate_not_geocoded(self):
  self.assertEqual(self.parse({'id':'a','lat':None,'lon':-46.5,'expiry':'2099-01-01'}),[])
 def test_additional_enforcement_predicates(self):
  for tags in ({'enforcement':'red_light'},{'type':'section_control'},{'camera:enforcement':'speed'},{'traffic_signals:red_light_camera':'yes'}):self.assertTrue(relevant(tags))
  self.assertFalse(relevant({'surveillance':'camera','surveillance:purpose':'security'}))


class GovernmentCsvSnapshotGuards(unittest.TestCase):
 def test_truncated_raw_snapshot_is_not_offered(self):
  import tempfile
  from unittest.mock import Mock,patch
  import fetch_expansion_official as f
  response=Mock();response.content=b'id,lat,lon\n1,50,30\n'
  source={'code':'TEST_SNAPSHOT','format':'csv','download_url':'https://example.org/data.csv','delimiter':',','latitude_field':'lat','longitude_field':'lon','expected_raw_rows':2}
  with tempfile.TemporaryDirectory(dir=f.ROOT/'master-db/cache') as folder,patch.object(f,'RAW',Path(folder)),patch.object(f,'get',return_value=response),patch.object(f,'capture_payload'):
   with self.assertRaisesRegex(AssertionError,'Incomplete raw'):f.download(source,refresh=True)
   self.assertFalse((Path(folder)/'TEST_SNAPSHOT.json').exists())
 def test_null_direction_omitted_but_original_evidence_preserved(self):
  source={'code':'TEST_NULL','country_code':'UA','name':'Government source','source_url':'https://example.org/cameras','license':'CC-BY-4.0','license_url':'https://creativecommons.org/licenses/by/4.0/','id_fields':['id'],'camera_type':'fixed_speed','direction_field':'direction','null_values':['null']}
  row={'type':'Feature','geometry':{'type':'Point','coordinates':[30,50]},'properties':{'id':'1','direction':'null'}}
  result=list(records({'source':source,'retrieved_at':'2026-10-07','rows':[row]}))[0]
  self.assertIsNone(result['direction_raw'])
  self.assertEqual(row['properties']['direction'],'null')

class EnforcementAliases(unittest.TestCase):
 def test_specific_aliases_and_generic_surveillance(self):
  from bootstrap_cameras import osm_records
  cases=[({'surveillance:type':'speed_camera'},'fixed_speed'),({'camera:type':'speed_camera'},'fixed_speed'),({'camera:type':'redlight'},'red_light'),({'camera:type':'speed;red_light'},'speed_and_red_light'),({'camera:type':'red_light; speed'},'speed_and_red_light'),({'camera:type':'speed; average_speed'},'other_enforcement'),({'camera:type':'ALPR'},None),({'surveillance':'camera','surveillance:purpose':'security'},None)]
  for tags,expected in cases:
   with self.subTest(tags=tags):
    data={'_bootstrap':{'retrieved_at':'2026-10-07'},'elements':[{'type':'node','id':1,'lat':55,'lon':10,'tags':tags}]}
    result=list(osm_records(data,'DK'))
    self.assertEqual([r['camera_type'] for r in result],[] if expected is None else [expected])
    self.assertEqual(relevant(tags),expected is not None)


class OperationalReadRecovery(unittest.TestCase):
 def test_only_read_is_retried_after_connection_loss(self):
  from unittest.mock import patch,MagicMock
  import expand_cameras as expansion
  first=MagicMock();first.__enter__.side_effect=expansion.pipeline.psycopg.OperationalError('connection closed')
  second=MagicMock();cursor=second.__enter__.return_value.cursor.return_value.__enter__.return_value
  cursor.__iter__.return_value=iter([tuple(range(len(expansion.FIELDS)))])
  with patch.object(expansion.pipeline,'connect',side_effect=[first,second]) as connect,patch.object(expansion.time,'sleep'):
   rows=expansion.actual_snapshot()
  self.assertEqual(connect.call_count,2)
  self.assertEqual(rows,[dict(zip(expansion.FIELDS,range(len(expansion.FIELDS))))])
  self.assertTrue(cursor.execute.call_args.args[0].startswith('select '))
  self.assertEqual(cursor.itersize,2000)


class AdditionalFeedSafety(unittest.TestCase):
 def test_repeated_bom_and_reported_non_coordinate_rows(self):
  from fetch_expansion_official import csv_rows
  source={'latitude_field':'緯度','longitude_field':'經度','delimiter':',','skip_invalid_coordinates':True};report={}
  body='\ufeff\ufeff設備編號,緯度,經度\n1,24.13584,120.68225\n2,區間測速,區間測速\n3,,120.1\n'.encode()
  rows=csv_rows(body,source,report)
  self.assertEqual(rows[0]['properties']['設備編號'],'1')
  self.assertEqual(rows[0]['geometry']['coordinates'],[120.68225,24.13584])
  self.assertEqual(report,{'raw_records':3,'missing_coordinates':1,'invalid_coordinates':1,'parsed_records':1})
  with self.assertRaises(AssertionError):csv_rows(b'wrong,columns\na,b\n',source)
 def test_explicit_multilingual_capability_and_unresolved_section(self):
  from fetch_expansion_official import records
  source={'code':'TW_TEST','country_code':'TW','name':'Test official source','source_url':'https://example.org/cameras','license':'Open Government Data License 1.0','license_url':'https://example.org/license','id_fields':['id'],'latitude_field':'lat','longitude_field':'lon','enforcement_terms':{'field':'items','speed':['超速'],'red_light':['闖紅燈'],'section_field':'kind','section':['區間平均速率執法']},'section_endpoint_reason':'Both section endpoints are unavailable','section_point_possible_types':[]}
  for items,kind,expected in [('超速','fixed','fixed_speed'),('闖紅燈','fixed','red_light'),('超速、闖紅燈','fixed','speed_and_red_light'),('不依標誌行駛','other','other_enforcement'),('超速','區間平均速率執法','other_enforcement')]:
   with self.subTest(items=items,kind=kind):
    row=list(records({'source':source,'retrieved_at':'2026-10-07','rows':[{'id':1,'lat':24.1,'lon':120.6,'items':items,'kind':kind}]}))[0]
    self.assertEqual(row['camera_type'],expected)
    if expected=='other_enforcement':self.assertEqual((row['confidence'],row['status']),('LOW','review'))
    if kind=='區間平均速率執法':self.assertIsNone(row.get('end_latitude'));self.assertEqual(row['possible_camera_types'],[])
 def camera(self,typ='fixed_speed',heading=90,raw='90'):
  return {'camera_type':typ,'latitude':24.13584,'longitude':120.68225,'direction':heading,'direction_raw':raw}
 def test_conflicting_nearby_capability_is_held_but_opposing_pairs_survive(self):
  from expand_cameras import nearby_ambiguity
  from cold_storage_pipeline import published
  prior=self.camera();combined=self.camera('speed_and_red_light')
  self.assertIsNotNone(nearby_ambiguity(prior,combined))
  combined.update(confidence='LOW',status='review',country_code='TW');self.assertFalse(published(combined))
  self.assertIsNone(nearby_ambiguity(prior,self.camera('speed_and_red_light',270,'270')))
  self.assertIsNone(nearby_ambiguity(prior,self.camera('red_light')))
  self.assertIsNotNone(nearby_ambiguity(prior,self.camera(heading=None,raw='toward city centre')))

class CrossSourceProximityGuards(unittest.TestCase):
 def point(self,code,source_id,heading=None):
  return {'camera_type':'fixed_speed','latitude':54.987728,'longitude':-7.552781,
          'direction':heading,'camera_sources':[{'source_code':code,'source_id':source_id,
          'source_type':'openstreetmap' if code.startswith('OSM') else 'official_government'}]}
 def test_unknown_heading_cross_source_nearby_device_requires_review(self):
  from expand_cameras import nearby_ambiguity
  a=self.point('OSM_IE','node/12875237542');b=self.point('IE_GARDA_STATIC','N13')
  b['latitude']+=.0001
  self.assertIsNotNone(nearby_ambiguity(a,b))
  b['latitude']+=.001
  self.assertIsNone(nearby_ambiguity(a,b))
 def test_distinct_osm_ids_stay_distinct_across_regional_namespaces(self):
  from source_identity import distinct_same_source_devices
  from expand_cameras import nearby_ambiguity
  a=self.point('OSM_IE','node/1');b=self.point('OSM_IE_EXTRACT','node/2')
  self.assertTrue(distinct_same_source_devices(a,b))
  self.assertIsNone(nearby_ambiguity(a,b))
 def test_explicit_opposing_bearings_remain_separate(self):
  from expand_cameras import nearby_ambiguity
  a=self.point('OSM_IE','node/1',90);b=self.point('IE_GARDA_STATIC','N13',270)
  b['latitude']+=.0001
  self.assertIsNone(nearby_ambiguity(a,b))
 def test_partial_capability_overlap_requires_review_but_disjoint_types_do_not(self):
  from expand_cameras import nearby_ambiguity
  a=self.point('OSM_US','node/1');b=self.point('US_CITY','2');b['latitude']+=.0001
  b['camera_type']='speed_and_red_light';self.assertIsNotNone(nearby_ambiguity(a,b))
  b['camera_type']='red_light';self.assertIsNone(nearby_ambiguity(a,b))
 def test_same_start_with_distinct_explicit_section_endpoints_remains_separate(self):
  from expand_cameras import nearby_ambiguity
  a=self.point('OSM_IE','relation/1');b=self.point('IE_SECTIONS','2');b['latitude']+=.0001
  a['camera_type']=b['camera_type']='average_speed_section'
  a.update(end_latitude=55.0,end_longitude=-7.55)
  b.update(end_latitude=55.01,end_longitude=-7.55)
  self.assertIsNone(nearby_ambiguity(a,b))
 def test_conflicting_metadata_does_not_prove_another_nearby_device(self):
  from expand_cameras import nearby_ambiguity
  a=self.point('OSM_IE','node/1',90);b=self.point('IE_GARDA_STATIC','N13',90);b['latitude']+=.0001
  a['speed_limit']=80;b['speed_limit']=100;self.assertIsNotNone(nearby_ambiguity(a,b))
  b['speed_limit']=80;a['road_ref']='N13';b['road_ref']='N14';self.assertIsNotNone(nearby_ambiguity(a,b))
 def test_curated_alias_cannot_target_another_source_object(self):
  import tempfile
  from source_identity import verified_aliases
  with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[2]/'master-db/cache') as directory:
   path=Path(directory)/'aliases.json';record=self.point('OSM_IE','node/1');record['canonical_id']='existing'
   alias={'source_identity':['IE_GARDA_STATIC','N13'],'canonical_id':'existing','target_source_identity':['OpenStreetMap','node/1']}
   path.write_text(json.dumps({'aliases':[alias]}));self.assertEqual(verified_aliases([record],path),{('IE_GARDA_STATIC','N13'):'existing'})
   alias['target_source_identity'][1]='node/2';path.write_text(json.dumps({'aliases':[alias]}))
   with self.assertRaises(AssertionError):verified_aliases([record],path)

class PublicDownloadFallback(unittest.TestCase):
 def test_tuple_timeout_keeps_tls_verification(self):
  from unittest.mock import patch,Mock
  import requests,public_download,urllib3
  dns=Mock();dns.json.return_value={'Answer':[{'type':1,'data':'192.0.2.1'}]}
  pool=Mock();pool.urlopen.return_value=Mock(status=200,data=b'{}',headers={})
  with patch.object(public_download.requests,'get',side_effect=[requests.ConnectionError('NameResolution failed'),dns]),patch.object(public_download.urllib3,'HTTPSConnectionPool',return_value=pool) as create:
   result=public_download.get('https://example.org/data',timeout=(10,25))
  self.assertEqual(result.content,b'{}')
  self.assertEqual(create.call_args.kwargs['assert_hostname'],'example.org')
  self.assertEqual(create.call_args.kwargs['cert_reqs'],'CERT_REQUIRED')
  timeout=pool.urlopen.call_args.kwargs['timeout']
  self.assertEqual((timeout.connect_timeout,timeout.read_timeout),(10,25))

class RegionalExtraction(unittest.TestCase):
 def test_precise_relation_members_and_way_geometry(self):
  import tempfile
  from fetch_osm_extracts import ROOT,extract_elements
  cache=ROOT/'master-db/cache/coverage-stage/tests';cache.mkdir(parents=True,exist_ok=True)
  xml="""<osm version="0.6">
  <node id="1" version="2" lat="55.0" lon="10.0" timestamp="2026-10-07T00:00:00Z"><tag k="highway" v="speed_camera"/><tag k="direction" v="90"/></node>
  <node id="2" version="1" lat="55.0" lon="10.001" timestamp="2026-10-07T00:00:00Z"><tag k="highway" v="speed_camera"/><tag k="direction" v="270"/></node>
  <node id="3" version="1" lat="55.1" lon="10.0" timestamp="2026-10-07T00:00:00Z"/>
  <node id="4" version="1" lat="55.2" lon="10.0" timestamp="2026-10-07T00:00:00Z"/>
  <node id="5" version="1" lat="55.15" lon="10.0" timestamp="2026-10-07T00:00:00Z"><tag k="surveillance" v="camera"/><tag k="surveillance:purpose" v="security"/></node>
  <way id="10" version="1" timestamp="2026-10-07T00:00:00Z"><nd ref="1"/><nd ref="2"/><tag k="highway" v="speed_camera"/></way>
  <relation id="20" version="1" timestamp="2026-10-07T00:00:00Z"><member type="node" ref="3" role="from"/><member type="node" ref="4" role="to"/><tag k="type" v="enforcement"/><tag k="enforcement" v="average_speed"/></relation>
  </osm>"""
  with tempfile.TemporaryDirectory(dir=cache) as folder:
   p=Path(folder)/'fixture.osm';p.write_text(xml);elements=extract_elements(p)
  self.assertNotIn(('node',5),elements)
  self.assertEqual(elements[('node',1)]['tags']['direction'],'90')
  self.assertEqual(elements[('node',2)]['tags']['direction'],'270')
  self.assertEqual(elements[('node',3)]['lat'],55.1)
  self.assertEqual(elements[('node',4)]['lat'],55.2)
  self.assertAlmostEqual(elements[('way',10)]['center']['lon'],10.0005)
  self.assertEqual([m['role'] for m in elements[('relation',20)]['members']],['from','to'])

class RawArchiveRecovery(unittest.TestCase):
 def test_resource_split_restores_files_across_boundaries(self):
  import tempfile,gzip,hashlib,requests
  from unittest.mock import patch
  import r2_archive
  cache=r2_archive.ROOT/'master-db/cache/coverage-stage/tests';cache.mkdir(parents=True,exist_ok=True);objects={};splits=[]
  def put(data,kind='objects'):
   if kind=='files' and len(gzip.decompress(data))>1000000:
    response=requests.Response();response.status_code=503;response._content=b'Worker exceeded resource limits';splits.append(1)
    raise requests.HTTPError('resource limit',response=response)
   h=hashlib.sha256(data).hexdigest();key='archive/v1/'+kind+'/'+h+'.json';objects[key]=data
   return {'key':key,'sha256':h,'size_bytes':len(data)}
  with tempfile.TemporaryDirectory(dir=cache) as folder:
   a=Path(folder)/'a.bin';b=Path(folder)/'b.bin';a.write_bytes(b'A'*1200000);b.write_bytes(b'B'*1800000)
   with patch.object(r2_archive,'put',side_effect=put),patch.object(r2_archive,'get',side_effect=lambda key:objects[key]):manifest=r2_archive.archive_files([a,b])
   self.assertGreater(len(splits),0)
   for entry,path in zip(manifest['files'],[a,b]):
    restored=b''.join(gzip.decompress(objects[c['key']])[c['offset']:c['offset']+c['length']] for c in entry['chunks'])
    self.assertEqual(restored,path.read_bytes())
    self.assertEqual(hashlib.sha256(restored).hexdigest(),entry['sha256'])
    self.assertEqual(len(restored),entry['size_bytes'])

if __name__=='__main__':unittest.main()

class TexasAuthorizationReview(unittest.TestCase):
 def test_geography_types_and_official_evidence(self):
  from shapely.geometry import box
  from expand_cameras import texas_authorization_review
  region=box(-107,25,-93,37)
  row={'country_code':'US','latitude':30.2,'longitude':-97.7,'camera_type':'red_light','camera_sources':[{'source_type':'openstreetmap'}]}
  self.assertTrue(texas_authorization_review(row,region))
  self.assertTrue(texas_authorization_review({**row,'camera_type':'speed_and_red_light'},region))
  self.assertFalse(texas_authorization_review({**row,'longitude':-118},region))
  self.assertFalse(texas_authorization_review({**row,'camera_type':'fixed_speed'},region))
  self.assertFalse(texas_authorization_review({**row,'camera_sources':[{'source_type':'official_government'}]},region))

class OverlappingSnapshotVersions(unittest.TestCase):
 def test_newer_object_wins_over_richer_older_snapshot_in_either_order(self):
  from bootstrap_cameras import osm_records
  old={'type':'node','id':999,'version':1,'lat':55,'lon':10,'tags':{'highway':'speed_camera'},'extra_old_metadata':'old'}
  new={'type':'node','id':999,'version':2,'lat':55,'lon':10,'tags':{'highway':'speed_camera','enforcement':'traffic_signals'}}
  for elements in ([old,new],[new,old]):
   rows=list(osm_records({'_bootstrap':{'retrieved_at':'2026-10-07'},'elements':elements},'DK'))
   self.assertEqual(len(rows),1)
   self.assertEqual(rows[0]['camera_type'],'speed_and_red_light')
   self.assertEqual(rows[0]['camera_sources'][0]['raw_payload']['osm_version'],2)

class VerifiedSystemTLS(unittest.TestCase):
 def test_legacy_extension_fallback_keeps_tls_validation_and_project_tempfile(self):
  import requests,public_download
  from unittest.mock import patch
  from types import SimpleNamespace
  def run(command,**kwargs):
   self.assertNotIn('-k',command);self.assertNotIn('--insecure',command)
   self.assertIn('--proto',command);self.assertIn('--proto-redir',command)
   target=Path(command[command.index('--output')+1]);self.assertTrue(target.is_relative_to(public_download.Path(__file__).resolve().parents[2]/'master-db/cache'))
   target.write_bytes(b'csv body')
   return SimpleNamespace(returncode=0,stdout='200\nhttps://example.org/data\ntext/csv')
  with patch.object(public_download.requests,'get',side_effect=requests.exceptions.SSLError('Missing Subject Key Identifier')),patch.object(public_download.subprocess,'run',side_effect=run):
   r=public_download.get('https://example.org/data',timeout=(10,25));self.assertEqual(r.content,b'csv body');self.assertEqual(r._source_transport,'system_curl_verified_tls')
 def test_expiry_and_hostname_errors_never_trigger_fallback(self):
  import requests,public_download
  from unittest.mock import patch
  for message in ('certificate expired','hostname mismatch','unknown certificate authority'):
   with patch.object(public_download.requests,'get',side_effect=requests.exceptions.SSLError(message)),patch.object(public_download.subprocess,'run') as run:
    with self.assertRaises(requests.exceptions.SSLError):public_download.get('https://example.org/data')
    run.assert_not_called()
 def test_system_certificate_failure_and_credentials_remain_fatal(self):
  import requests,public_download
  from unittest.mock import patch
  from types import SimpleNamespace
  with patch.object(public_download.subprocess,'run',return_value=SimpleNamespace(returncode=60)):
   with self.assertRaises(requests.exceptions.SSLError):public_download.system_tls_get('https://example.org/data')
  with patch.object(public_download.subprocess,'run') as run:
   with self.assertRaises(requests.exceptions.SSLError):public_download.system_tls_get('https://example.org/data',headers={'Authorization':'test'})
   run.assert_not_called()

class UntypedAndSpeedAmbiguity(unittest.TestCase):
 def test_national_untyped_keeps_candidates_and_raw(self):
  source={'code':'TW_TEST_NPA','country_code':'TW','name':'Test NPA','source_url':'https://example.org/cameras','license':'Open data','license_url':'https://example.org/license','id_fields':['id'],'latitude_field':'lat','longitude_field':'lon','camera_type':'other_enforcement','candidate_reason':'Mixed fixed capabilities omitted by national CSV','possible_camera_types':['fixed_speed','red_light','speed_and_red_light'],'speed_field':'limit','speed_ambiguity_fields':['note']}
  result=list(records({'source':source,'retrieved_at':'2026-10-07','rows':[{'id':1,'lat':24.1,'lon':120.6,'limit':'50','note':'慢車道速限40公里'}]}))[0]
  self.assertEqual((result['confidence'],result['status']),('LOW','review'))
  self.assertEqual(result['possible_camera_types'],source['possible_camera_types'])
  self.assertIsNone(result['speed_limit'])
  self.assertIn('慢車道速限40公里',str(result['camera_sources'][0]['raw_payload']))

class NewObservationPriority(unittest.TestCase):
 def test_precise_current_evidence_precedes_untyped_candidates(self):
  from expand_cameras import observation_priority
  raw={'canonical_id':'npa','camera_type':'other_enforcement','confidence':'LOW','status':'review','camera_sources':[{'source_type':'official_government'}]}
  precise={**raw,'canonical_id':'city','camera_type':'fixed_speed','confidence':'HIGH','status':'active'}
  osm={**precise,'canonical_id':'osm','confidence':'MEDIUM','camera_sources':[{'source_type':'openstreetmap'}]}
  for rows in ([raw,osm,precise],[precise,raw,osm]):
   self.assertEqual([r['canonical_id'] for r in sorted(rows,key=observation_priority)],['city','osm','npa'])
  self.assertEqual((raw['confidence'],raw['status']),('LOW','review'))

class ParallelRawArchive(unittest.TestCase):
 def test_out_of_order_completion_preserves_ranges_and_bound(self):
  import tempfile,gzip,hashlib,time,threading
  from unittest.mock import patch
  import r2_archive
  objects={};lock=threading.Lock();active=0;peak=0;completed=[]
  def put(data,kind='objects'):
   nonlocal active,peak
   if kind=='files':
    raw=gzip.decompress(data)
    with lock:active+=1;peak=max(peak,active)
    time.sleep(.06 if raw[0]==1 else .005)
    with lock:active-=1;completed.append(raw[0])
   digest=hashlib.sha256(data).hexdigest();key='archive/v1/'+kind+'/'+digest+'.json';objects[key]=data
   return {'key':key,'sha256':digest,'size_bytes':len(data)}
  root=r2_archive.ROOT/'master-db/cache/coverage-stage/tests';root.mkdir(parents=True,exist_ok=True)
  with tempfile.TemporaryDirectory(dir=root) as folder:
   a=Path(folder)/'a.bin';b=Path(folder)/'b.bin'
   a.write_bytes(b'\x01'*1000000+b'\x02'*1000000+b'\x03'*350000);b.write_bytes(b'\x04'*1650000)
   with patch.object(r2_archive,'put',side_effect=put),patch.object(r2_archive,'get',side_effect=lambda key:objects[key]):manifest=r2_archive.archive_files([a,b],chunk_bytes=1000000,workers=4)
   self.assertGreater(peak,1);self.assertLessEqual(peak,4);self.assertNotEqual(completed[0],1)
   for entry,path in zip(manifest['files'],[a,b]):
    self.assertEqual([c['file_offset'] for c in entry['chunks']],sorted(c['file_offset'] for c in entry['chunks']))
    restored=b''.join(gzip.decompress(objects[c['key']])[c['offset']:c['offset']+c['length']] for c in entry['chunks'])
    self.assertEqual(restored,path.read_bytes());self.assertEqual(hashlib.sha256(restored).hexdigest(),entry['sha256'])
 def test_failed_worker_does_not_publish_archive_manifest(self):
  import tempfile,gzip,hashlib
  from unittest.mock import patch
  import r2_archive
  objects={};manifest_put=[]
  def put(data,kind='objects'):
   if kind=='manifests':manifest_put.append(1)
   if kind=='files' and gzip.decompress(data)[0]==2:raise RuntimeError('Synthetic failed shard')
   digest=hashlib.sha256(data).hexdigest();objects[digest]=data;return {'key':digest,'sha256':digest,'size_bytes':len(data)}
  root=r2_archive.ROOT/'master-db/cache/coverage-stage/tests';root.mkdir(parents=True,exist_ok=True)
  with tempfile.TemporaryDirectory(dir=root) as folder:
   p=Path(folder)/'source.bin';p.write_bytes(b'\x01'*1000000+b'\x02'*1000000)
   with patch.object(r2_archive,'put',side_effect=put),patch.object(r2_archive,'get',side_effect=lambda key:objects[key]),self.assertRaises(RuntimeError):r2_archive.archive_files([p],chunk_bytes=1000000,workers=2)
  self.assertEqual(manifest_put,[])

class ObservationCounting(unittest.TestCase):
 def test_overlapping_osm_partitions_do_not_inflate_new_source_count(self):
  from report_coverage_stage import identity_set
  rows=[{'camera_sources':[{'source_type':'openstreetmap','source_code':'OSM_IE','source_id':'node/1'}]},{'camera_sources':[{'source_type':'openstreetmap','source_code':'OSM_GB','source_id':'node/1'}]},{'camera_sources':[{'source_type':'official_government','source_code':'CITY_A','source_id':'1'}]},{'camera_sources':[{'source_type':'official_government','source_code':'CITY_B','source_id':'1'}]}]
  self.assertEqual(identity_set(rows),{('OpenStreetMap','node/1'),('CITY_A','1'),('CITY_B','1')})

class SingaporePublicDownload(unittest.TestCase):
 def test_short_lived_url_parameters_never_reach_archive_metadata(self):
  from unittest.mock import Mock,patch
  from fetch_expansion_official import singapore_payload
  endpoint='https://api-open.data.gov.sg/v1/public/api/datasets/d_example/poll-download'
  url='https://s3.ap-southeast-1.amazonaws.com/blobs.data.gov.sg/d_example.geojson?temporary=download-grant'
  ticket=Mock();ticket.json.return_value={'code':0,'data':{'url':url}}
  body=Mock(status_code=200,content=b'{"features":[]}')
  with patch('fetch_expansion_official.get',side_effect=[ticket,body]) as fetch:
   result=singapore_payload({'download_url':endpoint})
  self.assertEqual(result.content,b'{"features":[]}')
  self.assertEqual(result.url,url.split('?')[0]);self.assertEqual(fetch.call_args_list[1].args[0],url)
 def test_unexpected_download_host_is_rejected(self):
  from unittest.mock import Mock,patch
  from fetch_expansion_official import singapore_payload
  ticket=Mock();ticket.json.return_value={'code':0,'data':{'url':'https://example.org/payload'}}
  with patch('fetch_expansion_official.get',return_value=ticket) as fetch:
   with self.assertRaises(AssertionError):singapore_payload({'download_url':'https://api-open.data.gov.sg/v1/public/api/datasets/d_example/poll-download'})
  self.assertEqual(fetch.call_count,1)

class LicensedMirrorPolicy(unittest.TestCase):
 def test_mirror_retains_medium_and_does_not_invent_unvalidated_fields(self):
  from fetch_expansion_official import records
  source={'code':'TEST_MIRROR','country_code':'SE','name':'Licensed CC0 mirror','source_type':'licensed_open_data','source_url':'https://example.org/data','license':'CC0-1.0','license_url':'https://creativecommons.org/publicdomain/zero/1.0/','id_fields':['id'],'latitude_field':'lat','longitude_field':'lon','camera_type':'fixed_speed','activation_date_field':'monterad'}
  row={'id':'1','lat':58.3,'lon':15.8,'grans':70,'riktning':'ONO','vag':'35','monterad':20071128}
  r=list(records({'source':source,'retrieved_at':'2026-10-07','rows':[row]}))[0]
  self.assertEqual((r['confidence'],r['camera_sources'][0]['source_type']),('MEDIUM','licensed_open_data'))
  self.assertIsNone(r['speed_limit']);self.assertIsNone(r['direction']);self.assertIsNone(r['road_name'])
  row['monterad']=20990101
  self.assertEqual(list(records({'source':source,'retrieved_at':'2026-10-07','rows':[row]}))[0]['status'],'candidate')
 def test_incomplete_public_json_feed_does_not_become_an_import_envelope(self):
  from unittest.mock import Mock,patch
  import tempfile
  import fetch_expansion_official as f
  source={'code':'TEST_COUNT','source_url':'https://example.org/catalog','download_url':'https://example.org/data','count_json_url':'https://example.org/count','format':'json','license':'CC0','license_url':'https://example.org/license'}
  data=Mock();data.json.return_value=[{'id':'1'}]
  count=Mock();count.json.return_value=[{'count':'2'}]
  root=Path(f.ROOT/'master-db/cache/coverage-stage/tests');root.mkdir(parents=True,exist_ok=True)
  with tempfile.TemporaryDirectory(dir=root) as folder,patch.object(f,'RAW',Path(folder)),patch.object(f,'get',side_effect=[data,count]),patch.object(f,'capture_payload'):
   with self.assertRaises(AssertionError):f.download(source)
   self.assertFalse((Path(folder)/'TEST_COUNT.json').exists())

class CompleteElasticsearchAcquisition(unittest.TestCase):
 def test_partial_search_and_failed_shards_never_produce_import(self):
  from unittest.mock import Mock,patch
  import tempfile
  import fetch_expansion_official as f
  source={'code':'TEST_ELASTIC','source_url':'https://example.org/catalog','download_url':'https://example.org/index/_search','format':'elasticsearch','id_fields':['id'],'license':'CC0','license_url':'https://example.org/license'}
  root=Path(f.ROOT/'master-db/cache/coverage-stage/tests');root.mkdir(parents=True,exist_ok=True)
  cases=[(False,0,2,'eq'),(True,0,1,'eq'),(False,1,1,'eq'),(False,0,1,'gte')]
  for timed_out,failed,total,relation in cases:
   response=Mock();response.json.return_value={'timed_out':timed_out,'_shards':{'failed':failed},'hits':{'total':{'value':total,'relation':relation},'hits':[{'_source':{'id':'1'}}]}}
   with tempfile.TemporaryDirectory(dir=root) as folder,patch.object(f,'RAW',Path(folder)),patch.object(f,'get',return_value=response),patch.object(f,'capture_payload'):
    with self.assertRaises(AssertionError):f.download(source)
    self.assertFalse((Path(folder)/'TEST_ELASTIC.json').exists())

class DgtExplicitEndpoints(unittest.TestCase):
 def test_segment_uses_explicit_from_to_and_unknown_category_is_rejected(self):
  from fetch_expansion_official import dgt_location_rows
  xml=b'''<root><publicationTime>2025-12-18T09:56:52+01:00</publicationTime><predefinedLocationSet id="GUID_Inventario_CinemometrosVelocidadMedia"><predefinedLocation id="segment1"><predefinedLocation><tpeglinearLocation><to><pointCoordinates><latitude>41.6</latitude><longitude>-0.94</longitude></pointCoordinates></to><from><pointCoordinates><latitude>41.5</latitude><longitude>-0.91</longitude></pointCoordinates></from></tpeglinearLocation><roadNumber>Z-40</roadNumber></predefinedLocation></predefinedLocation></predefinedLocationSet></root>'''
  row=dgt_location_rows(xml)[0]
  self.assertEqual(row['geometry']['coordinates'],[-.94,41.6]);self.assertEqual((row['properties']['start_lat'],row['properties']['start_lon']),(41.5,-.91))
  with self.assertRaises(AssertionError):dgt_location_rows(xml.replace(b'GUID_Inventario_CinemometrosVelocidadMedia',b'GUID_MobileZones'))
  with self.assertRaises(AssertionError):dgt_location_rows(xml.replace(b'<from>',b'<missing>').replace(b'</from>',b'</missing>'))

class GardaOfficialCoordinates(unittest.TestCase):
 def test_extracts_device_coordinates_and_fails_closed_without_table(self):
  from fetch_expansion_official import garda_static_rows
  page=b'<table><tr><td>Location</td><td>Latitude</td><td>Longitude</td><td>Name</td><td>County</td></tr><tr><td><p>N17</p></td><td>53.739452445736674</td><td>-8.970491179526576</td><td>Ballinsmaula</td><td>Mayo</td></tr></table>'
  row=garda_static_rows(page)[0];self.assertEqual(row['Location'],'N17');self.assertEqual(float(row['Latitude']),53.739452445736674)
  with self.assertRaises(AssertionError):garda_static_rows(b'<html>Mobile camera zones</html>')
  with self.assertRaises(AssertionError):garda_static_rows(page.replace(b'53.739452445736674',b'23.0'))

class GardaLabelledCoordinates(unittest.TestCase):
 def test_official_press_coordinates_preserved_without_invented_sign(self):
  from fetch_expansion_official import garda_static_rows
  page=b'<p>Location: N80 Latitude: 52.768055581114 Longitude: -6.856167791944444 Name: Graiguenaspiddoge County: Carlow</p>'
  row=garda_static_rows(page)[0];self.assertEqual(row['Longitude'],-6.856167791944444)
  with self.assertRaises(AssertionError):garda_static_rows(page.replace(b'-6.856',b'6.856'))

class NovelObservationOutcomeCounts(unittest.TestCase):
 def test_later_batch_repeats_do_not_count_an_accepted_camera_as_discarded(self):
  from report_coverage_stage import novel_identity_outcomes
  outcomes={('OpenStreetMap','node/1'):{'accepted','duplicate_identity'},('OpenStreetMap','node/2'):{'duplicate_geometry','duplicate_identity'},('OpenStreetMap','node/3'):{'rejected_country_polygon','accepted'},('KNOWN','baseline'):{'duplicate_identity'}}
  counts=novel_identity_outcomes(outcomes,{('KNOWN','baseline')})
  self.assertEqual(dict(counts),{'accepted':2,'duplicate_geometry':1})
 def test_retired_verified_alias_is_counted_as_duplicate(self):
  from report_coverage_stage import novel_identity_outcomes
  alias=('GARDA','N13');live=('OpenStreetMap','node/1')
  counts=novel_identity_outcomes({alias:{'accepted','duplicate_geometry'},live:{'accepted','duplicate_identity'}},set(),current={live})
  self.assertEqual(dict(counts),{'accepted':1,'duplicate_geometry':1})

class ExplicitKmzCameraGeometry(unittest.TestCase):
 def archive(self,placemarks):
  import io,zipfile
  buffer=io.BytesIO()
  with zipfile.ZipFile(buffer,'w') as archive:
   archive.writestr('doc.kml','<kml xmlns="http://www.opengis.net/kml/2.2"><Document>'+placemarks+'</Document></kml>')
  return buffer.getvalue()
 def point(self,identity='1',coordinates='114.167365,22.27785,0',geometry='Point'):
  return '<Placemark><ExtendedData><SchemaData><SimpleData name="RLC_ID">'+identity+'</SimpleData></SchemaData></ExtendedData><'+geometry+'><coordinates>'+coordinates+'</coordinates></'+geometry+'></Placemark>'
 def test_uses_only_explicit_wgs84_point_and_rejects_duplicate_ids(self):
  from fetch_expansion_official import kmz_points
  source={'id_fields':['RLC_ID']};rows=kmz_points(self.archive(self.point()),source)
  self.assertEqual(rows[0]['geometry']['coordinates'],[114.167365,22.27785])
  with self.assertRaises(AssertionError):kmz_points(self.archive(self.point()+self.point()),source)
 def test_nonpoint_multiple_and_nonfinite_coordinates_fail_closed(self):
  from fetch_expansion_official import kmz_points
  for point in [self.point(geometry='LineString'),self.point(coordinates='114,22 114.1,22.1'),self.point(coordinates='nan,22')]:
   with self.assertRaises(AssertionError):kmz_points(self.archive(point),{'id_fields':['RLC_ID']})
