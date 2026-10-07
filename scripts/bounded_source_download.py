"""Bounded concurrent downloads of a stable, byte-range capable public source."""
import concurrent.futures,re,shutil
from public_download import get

def download(url,path,root,workers=4,chunk_bytes=8000000,archive_cache_bounded=False):
    if not 1<=workers<=4 or not 1<=chunk_bytes<=8000000:
        raise ValueError('Download concurrency and chunk size exceed bounded limits')
    probe=get(url,headers={'Range':'bytes=0-0','Accept-Encoding':'identity'},stream=True,timeout=(15,120))
    try:
        probe.raise_for_status()
        match=re.fullmatch(r'bytes 0-0/(\d+)',probe.headers.get('Content-Range',''))
        etag=probe.headers.get('ETag','')
        if probe.status_code!=206 or not match or not etag or etag.startswith('W/'):
            raise ValueError('Source lacks stable byte ranges and a strong ETag')
        total=int(match[1]);snapshot=probe.url;modified=probe.headers.get('Last-Modified')
    finally:probe.close()
    # Source plus compressed readback cache; restoration hashes bounded ranges
    # and does not create a third full source file.
    required=total+workers*chunk_bytes*2+200000000 if archive_cache_bounded else total*2+200000000
    if shutil.disk_usage(root).free<required:
        raise RuntimeError('Insufficient project disk space for bounded download and verified archive')
    ranges=iter((start,min(start+chunk_bytes,total)-1) for start in range(0,total,chunk_bytes))
    def fetch(bounds):
        start,end=bounds
        response=get(snapshot,headers={'Range':f'bytes={start}-{end}','If-Match':etag,'Accept-Encoding':'identity'},stream=True,timeout=(15,120))
        try:
            response.raise_for_status()
            assert response.status_code==206,'Source ignored byte range'
            assert response.headers.get('ETag')==etag,'Source version changed'
            assert response.headers.get('Content-Range')==f'bytes {start}-{end}/{total}','Source range mismatch'
            data=bytearray()
            for part in response.iter_content(1048576):
                data.extend(part)
                assert len(data)<=end-start+1,'Source exceeded requested byte range'
            assert len(data)==end-start+1,'Source range truncated'
            return start,data
        finally:response.close()
    temporary=path.with_suffix('.part')
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool,temporary.open('wb') as target:
        pending={pool.submit(fetch,bounds) for bounds in [next(ranges,None) for _ in range(workers)] if bounds is not None}
        while pending:
            done,pending=concurrent.futures.wait(pending,return_when=concurrent.futures.FIRST_COMPLETED)
            for future in done:
                start,data=future.result()
                if shutil.disk_usage(root).free<len(data)+200000000:raise RuntimeError('Download stopped before exhausting local disk')
                target.seek(start);target.write(data)
                bounds=next(ranges,None)
                if bounds is not None:pending.add(pool.submit(fetch,bounds))
        assert target.tell()<=total
    assert temporary.stat().st_size==total,'Source download length mismatch'
    temporary.replace(path)
    return {'snapshot_url':snapshot,'etag':etag,'last_modified':modified,'size_bytes':total,'verified_byte_ranges':True}
