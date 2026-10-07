# Production Master DB bootstrap

Verified: 2026-10-07T00:05:11.687078+00:00

Existing Supabase project `ydgzsdlwnurychkbgsmn`: **50,141 stored records**, **45,061 published**, **44 countries with published data**.
Added stored identities versus the preserved 1,323-row baseline: 48,818. Published Europe: 41,176; USA: 2,771; Canada: 1,114.

Sources: 61 country/feed registrations, including 17 official feeds. Independent provider groups: 15 (Chicago/Baltimore feeds grouped by authority; OSM country partitions count as one). OSM-only published records: 37,867.

Supplemental broad OSM speed queries completed for 44/47 countries; incomplete: AD, CY, FR. Full enforcement queries completed for all 47. Retained primary OSM API/government observations are used where broad requests fail. Acquisition errors and snapshot dates remain explicit.

All country exports were fetched from the deployed public Edge Function and compared with actual database counts. LOW publication, invalid coordinates/limits, missing section endpoints, duplicate canonical IDs and merged same-feed lane identities: **0**.

The original 1,323 UA/PL records and legacy export contracts are preserved. New UA/PL observations are held inactive pending a reviewed feed replacement. Existing bundles remain offline fallbacks; Supabase is the primary source.

Independent source sample checks: 120 passed across 44 countries. These are automated OSM API/government geometry checks, not on-road verification; see `independent-sample-validation.json`.

Ten importer safety checks and application smoke checks passed. iOS/Android Expo exports passed. Native devices and store releases were not tested or published; existing installed store versions need a later app release to receive code changes.

Coverage is the available validated bootstrap, not a claim that all physical cameras are known. Country polygons discard neighboring OSM points. Official boundary uncertainty, ambiguous endpoints, portable/historical sites and source conflicts are held for review. Older official snapshot dates are retained. Missing observations retain history instead of immediate deletion.

All raw/cache/backups stay inside the project and are excluded from Git, alongside `.env.bootstrap`, signing keys, dependencies and build artifacts. Original app identifiers, EAS, app dependency lockfiles and Supabase connection are unchanged.

Update from the project root: `.bootstrap-venv/bin/python scripts/update_cameras.py`. Credentials remain local. Source licenses, attribution, acquisition outcomes, policy exceptions, dedupe and update differences are in the adjacent reports and source registry.

## Country counts

| Country | Stored | Published | HIGH | MEDIUM | LOW | Merged observations |
|---|---:|---:|---:|---:|---:|---:|
| UA — Ukraine | 847 | 426 | 426 | 421 | 0 | 30 |
| PL — Poland | 2632 | 897 | 897 | 1290 | 445 | 25 |
| FR — France | 6654 | 6221 | 3190 | 3090 | 374 | 751 |
| ES — Spain | 3670 | 3213 | 721 | 2492 | 457 | 36 |
| DE — Germany | 5819 | 5793 | 0 | 5805 | 14 | 0 |
| GB — United Kingdom | 3627 | 3415 | 0 | 3415 | 212 | 0 |
| IE — Ireland | 25 | 15 | 0 | 15 | 10 | 0 |
| PT — Portugal | 338 | 328 | 0 | 328 | 10 | 0 |
| IT — Italy | 6084 | 6010 | 0 | 6013 | 71 | 0 |
| AT — Austria | 1526 | 1500 | 0 | 1500 | 26 | 0 |
| CH — Switzerland | 728 | 710 | 0 | 710 | 18 | 0 |
| BE — Belgium | 1969 | 1689 | 0 | 1689 | 280 | 0 |
| NL — Netherlands | 1024 | 645 | 0 | 645 | 379 | 0 |
| LU — Luxembourg | 54 | 37 | 0 | 37 | 17 | 0 |
| DK — Denmark | 24 | 24 | 0 | 24 | 0 | 0 |
| SE — Sweden | 2471 | 2471 | 0 | 2471 | 0 | 0 |
| NO — Norway | 692 | 525 | 387 | 138 | 167 | 157 |
| FI — Finland | 954 | 951 | 0 | 951 | 3 | 0 |
| IS — Iceland | 28 | 20 | 0 | 20 | 8 | 0 |
| CZ — Czech Republic | 1318 | 1318 | 0 | 1318 | 0 | 0 |
| SK — Slovakia | 68 | 68 | 0 | 68 | 0 | 0 |
| HU — Hungary | 540 | 540 | 0 | 540 | 0 | 0 |
| RO — Romania | 336 | 330 | 0 | 336 | 0 | 0 |
| BG — Bulgaria | 77 | 77 | 0 | 77 | 0 | 0 |
| HR — Croatia | 966 | 965 | 0 | 965 | 1 | 0 |
| SI — Slovenia | 278 | 277 | 0 | 277 | 1 | 0 |
| RS — Serbia | 458 | 426 | 0 | 426 | 32 | 0 |
| BA — Bosnia and Herzegovina | 246 | 246 | 0 | 246 | 0 | 0 |
| ME — Montenegro | 13 | 13 | 0 | 13 | 0 | 0 |
| MK — North Macedonia | 167 | 164 | 0 | 164 | 3 | 0 |
| AL — Albania | 2 | 2 | 0 | 2 | 0 | 0 |
| GR — Greece | 413 | 411 | 0 | 413 | 0 | 0 |
| LT — Lithuania | 558 | 370 | 0 | 370 | 188 | 0 |
| LV — Latvia | 139 | 135 | 0 | 135 | 4 | 0 |
| EE — Estonia | 85 | 85 | 0 | 85 | 0 | 0 |
| MD — Moldova | 79 | 79 | 0 | 79 | 0 | 0 |
| CY — Cyprus | 74 | 74 | 0 | 74 | 0 | 0 |
| MT — Malta | 22 | 22 | 0 | 22 | 0 | 0 |
| XK — Kosovo | 0 | 0 | 0 | 0 | 0 | 0 |
| TR — Turkey | 692 | 659 | 0 | 659 | 33 | 0 |
| AD — Andorra | 11 | 11 | 0 | 11 | 0 | 0 |
| LI — Liechtenstein | 8 | 8 | 0 | 8 | 0 | 0 |
| MC — Monaco | 6 | 6 | 0 | 6 | 0 | 0 |
| SM — San Marino | 0 | 0 | 0 | 0 | 0 | 0 |
| VA — Vatican City | 0 | 0 | 0 | 0 | 0 | 0 |
| US — USA | 2934 | 2771 | 1334 | 1594 | 6 | 34 |
| CA — Canada | 1485 | 1114 | 601 | 721 | 163 | 36 |

Zero-country counts mean no validated available observations in the acquired feeds, not proof that no real cameras exist. See source-discovery-audit.json for excluded licenses, unusable coordinates and traffic CCTV.
