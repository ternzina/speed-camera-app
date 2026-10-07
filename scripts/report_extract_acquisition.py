#!/usr/bin/env python3
"""Report regional source acquisition without treating failures as empty coverage."""
import datetime,json
from fetch_osm_extracts import ROOT,REGIONS
from r2_archive import encode,get

def main():
    rows=[]
    for code,region in REGIONS.items():
        path=ROOT/'master-db/cache/expansion/osm'/(code+'-extract.json')
        row={'region':code,'country':code.split('-')[0], 'source_url':f'https://download.geofabrik.de/{region if "/" in region else "europe/"+region}-latest.osm.pbf','status':'pending_or_failed'}
        if path.exists():
            data=json.loads(path.read_bytes());ref=data.get('_bootstrap',{}).get('source_snapshot_manifest')
            if ref:
                manifest=json.loads(get(ref['key'] if isinstance(ref,dict) else ref))
                assert manifest.get('files'),'Source archive has no restorable files'
                row.update(status='verified_archive',source_snapshot=ref,elements=len(data['elements']),raw_bytes=sum(f['size_bytes'] for f in manifest['files']))
        rows.append(row)
    report={'measured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'registered_regions':len(rows),'verified_regions':sum(r['status']=='verified_archive' for r in rows),'remaining_regions':[r['region'] for r in rows if r['status']!='verified_archive'],'regions':rows,'note':'Archive receipts follow whole-file checksum, byte count and restoration validation. Failed sources are not empty datasets.'}
    (ROOT/'master-db/coverage/extract-acquisition.json').write_bytes(encode(report))
    print({k:v for k,v in report.items() if k not in ('regions','note')})
if __name__=='__main__':main()
