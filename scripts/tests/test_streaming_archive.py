import sys,gzip,json,hashlib,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import r2_archive as archive

class StreamingArchive(unittest.TestCase):
 def test_mapped_scanner_matches_secret_rules_including_mixed_case(self):
  samples={
   'literal_credential':b'Api_Key='+b'"'+b'x'*20+b'"',
   'sql_password':b'PaSsWoRd'+b" '"+b'x'*20+b"'",
   'private_key':b'-----BEGIN '+b'RSA PRIVATE KEY-----',
   'github_token':b'ghp_'+b'x'*24,
   'aws_access_key':b'AK'+b'IA'+b'A'*16,
   'supabase_secret':b'sb_secret_'+b'x'*20,
   'openai_key':b'sk-'+b'x'*32,
   'google_api_key':b'AI'+b'za'+b'x'*35,
   'slack_token':b'xoxb-'+b'x'*20,
   'jwt_key_or_token':b'ey'+b'J'+b'a'*12+b'.'+b'b'*12+b'.'+b'c'*12,
   'credential_url':b'https://'+b'owner:'+b'x'*20+b'@example.org',
  }
  with tempfile.TemporaryDirectory(dir=archive.ROOT/'master-db/cache') as directory:
   source=Path(directory)/'source.osm.pbf'
   for name,value in samples.items():
    with self.subTest(name=name):
     data=b'\x00'+value+b'\x00';source.write_bytes(data)
     with self.assertRaises(ValueError):archive.check_data_secrets(data,'fixture')
     with self.assertRaises(ValueError):archive.scan_file_secrets(source)
 def test_multishard_source_restores_without_whole_file_reads_or_retained_cache(self):
  with tempfile.TemporaryDirectory(dir=archive.ROOT/'master-db/cache') as directory:
   source=Path(directory)/'source.osm.pbf';data=b'\x00'*1100000+b'\x01'*1200000;source.write_bytes(data)
   cache=Path(directory)/'objects';store={};reads=[]
   def put(raw,kind='objects'):
    digest=hashlib.sha256(raw).hexdigest();key='archive/v1/'+kind+'/'+digest
    store[key]=raw;target=cache/key;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
    return {'key':key,'sha256':digest,'size_bytes':len(raw)}
   def get(key,refresh=False):
    reads.append(key);target=cache/key;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(store[key]);return store[key]
   original_read=Path.read_bytes
   def bounded_read(path):
    if path==source:raise AssertionError('Whole PBF must never be copied into Python heap')
    return original_read(path)
   with patch.object(archive,'CACHE',cache),patch.object(archive,'put',side_effect=put),patch.object(archive,'get',side_effect=get),patch.object(Path,'read_bytes',bounded_read):
    result=archive.archive_files([source],chunk_bytes=1000000,workers=2,bounded_cache=True)
   row=result['files'][0];self.assertEqual(row['sha256'],hashlib.sha256(data).hexdigest());self.assertEqual(row['size_bytes'],len(data))
   restored=b''.join(gzip.decompress(store[x['key']])[x['offset']:x['offset']+x['length']] for x in row['chunks'])
   self.assertEqual(restored,data)
   self.assertEqual(len(row['chunks']),3)
   self.assertTrue(all(reads.count(x['key'])>=2 for x in row['chunks']))
   self.assertTrue(all(not (cache/x['key']).exists() for x in row['chunks']))
 def test_secret_crossing_shard_boundary_blocks_before_upload(self):
  with tempfile.TemporaryDirectory(dir=archive.ROOT/'master-db/cache') as directory:
   source=Path(directory)/'source.osm.pbf';credential=b'AS'+b'IA'+b'A'*16
   source.write_bytes(b'\x00'*999997+credential+b'\x00'*20)
   with patch.object(archive,'put') as upload:
    with self.assertRaisesRegex(ValueError,'aws_access_key'):archive.archive_files([source],chunk_bytes=1000000,bounded_cache=True)
    upload.assert_not_called()

if __name__=='__main__':unittest.main()
