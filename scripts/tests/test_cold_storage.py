import sys,unittest,json,gzip
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import r2_archive as archive
import cold_storage_pipeline as cold
class ColdStorageSafety(unittest.TestCase):
 def test_url_secret_scan_does_not_cross_json_fields(self):
  archive.check_data_secrets(b'{"url":"https://example.org","email":"person@example.org"}','public GIS')
  with self.assertRaises(ValueError):archive.check_data_secrets(json.dumps({'url':'https://'+'owner:'+('test-'*4)+'@example.org'}).encode(),'credential')

 def test_legacy_source_without_auxiliary_metadata_uses_catalog(self):
  import prepare_cold_master as prepare
  state={'tables':{'public.camera_sources':{'manifest_ref':'sources'},'public.camera_source_links':{'manifest_ref':'links'}}}
  catalog={'id':9,'code':'LEGACY','name':'Legacy official','source_type':'official_government','homepage_url':'https://example.org','license_notes':'Open government data'}
  link={'camera_record_id':1,'source_id':9,'external_id':'device1','created_at':'2026-10-01T00:00:00Z','raw_payload':{'device':'original'}}
  row={'id':1,'canonical_id':'old','latitude':50,'longitude':30,'metadata':{'canonical_id':'old','latitude':50,'longitude':30}}
  with patch.object(prepare,'read_dataset',side_effect=[[catalog],[link]]),patch.object(Path,'read_bytes',return_value=b''),patch.object(prepare.gzip,'decompress',return_value=b'[]'),patch('update_cameras.validate'):
   result=prepare.normalized_master(state,[row])[0]['camera_sources'][0]
  self.assertEqual((result['source_code'],result['source_id']),('LEGACY','device1'))
  self.assertEqual(result['raw_payload'],{'device':'original'});self.assertTrue(result['license']);self.assertTrue(result['retrieved_at'])
 def test_low_candidate_never_published(self):
  for status,confidence,country in [('active','LOW','US'),('candidate','HIGH','US'),('review','HIGH','CA'),('active','HIGH','PL')]:
   self.assertFalse(cold.published({'status':status,'confidence':confidence,'country_code':country}))
 def test_compact_drops_full_payload(self):
  r={'canonical_id':'test','camera_sources':[{'source_code':'OSM_US','raw_payload':{'large':'value'}}],'raw_payload':{'secret':'value'},'provenance':[1]}
  small=cold.compact(r,'archive/v1/objects/'+'a'*64+'.jsonl.gz')
  self.assertNotIn('camera_sources',small);self.assertNotIn('raw_payload',small);self.assertNotIn('provenance',small)
  self.assertEqual(small['source_codes'],['OSM_US'])
 def test_bad_archive_checksum_stops_reader(self):
  ref={'key':'manifest'};payload=b'{"id":1}\n';compressed=gzip.compress(payload)
  manifest={'record_count':1,'decoded_sha256':'wrong','chunks':[{'key':'chunk','sha256':archive.sha(compressed),'decoded_sha256':archive.sha(payload),'record_count':1}]}
  with patch.object(archive,'get',side_effect=[json.dumps(manifest).encode(),compressed]):
   with self.assertRaises(AssertionError):list(archive.read_dataset(ref))
 def test_archive_failure_prevents_operational_write(self):
  with patch.object(cold,'verified_aliases',return_value={}),patch.object(cold,'control',return_value='old'),patch.object(cold,'read_dataset',return_value=[]),patch.object(cold,'dataset',side_effect=RuntimeError('R2 unavailable')),patch.object(cold,'connect') as database:
   with self.assertRaises(RuntimeError):cold.sync([])
   database.assert_not_called()
 def test_existing_source_identity_cannot_be_reassigned(self):
  old={'canonical_id':'old','camera_sources':[{'source_code':'A','source_id':'1'}]}
  new={'canonical_id':'new','camera_sources':[{'source_code':'A','source_id':'1'}]}
  with patch.object(cold,'verified_aliases',return_value={}),patch.object(cold,'control',return_value='old'),patch.object(cold,'read_dataset',return_value=[old]),patch.object(cold,'dataset') as objects:
   with self.assertRaises(AssertionError):cold.sync([new])
   objects.assert_not_called()
 def test_same_osm_object_cannot_be_reassigned_across_country_partitions(self):
  old={'canonical_id':'old','camera_sources':[{'source_type':'openstreetmap','source_code':'OSM_IE','source_id':'node/1'}]}
  new={'canonical_id':'new','camera_sources':[{'source_type':'openstreetmap','source_code':'OSM_GB','source_id':'node/1'}]}
  with patch.object(cold,'verified_aliases',return_value={}),patch.object(cold,'control',return_value='old'),patch.object(cold,'read_dataset',return_value=[old]),patch.object(cold,'dataset') as objects,patch.object(cold,'connect') as database:
   with self.assertRaises(AssertionError):cold.sync([new])
   objects.assert_not_called();database.assert_not_called()
 def test_verified_alias_cannot_be_published_as_another_canonical(self):
  old={'canonical_id':'existing','camera_sources':[{'source_code':'A','source_id':'1'}]}
  new={'canonical_id':'alias','camera_sources':[{'source_code':'B','source_id':'2'}]}
  with patch.object(cold,'verified_aliases',return_value={('B','2'):'existing'}),patch.object(cold,'control',return_value='old'),patch.object(cold,'read_dataset',return_value=[old]),patch.object(cold,'dataset') as objects,patch.object(cold,'connect') as database:
   with self.assertRaises(AssertionError):cold.sync([new])
   objects.assert_not_called();database.assert_not_called()
if __name__=='__main__':unittest.main()
