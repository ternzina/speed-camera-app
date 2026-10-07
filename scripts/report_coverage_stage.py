#!/usr/bin/env python3
"""Verified incremental coverage statistics from the compact DB and R2 receipts."""
import collections,csv,datetime,json
from pathlib import Path
from update_cameras import connect
from cold_storage_pipeline import control
from r2_archive import read_dataset,get,encode
from source_identity import source_identity
ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'master-db/coverage'
def identity_set(rows):
 return {source_identity(s) for r in rows for s in r.get('camera_sources',[])}
def novel_identity_outcomes(outcomes,baseline,current=None):
 counts=collections.Counter()
 for identity in set(outcomes)-baseline:
  states=outcomes[identity]
  if current is not None and identity not in current:states=states-{'accepted'}
  status=next((v for v in ('accepted','duplicate_geometry','duplicate_identity','rejected_country_polygon') if v in states),'other')
  counts[status]+=1
 return counts
def main():
 baseline=json.loads((REPORT/'baseline.json').read_text())
 before=list(read_dataset(baseline['master_manifest']));after=list(read_dataset(control()));byid={r['canonical_id']:r for r in after}
 assert all(byid.get(r['canonical_id'])==r for r in before),'Existing full canonical record changed'
 oldids={r['canonical_id'] for r in before};new=[r for r in after if r['canonical_id'] not in oldids]
 with connect() as conn:
  counts=dict(conn.execute('select country_code,count(*) from public.camera_records where active and confidence in (\'high\',\'medium\') group by 1'))
  size=conn.execute('select pg_database_size(current_database())').fetchone()[0]
  low=conn.execute("select count(*) from public.camera_records where active and confidence='low'").fetchone()[0]
  heavy=conn.execute("select to_regclass('public.camera_source_links')").fetchone()[0]
 assert low==0 and heavy is None,'Operational storage/publishing guard failed'
 oldobs=identity_set(before)
 observation_baseline=REPORT/'observation-baseline.json'
 if observation_baseline.exists():
  for ref in json.loads(observation_baseline.read_text())['baseline_observation_dataset_refs']:
   for row in read_dataset(ref):oldobs.update(identity_set([row]))
 seen=set();dupes=set();identity_outcomes=collections.defaultdict(set);dispositions=collections.Counter();archived=0;receipts=[]
 paths=sorted(REPORT.glob('round*.json'),key=lambda p:int(p.stem.removeprefix('round')))+sorted((REPORT/'corrections').glob('*.json'))
 for path in paths:
  batch=json.loads(path.read_text());key=batch['receipt']['key'];receipt=json.loads(get(key));n=0
  for r in read_dataset(receipt['observations']):
   n+=1;dispositions[r.get('_import_disposition','unknown')]+=1
   identities=identity_set([r]);seen.update(identities)
   for identity in identities:identity_outcomes[identity].add(r.get('_import_disposition','unknown'))
   if r.get('_import_disposition','').startswith('duplicate'):dupes.update(identities)
  assert n==receipt['observation_count'];archived+=n;receipts.append({'receipt':key,'verified_observations':n})
 novel_outcomes=novel_identity_outcomes(identity_outcomes,oldobs,current=identity_set(after))
 candidates=[r for r in new if r.get('status') not in ('active','missing_source') or r.get('confidence')=='LOW' or r['country_code'] in ('UA','PL')]
 rows=[{'country':c,'before':baseline['countries'].get(c,0),'after':counts.get(c,0),'published_added':counts.get(c,0)-baseline['countries'].get(c,0),'canonical_added':sum(r['country_code']==c for r in new)} for c in sorted(set(baseline['countries'])|set(counts)|{r['country_code'] for r in new})]
 with (REPORT/'country-growth.csv').open('w',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator='\n');w.writeheader();w.writerows(rows)
 published=sum(counts.values());added=published-baseline['canonical']
 result={'measured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'published_before':baseline['canonical'],'published_after':published,'published_added':added,'canonical_master_before':len(before),'canonical_master_after':len(after),'canonical_unique_added':len(new),'new_candidates_only_r2':len(candidates),'new_low_unpublished':sum(r.get('confidence')=='LOW' for r in candidates),'all_candidates_only_r2':len(after)-published,'countries_before':len(baseline['countries']),'countries_after':len(counts),'new_countries':sorted(set(counts)-set(baseline['countries'])),'observation_identity_scope':'OSM object IDs are global across country/region partitions; government source IDs retain their dataset namespace',
 'new_observation_source_identities':len(seen-oldobs),'unique_observation_source_identities_processed':len(seen),'observation_rows_archived_across_batches':archived,'unique_duplicate_source_identities_discarded':len(dupes),'observation_pass_dispositions':dict(dispositions),'baseline_records_unchanged':len(before),'database_bytes_before':baseline['database_bytes'],'database_bytes_after':size,'database_MB_per_10000_published':round((size-baseline['database_bytes'])/1000000/max(added,1)*10000,3),'postgres_mass_observations':0,'low_published':low,'receipts':receipts,'country_growth':rows}
 result.update(new_source_identity_outcomes=dict(novel_outcomes),new_source_duplicate_identities_discarded=novel_outcomes['duplicate_geometry']+novel_outcomes['duplicate_identity'],duplicate_count_scope='Observation pass totals include repeated batches and corrective verification snapshots. Novel source identity outcomes count each non-baseline identity once; acceptance takes precedence only while that source identity remains in the current canonical master. Retired verified aliases count as duplicates.')
 corrections=[json.loads(p.read_text()) for p in sorted((REPORT/'corrections').glob('*.json'))]
 result.update(retired_verified_source_aliases=sum(c['correction']['retired_verified_aliases'] for c in corrections),retrospectively_held_new_records=sum(c['correction']['review_candidates'] for c in corrections),unique_camera_count_scope='Canonical IDs after deduplication, including unpublished review candidates; uncertain candidates are not a claim of confirmed distinct physical devices.')
 inventory=REPORT/'r2-inventory.json'
 if inventory.exists():result['r2_storage']=json.loads(inventory.read_text())
 (REPORT/'summary.json').write_bytes(encode(result));print(json.dumps({k:v for k,v in result.items() if k not in ('country_growth','receipts')},indent=2))
if __name__=='__main__':main()
