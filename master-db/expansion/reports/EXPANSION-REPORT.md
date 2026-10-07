# Master DB expansion

Verified against existing Supabase production project `ydgzsdlwnurychkbgsmn`: **50,141 → 65,134 stored records**; **14,993 new**, of which **14,209 published**. Public total: **59,270**. Countries with stored data: **44 → 49**.

The full original 50,141 records, including metadata, were compared with the actual database and remain unchanged. Additionally, all 49,852 source identities available in the frozen normalization snapshot retain their original record ownership. Only newly added observations whose current primary OSM evidence changed were held for review. LOW is never published. Official geometry is retained; coordinates and conditional speed limits are not guessed. UA/PL production feed contracts are preserved.

New country partitions: AM, AZ, BY, GE, RU. Russia, Turkey, Georgia, Armenia and Azerbaijan are whole-country observations, including areas outside geographic Europe. Counts represent source records/approaches/sections, not a census of distinct physical poles.

Government feeds include Montgomery County speed/red-light, Tacoma, Boulder, San Francisco red-light and speed (speed sites already represented), Peel, Hamilton, Kingston, Ottawa, York, Calgary, Lancashire, Lisbon, Luxembourg, Cyprus, Brussels regional/municipal equipment and Madrid fixed/section/red-light feeds. Licensing and actual net additions per feed are in `new-sources.json`; all acquisition configurations are in `../sources.json`. Ambiguous Luxembourg/Cyprus/Brussels equipment and inaccurate historic New Orleans records remain candidates.

OSM acquisition includes speed nodes, alternate enforcement tags, relations, ways, explicit device/from/to roles, new country partitions and primary parent-membership discovery for low-count countries. Overpass replication timestamps can be old: only expansion objects are rechecked through the current primary OSM API before publication. Missing primary proof or approximate way centers stay LOW. Acquisition failures are explicit; empty/failed downloads do not prove absence of cameras.

Discarded unique duplicate source observations: **20,345**, including **242** compatible spatial duplicates. Repeated cached passes and newly accepted identities are excluded from this count. No existing official records are replaced or merged into weaker data.

Actual per-country totals and additions, including zero-growth countries: `country-growth.csv`. Complete counts, types and source breakdown: `expansion-summary.json`. Live primary-source samples: `independent-validation.json`. Actual deployed public country exports: `production-verification.json`. This is automated source/database validation, not on-road inspection. Implementation verification includes 22 safety tests and the application cache test with 16,000 records. Acquisition phase outcomes and decreasing net additions per import round are included in `expansion-summary.json`; failed Overpass attempts are retained in `osm-all-acquisition.json`.

All raw downloads, caches, credentials and backups stay under this project and are excluded from Git. Production identifiers, EAS configuration, dependencies and Supabase connection are unchanged. Supabase remains the production source; local JSON does not replace it. Store releases were not created during this data expansion.

## Repeatable append pipeline

From this production project: `.bootstrap-venv/bin/python scripts/update_cameras.py --expand --acquire`. The existing isolated interpreter, ignored limited database credentials and frozen baseline snapshots are used. Normalization checks source identities and conservative spatial compatibility against every current production record. Append-only writes reject pre-existing canonical identities and source-link identities before any write. New OSM evidence is refreshed before sync; batches are resumable. Snapshots are deliberately not distributed through Git.

A separate acquisition attempt can be resumed with `.bootstrap-venv/bin/python scripts/fetch_expansion_osm.py --all-phases`; completed downloads are reused. Run `scripts/discover_primary_relations.py` with the same interpreter for the targeted membership discovery. The missing/empty relation pass can be retried with `scripts/fetch_expansion_osm.py --compact-relations --countries ISO...`; this omits approximate ways and preserves old empty files under ignored backups. Use `scripts/verify_expansion.py` and `verify_production.main(Path('master-db/expansion/reports'))` after sync. These checks read the existing production database and public export.
