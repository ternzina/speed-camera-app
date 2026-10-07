import sys,tempfile,unittest,re
from contextlib import ExitStack
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import bounded_source_download as downloader
ROOT=Path(__file__).resolve().parents[2]
class RangeDownloadTests(unittest.TestCase):
 def run_download(self,broken=None,free=None,bounded=False):
  data=bytes(range(256))*3
  class Response:
   def __init__(self,start,end,probe):
    self.status_code=206;self.url='https://public.example/stable-20261007.pbf'
    self.headers={'Content-Range':f'bytes {start}-{end}/{len(data)}','ETag':'"snapshot"','Last-Modified':'fixed'}
    self.data=data[start:end+1]
    if not probe and broken=='etag':self.headers['ETag']='"changed"'
    if not probe and broken=='length':self.data=self.data[:-1]
    if not probe and broken=='range':self.headers['Content-Range']='bytes 0-0/1'
   def close(self):pass
   def raise_for_status(self):pass
   def iter_content(self,n):yield self.data
  def get(url,**kw):
   start,end=map(int,re.fullmatch(r'bytes=(\d+)-(\d+)',kw['headers']['Range']).groups())
   probe=kw['headers'].get('If-Match') is None
   if not probe:self.assertEqual(kw['headers']['If-Match'],'"snapshot"');self.assertEqual(url,'https://public.example/stable-20261007.pbf')
   return Response(start,end,probe)
  with tempfile.TemporaryDirectory(dir=ROOT/'master-db/cache') as directory,patch.object(downloader,'get',side_effect=get),ExitStack() as stack:
   if free is not None:stack.enter_context(patch.object(downloader.shutil,'disk_usage',return_value=SimpleNamespace(free=free)))
   target=Path(directory)/'source.osm.pbf'
   if broken:
    with self.assertRaises(RuntimeError if broken=='space' else AssertionError):downloader.download('https://public.example/latest.pbf',target,ROOT,chunk_bytes=64,archive_cache_bounded=bounded)
    self.assertFalse(target.exists(),'Unverified source must never become a completed PBF')
   else:
    metadata=downloader.download('https://public.example/latest.pbf',target,ROOT,chunk_bytes=64,archive_cache_bounded=bounded)
    self.assertEqual(target.read_bytes(),data);self.assertTrue(metadata['verified_byte_ranges'])
 def test_complete_source_restores_ordered_bytes(self):self.run_download()
 def test_changed_version_is_not_committed(self):self.run_download('etag')
 def test_truncated_range_is_not_committed(self):self.run_download('length')
 def test_incorrect_range_is_not_committed(self):self.run_download('range')
 def test_streaming_restore_requires_two_disk_copies(self):self.run_download(free=200000000+2*768+1)
 def test_insufficient_archive_space_never_commits_source(self):self.run_download('space',free=200000000+768)
 def test_bounded_archive_fits_source_plus_shard_cache(self):self.run_download(free=200000000+768+512+1,bounded=True)
 def test_bounded_archive_still_reserves_all_inflight_shards(self):self.run_download('space',free=200000000+768+511,bounded=True)
