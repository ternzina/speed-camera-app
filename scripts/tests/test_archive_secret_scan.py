import sys,re,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import r2_archive as archive
class SecretPrefixScanTests(unittest.TestCase):
 def test_all_existing_patterns_match_original_regex(self):
  samples=[
   b'pass'+b'word = '+bytes([34])+b'SyntheticValue123'+bytes([34]),
   b'PASS'+b'WORD '+bytes([39])+b'SyntheticValue123'+bytes([39]),
   b'-----BEGIN '+b'PRIVATE KEY-----',
   b'gh'+b'p_'+b'A'*30,b'github_'+b'pat_'+b'A'*35,
   b'A'+b'KIA'+b'A'*16,b'sb_'+b'secret_'+b'A'*20,
   b's'+b'k-'+b'A'*35,b'A'+b'Iza'+b'A'*35,
   b'xox'+b'b-'+b'A'*20,b'ey'+b'J'+b'A'*15+b'.'+b'B'*15+b'.'+b'C'*15,
   b'https://'+b'person:'+b'SyntheticValue123'+b'@example.invalid',
  ]
  for sample in samples:
   with self.subTest(sample=sample[:8]):
    self.assertTrue(any(re.search(pattern,sample) for pattern in archive.PATTERNS.values()))
    with self.assertRaises(ValueError):archive.check_data_secrets(sample,'synthetic test')
 def test_word_boundaries_and_case_preserved(self):
  for sample in [b'not'+b'ghp_'+b'A'*30,b'lowercase '+b'akia'+b'A'*16,b'ordinary public source bytes']:
   self.assertFalse(any(re.search(pattern,sample) for pattern in archive.PATTERNS.values()))
   archive.check_data_secrets(sample,'boundary test')
 def test_unknown_pattern_falls_back_to_full_scan(self):
  with patch.object(archive,'PATTERNS',{'future_pattern':b'custom-secret'}):
   with self.assertRaises(ValueError):archive.check_data_secrets(b'new custom-secret pattern','future pattern')
