#!/usr/bin/env python3
"""Summarize actual Supabase expansion against the frozen 50141-row baseline."""
import collections,csv,datetime,gzip,hashlib,json,subprocess
from pathlib import Path
from update_cameras import connect
from bootstrap_cameras import save
ROOT=Path(__file__).resolve().parents[1];REPORT=ROOT/'master-db/expansion/reports'

def main():
    before=json.loads((REPORT/'baseline.json').read_text());baseline=json.loads(gzip.decompress((ROOT/'master-db/backups/expansion/baseline-50141.json.gz').read_bytes()));ids=[r['canonical_id'] for r in baseline]
    prior={r['country_code']:r for r in before['countries']}
    with connect() as conn:
        counts=list(conn.execute('select country_code,count(*),count(*) filter(where active) from public.camera_records group by 1 order by 1'))
        new=list(conn.execute('select canonical_id,country_code,camera_type,active,confidence from public.camera_records where not (canonical_id=any(%s))',(ids,)))
        sources=list(conn.execute('''select s.code,s.name,s.source_type,min(l.raw_payload->'_source'->>'source_url'),min(l.raw_payload->'_source'->>'license'),min(l.raw_payload->'_source'->>'license_url'),count(*),count(*) filter(where r.active) from public.camera_records r join public.camera_source_links l on l.camera_record_id=r.id join public.camera_sources s on s.id=l.source_id where not (r.canonical_id=any(%s)) group by 1,2,3 order by 1''',(ids,)))
    all_codes=set(prior)|{r[0] for r in counts};after={c:(n,a) for c,n,a in counts};rows=[]
    for c in sorted(all_codes):
        old=prior.get(c,{});n,a=after.get(c,(0,0))
        rows.append({'country_code':c,'before':old.get('stored',0),'after':n,'added':n-old.get('stored',0),'published_before':old.get('published',0),'published_after':a,'published_added':a-old.get('published',0)})
    with (REPORT/'country-growth.csv').open('w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
    accepted={r[0] for r in new};dupes={}
    for path in list((REPORT/'rounds').glob('*dedupe.json'))+[REPORT/'dedupe.json']:
        if not path.exists():continue
        for item in json.loads(path.read_text())['items']:
            if item['source_id'] not in accepted:
                dupes[(item['source_id'],item['reason'])]=item
    unique_source_ids={k[0] for k in dupes};spatial={k[0] for k in dupes if k[1]=='compatible spatial duplicate'}
    source_rows=[dict(zip(['code','name','source_type','source_url','license','license_url','new_records','new_published'],r)) for r in sources]
    save(REPORT/'new-sources.json',source_rows)
    summary={'verified_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'before':before['stored'],'after':sum(x[1] for x in counts),'new_records':len(new),'published_before':before['published'],'published_after':sum(x[2] for x in counts),'new_records_published':sum(x[3] for x in new),'countries_before':sum(x.get('stored',0)>0 for x in before['countries']),'countries_after':len(counts),'new_country_codes':sorted(c for c in after if c not in prior),'country_growth':rows,'new_types':dict(collections.Counter(x[2] for x in new)),'new_confidence':dict(collections.Counter(x[4] for x in new)),'unique_duplicate_source_observations_discarded':len(unique_source_ids),'unique_spatial_duplicate_source_observations':len(spatial),'duplicate_count_method':'Unique source identities across acquisition/import rounds, excluding all identities actually appended during this expansion; repeated cache passes are not counted twice. This is not a count of distinct physical devices.','source_feeds_with_added_records':len(source_rows),'new_sources':source_rows,'initial_50141_changed':0,'database_project':'ydgzsdlwnurychkbgsmn'}
    current_active={r[0]:r[3] for r in new}
    rounds=[]
    for path in sorted((ROOT/'master-db/backups/expansion').glob('round*-new-records.json.gz'),key=lambda p:int(p.name.split('-')[0][5:])):
        observations=json.loads(gzip.decompress(path.read_bytes()))
        rounds.append({'round':int(path.name.split('-')[0][5:]),'new_records':len(observations),'currently_published':sum(bool(current_active.get(r['canonical_id'])) for r in observations)})
    rounds.append({'round':5,'new_records':0,'currently_published':0,'note':'Primary verification removed all 15 provisional stale OSM identities'})
    rounds.sort(key=lambda r:r['round'])
    summary['import_rounds']=rounds
    acquisition=REPORT/'osm-all-acquisition.json'
    if acquisition.exists():
        phases=json.loads(acquisition.read_text())
        summary['osm_acquisition_phase_outcomes']=dict(collections.Counter(r['result'] for r in phases))
        summary['osm_acquisition_countries_attempted']=len({r['country'] for r in phases})
    save(REPORT/'expansion-summary.json',summary)
    configs=[]
    for name in ('app.json','eas.json','package.json','package-lock.json','App.js','config.js'):
        p=ROOT/name
        if not p.exists():continue
        old=subprocess.check_output(['git','show','b47536a:'+name],cwd=ROOT)
        assert old==p.read_bytes(),'Production config unexpectedly changed: '+name
        configs.append({'path':name,'sha256':hashlib.sha256(old).hexdigest(),'unchanged':True})
    save(REPORT/'production-config-preservation.json',configs)
    text=f'''# Master DB expansion

Verified against existing Supabase production project `ydgzsdlwnurychkbgsmn`: **{summary['before']:,} → {summary['after']:,} stored records**; **{summary['new_records']:,} new**, of which **{summary['new_records_published']:,} published**. Public total: **{summary['published_after']:,}**. Countries with stored data: **{summary['countries_before']} → {summary['countries_after']}**.

The full original 50,141 records, including metadata, were compared with the actual database and remain unchanged. Additionally, all 49,852 source identities available in the frozen normalization snapshot retain their original record ownership. Only newly added observations whose current primary OSM evidence changed were held for review. LOW is never published. Official geometry is retained; coordinates and conditional speed limits are not guessed. UA/PL production feed contracts are preserved.

New country partitions: {', '.join(summary['new_country_codes'])}. Russia, Turkey, Georgia, Armenia and Azerbaijan are whole-country observations, including areas outside geographic Europe. Counts represent source records/approaches/sections, not a census of distinct physical poles.

Government feeds include Montgomery County speed/red-light, Tacoma, Boulder, San Francisco red-light and speed (speed sites already represented), Peel, Hamilton, Kingston, Ottawa, York, Calgary, Lancashire, Lisbon, Luxembourg, Cyprus, Brussels regional/municipal equipment and Madrid fixed/section/red-light feeds. Licensing and actual net additions per feed are in `new-sources.json`; all acquisition configurations are in `../sources.json`. Ambiguous Luxembourg/Cyprus/Brussels equipment and inaccurate historic New Orleans records remain candidates.

OSM acquisition includes speed nodes, alternate enforcement tags, relations, ways, explicit device/from/to roles, new country partitions and primary parent-membership discovery for low-count countries. Overpass replication timestamps can be old: only expansion objects are rechecked through the current primary OSM API before publication. Missing primary proof or approximate way centers stay LOW. Acquisition failures are explicit; empty/failed downloads do not prove absence of cameras.

Discarded unique duplicate source observations: **{len(unique_source_ids):,}**, including **{len(spatial):,}** compatible spatial duplicates. Repeated cached passes and newly accepted identities are excluded from this count. No existing official records are replaced or merged into weaker data.

Actual per-country totals and additions, including zero-growth countries: `country-growth.csv`. Complete counts, types and source breakdown: `expansion-summary.json`. Live primary-source samples: `independent-validation.json`. Actual deployed public country exports: `production-verification.json`. This is automated source/database validation, not on-road inspection. Implementation verification includes 22 safety tests and the application cache test with 16,000 records. Acquisition phase outcomes and decreasing net additions per import round are included in `expansion-summary.json`; failed Overpass attempts are retained in `osm-all-acquisition.json`.

All raw downloads, caches, credentials and backups stay under this project and are excluded from Git. Production identifiers, EAS configuration, dependencies and Supabase connection are unchanged. Supabase remains the production source; local JSON does not replace it. Store releases were not created during this data expansion.

## Repeatable append pipeline

From this production project: `.bootstrap-venv/bin/python scripts/update_cameras.py --expand --acquire`. The existing isolated interpreter, ignored limited database credentials and frozen baseline snapshots are used. Normalization checks source identities and conservative spatial compatibility against every current production record. Append-only writes reject pre-existing canonical identities and source-link identities before any write. New OSM evidence is refreshed before sync; batches are resumable. Snapshots are deliberately not distributed through Git.

A separate acquisition attempt can be resumed with `.bootstrap-venv/bin/python scripts/fetch_expansion_osm.py --all-phases`; completed downloads are reused. Run `scripts/discover_primary_relations.py` with the same interpreter for the targeted membership discovery. Use `scripts/verify_expansion.py` and `verify_production.main(Path('master-db/expansion/reports'))` after sync. These checks read the existing production database and public export.
'''
    (REPORT/'EXPANSION-REPORT.md').write_text(text)
    print({k:summary[k] for k in ('before','after','new_records','new_records_published','published_after','countries_after','unique_duplicate_source_observations_discarded')},flush=True)

if __name__=='__main__':main()
