#!/usr/bin/env python3
"""Audit ambiguous cross-source pairs without altering existing cameras."""
import collections,datetime,json,math
from pathlib import Path
from cold_storage_pipeline import master,published
from r2_archive import read_dataset,encode
from bootstrap_cameras import compatible,dist
from expand_cameras import nearby_ambiguity
from source_identity import distinct_same_source_devices
ROOT=Path(__file__).resolve().parents[1]
def main():
 rows=master();baseline=json.loads((ROOT/'master-db/coverage/baseline.json').read_text());protected={r['canonical_id'] for r in read_dataset(baseline['master_manifest'])}
 live=[r for r in rows if published(r)];grid=collections.defaultdict(list)
 for r in live:grid[(r['country_code'],math.floor(r['latitude']/.001),math.floor(r['longitude']/.001))].append(r)
 findings=[]
 for r in live:
  if r['canonical_id'] in protected:continue
  key=(r['country_code'],math.floor(r['latitude']/.001),math.floor(r['longitude']/.001));span=min(50,max(1,math.ceil(30/max(.6,111.32*abs(math.cos(math.radians(r['latitude'])))))))
  matches=[]
  for di in (-1,0,1):
   for dj in range(-span,span+1):
    for other in grid.get((key[0],key[1]+di,key[2]+dj),[]):
     if r['canonical_id']==other['canonical_id'] or distinct_same_source_devices(r,other):continue
     reason='Compatible cross-source spatial duplicate' if compatible(r,other) else nearby_ambiguity(r,other)
     if reason:matches.append({'source_id':r['canonical_id'],'nearby_id':other['canonical_id'],'distance_m':round(dist(r,other),3),'nearby_is_baseline':other['canonical_id'] in protected,'reason':reason})
  if matches:findings.append(min(matches,key=lambda x:x['distance_m']))
 (ROOT/'master-db/cache/coverage-stage/remaining-proximity-findings.json').write_bytes(encode(findings))
 country_by_id={r['canonical_id']:r['country_code'] for r in rows}
 report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'new_published_rows_checked':sum(r['canonical_id'] not in protected for r in live),'ambiguous_new_published_rows':len(findings),'by_country':dict(collections.Counter(country_by_id[x['source_id']] for x in findings)),'by_source_namespace':dict(collections.Counter(x['source_id'].split(':')[0] for x in findings)),'samples':findings[:20],'note':'Only new stage additions are candidates for correction; protected baseline rows are never modified. Distinct source device IDs and opposing bearings remain separate.'}
 (ROOT/'master-db/coverage/proximity-publication-audit.json').write_bytes(encode(report));print({k:v for k,v in report.items() if k!='samples'},flush=True)
if __name__=='__main__':main()
