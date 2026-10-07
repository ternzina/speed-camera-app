import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from cold_storage_pipeline import published,compact
class ReviewedIntake(unittest.TestCase):
 def row(self,country):return dict(canonical_id='test',country_code=country,camera_type='fixed_speed',latitude=50,longitude=20,confidence='HIGH',status='active',camera_sources=[{'source_code':'PL_CANARD_CURRENT'}])
 def test_country_requires_explicit_review(self):
  for code in ('UA','PL'):
   r=self.row(code);self.assertFalse(published(r));r['publication_review']='ua_pl_official_v1';self.assertTrue(published(r));r['confidence']='LOW';self.assertFalse(published(r));r['confidence']='HIGH';r['status']='review';self.assertFalse(published(r))
 def test_compact_legacy_projection_has_no_raw(self):
  r=self.row('PL');r.update(publication_review='ua_pl_official_v1',direction=None,direction_raw='increasing_chainage');r['camera_sources'][0]['raw_payload']={'large':'private'};p=compact(r,'archive/v1/objects/'+'a'*64+'.jsonl.gz');self.assertNotIn('camera_sources',p);self.assertNotIn('raw_payload',str(p));self.assertEqual(p['delivery']['latitude'],50);self.assertNotIn('direction',p['delivery'])
if __name__=='__main__':unittest.main()
