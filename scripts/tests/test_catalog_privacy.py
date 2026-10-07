import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from discover_coverage_catalogs import sanitize_catalog
from r2_archive import check_data_secrets,encode

class CatalogPrivacy(unittest.TestCase):
 def test_nested_signed_description_removed_without_changing_dataset_identity(self):
  credential='AS'+'IA'+'A'*16
  url='https://example.com/download?X-Amz-Credential='+credential+'&amp;X-Amz-Signature=synthetic'
  source={'items':[{'id':'dataset-1','url':'https://example.com/FeatureServer','description':'<a href="'+url+'">Download</a>'}]}
  clean=sanitize_catalog(source)
  self.assertNotIn(credential,str(clean));self.assertNotIn('X-Amz-',str(clean))
  self.assertEqual(clean['items'][0]['id'],'dataset-1')
  self.assertEqual(clean['items'][0]['url'],source['items'][0]['url'])
  self.assertIn(credential,source['items'][0]['description'])
  check_data_secrets(encode(clean),'test catalog')
 def test_ordinary_metadata_unchanged(self):
  source={'url':'https://example.com/public?f=json','description':'Public cameras','coordinates':[1,2]}
  self.assertEqual(sanitize_catalog(source),source)
 def test_other_credentials_still_rejected(self):
  source={'service_role_key':'synthetic-'+'value-for-test'}
  with self.assertRaises(ValueError):check_data_secrets(encode(sanitize_catalog(source)),'test catalog')

if __name__=='__main__':unittest.main()
