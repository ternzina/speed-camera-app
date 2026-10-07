# Verified Supabase → R2 delivery migration

Verified production baseline: `1cc5a6517cad85bf86acf2960b41cc81fd8041dc`. Completed 2026-10-07T07:43:42.908102+00:00.

Supabase remains the live canonical/control/provenance database. R2 serves compact static country releases. No database mutation, schema/index removal, source payload loss, store submission or EAS OTA release occurred.

Database before / after: **289,699,507 / 289,699,507 bytes** (276.279 MiB; 289.700 decimal MB). Saved **0 MB**. This already satisfies the 250–300 MB desired band. Computed Edge exports were not persisted in DB, so moving their delivery cannot reclaim canonical table space.

Largest objects: public.camera_records 132.125 MiB; public.camera_source_links 126.297 MiB; public.camera_sources 5.141 MiB. Largest indexes: spatial grid 5.727 MiB; source/external identity 5.234 MiB; canonical ID 4.938 MiB. Exact all-table/TOAST/JSONB/top-20 index details and cleanup candidates with prerequisites/rollback: SUPABASE-STORAGE-AUDIT.md. No cleanup has proven worthwhile/safe enough to perform in this migration.

R2: **50 objects**, **11,023,295 bytes** (11.023 MB), **49 countries**, **59,270 published canonical records**; full Supabase still has **65,134**. Canonical full-row fingerprint including metadata unchanged: `7b8495478fba497faf8ca9db9e800dd3`.

Trip country JSON: 10,991,539 bytes vs 54,531,337 legacy export bytes, 79.84% smaller. Local compression comparison: gzip 1,381,990 bytes; Brotli quality 6 1,297,394 bytes. Stored objects are compact identity JSON; Cloudflare transparently compresses HTTP responses with gzip/brotli. Native fetch decodes these without a new dependency. SHA-256 covers decoded UTF-8 bytes, independently of wire encoding.

Manifest: https://speed-camera-data.ternzina.workers.dev/production/v1/manifest.json
Country alias: https://speed-camera-data.ternzina.workers.dev/production/v1/countries/UA.json
Immutable URL: https://speed-camera-data.ternzina.workers.dev/production/v1/countries/{ISO}/{SHA256}.json

Only the selected country is downloaded. A matching verified manifest version skips its download. R2 → existing Supabase endpoint → successful local country cache → bundled UA/PL. Device cache preserves downloaded countries; bounded chunks, per-country checksums and atomic pointer replacement protect offline data from interruption/corruption. See cloudflare/camera-data/README.md for exact contract, publication and rollback.

## Counts by country

| Country | Supabase published | R2 records | App trip render records |
|---|---:|---:|---:|
| AD | 11 | 11 | 11 |
| AL | 2 | 2 | 2 |
| AM | 280 | 280 | 280 |
| AT | 1500 | 1500 | 1500 |
| AZ | 691 | 691 | 691 |
| BA | 246 | 246 | 246 |
| BE | 1689 | 1689 | 1689 |
| BG | 77 | 77 | 77 |
| BY | 569 | 569 | 569 |
| CA | 1312 | 1312 | 1312 |
| CH | 710 | 710 | 710 |
| CY | 74 | 74 | 74 |
| CZ | 1937 | 1937 | 1937 |
| DE | 5794 | 5794 | 5794 |
| DK | 24 | 24 | 24 |
| EE | 85 | 85 | 85 |
| ES | 3283 | 3283 | 3283 |
| FI | 951 | 951 | 951 |
| FR | 6222 | 6222 | 6222 |
| GB | 3662 | 3662 | 3662 |
| GE | 208 | 208 | 208 |
| GR | 411 | 411 | 411 |
| HR | 965 | 965 | 965 |
| HU | 540 | 540 | 540 |
| IE | 15 | 15 | 15 |
| IS | 20 | 20 | 20 |
| IT | 6023 | 6023 | 6023 |
| LI | 8 | 8 | 8 |
| LT | 370 | 370 | 370 |
| LU | 37 | 37 | 37 |
| LV | 155 | 155 | 155 |
| MC | 6 | 6 | 6 |
| MD | 79 | 79 | 79 |
| ME | 13 | 13 | 13 |
| MK | 164 | 164 | 164 |
| MT | 22 | 22 | 22 |
| NL | 645 | 645 | 645 |
| NO | 525 | 525 | 525 |
| PL | 897 | 897 | 796 |
| PT | 341 | 341 | 341 |
| RO | 330 | 330 | 330 |
| RS | 426 | 426 | 426 |
| RU | 10660 | 10660 | 10660 |
| SE | 2471 | 2471 | 2471 |
| SI | 277 | 277 | 277 |
| SK | 68 | 68 | 68 |
| TR | 659 | 659 | 659 |
| UA | 426 | 426 | 426 |
| US | 3390 | 3390 | 3390 |

Poland: all 169 red-light devices are exported once; an explicit 68-site projection preserves the existing physical-site UI. PL canonical count is 897, trip render count 796. All other countries retain their previous rendered counts. Total canonical count 59,270 vs 59,169 rendered points/sections is explained by this existing 101-device grouping difference; no silent losses.

## Verification

- All 49 decoded identity/gzip production files match SHA-256, byte size and DB publication counts; exact bucket inventory/metadata matches 50 objects.
- All 49 countries loaded through the actual app loader over live public URLs; every existing trip ID, coordinate, direction, speed limit and section start/end matches the retained Edge feed.
- Direction/no-direction, red-light, speed, combined enforcement and average sections covered; real Polish section ending preserved.
- Public aliases, CORS, HEAD, weak ETag 304 and denied public/unsigned writes passed. Temporary signed publisher deleted; only read-only delivery Worker remains.
- 65 delivery/cache/hash checks; 11 Worker auth/read-only checks; 22 existing pipeline safety tests passed. App smoke: 10 countries and 16,000-camera chunked cache.
- iOS and Android Metro/Hermes exports passed (704 modules each); artifacts only in ignored project cache. No physical-device road test is claimed.
- app.json, eas.json, package/lockfile, country names, bundled fallbacks, warning engine and Supabase Edge source are byte-identical to the verified baseline.

## Retained and excluded

Retained in Supabase: all canonical records, status/confidence/review/publication fields, source provenance and raw_payload, sources, import runs/staging, legacy rollback schema, RLS/operational/platform data and Edge export. Existing user-report integration is unchanged. No Supabase object was deleted or archived.

Excluded from Git: .env.bootstrap, .env.r2-publisher, signing JKS, credentials, master-db/raw/, master-db/cache/, master-db/backups/, Expo/Hermes artifacts, dependencies and local runtime. All new working data remains inside the production project. The repository contains exporters, Worker/publisher source, app/manifest/cache integration, read-only storage SQL, reports and tests.

The R2 path is live; application source is prepared for the next release. Already installed store builds continue using the retained Supabase endpoint. Future imports must publish a new static release; no unattended schedule was created.
