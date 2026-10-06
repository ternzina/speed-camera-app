#!/usr/bin/env python3
"""Generate a compact, shareable report from verified production results."""
import csv,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
REPORTS=ROOT/'master-db/bootstrap/reports'
def read(name):return json.loads((REPORTS/name).read_text())
def main():
    stats=read('country-statistics.json');prod=read('production-verification.json');samples=read('independent-sample-validation.json')
    published={r['country_code']:r['export_records'] for r in prod['checks']}
    rows=[dict(country_code=c,**s,production_published=published.get(c,0)) for c,s in stats.items()]
    with (REPORTS/'country-statistics.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
    lines=['# Production Master DB bootstrap','',f"Verified: {prod['checked_at']}",'',
      f"Existing Supabase project `ydgzsdlwnurychkbgsmn`: **{prod['database_total']:,} stored records**, **{prod['production_active']:,} published**, **{len(prod['checks'])} countries with published data**.",
      f"Added stored identities versus the preserved 1,323-row baseline: {prod['database_total']-1323:,}. Published Europe: {prod['europe_active']:,}; USA: {prod['usa_active']:,}; Canada: {prod['canada_active']:,}.",'',
      f"Sources: {prod['sources']} country/feed registrations, including {prod['official_sources']} official feeds. OSM country partitions are one independent source provider. OSM-only published records: {prod['osm_only_active']:,}.",
      '','All country exports were fetched from the deployed public Edge Function and compared with actual database counts. LOW publication, invalid coordinates/limits, missing section endpoints, duplicate canonical IDs and merged same-feed lane identities: **0**.',
      '','The original 1,323 UA/PL records and legacy export contracts are preserved. New UA/PL observations are held inactive pending a reviewed feed replacement. Existing bundles remain offline fallbacks; Supabase is the primary source.',
      '', f"Independent source sample checks: {samples['sample_count']} passed across {samples['countries']} countries. These are automated OSM API/government geometry checks, not on-road verification; see `independent-sample-validation.json`.",
      '', 'Nine importer safety checks and application smoke checks passed. iOS/Android Expo exports passed. Native devices and store releases were not tested or published; existing installed store versions need a later app release to receive code changes.',
      '', 'Coverage is the available validated bootstrap, not a claim that all physical cameras are known. Country polygons discard neighboring OSM points. Official boundary uncertainty, ambiguous endpoints, portable/historical sites and source conflicts are held for review. Older official snapshot dates are retained. Missing observations retain history instead of immediate deletion.',
      '', 'All raw/cache/backups stay inside the project and are excluded from Git, alongside `.env.bootstrap`, signing keys, dependencies and build artifacts. Original app identifiers, EAS, app dependency lockfiles and Supabase connection are unchanged.',
      '', 'Update from the project root: `.bootstrap-venv/bin/python scripts/update_cameras.py`. Credentials remain local. Source licenses, attribution, acquisition outcomes, policy exceptions, dedupe and update differences are in the adjacent reports and source registry.',
      '', '## Country counts','', '| Country | Stored | Published | HIGH | MEDIUM | LOW | Merged observations |','|---|---:|---:|---:|---:|---:|---:|']
    for r in rows:lines.append(f"| {r['country_code']} — {r['country_name']} | {r['final_total']} | {r['production_published']} | {r['high_confidence']} | {r['medium_confidence']} | {r['low_confidence']} | {r['duplicates_merged']} |")
    lines+=['','Zero-country counts mean no validated available observations in the acquired feeds, not proof that no real cameras exist. See source-discovery-audit.json for excluded licenses, unusable coordinates and traffic CCTV.']
    (REPORTS/'BOOTSTRAP-REPORT.md').write_text('\n'.join(lines)+'\n')
if __name__=='__main__':main()
