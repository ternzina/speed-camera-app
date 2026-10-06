# Production camera Master DB

The authoritative database is the existing **Supabase CamAlert** project
`ydgzsdlwnurychkbgsmn`. The app reads the existing `camera-export` Edge Function.
Local normalized JSON is an import/validation cache. Bundled UA/PL JSON is retained
as the pre-existing offline fallback; it is not substituted for production.

## Update

From the project root, run:

```sh
.bootstrap-venv/bin/python scripts/update_cameras.py
```

This refreshes licensed government feeds, live OSM objects and country-sized
Overpass queries, then normalizes, deduplicates, validates, batch-upserts and
reads the imported records back from Supabase. Failed downloads retain their last
successful observations; errors are recorded. There is no production cron.
`--resume` reuses completed downloads; `--normalize-only` validates without writes;
`--sync-only` safely resumes an interrupted import from the normalized cache.
`--countries FR US CA` limits OSM acquisition; other country snapshots are preserved.

The isolated interpreter uses `scripts/requirements-bootstrap.txt`; app dependencies,
identifiers and EAS settings are unchanged. `.env.bootstrap` contains a dedicated
least-privilege PostgreSQL login, is ignored and has mode 0600. No service role key
is used by the importer. A new machine needs an authorized local credential setup;
credentials must never be copied into Git. The importer can recover the original
baseline through its private read-only function, and downloads missing boundaries.

## Storage and provenance

- `master-db/raw/`: original government downloads and OSM ID discovery CSVs.
- `master-db/cache/`: Overpass phase snapshots, live API verification, normalized
  data, build exports and validation intermediates.
- `master-db/backups/`: pre-bootstrap records, source links and manifests.
- `master-db/bootstrap/reports/`: shareable acquisition, dedupe, quality, diff and
  production statistics. `source-registry.json` records source licenses and URLs.

Raw/cache/backups, virtualenv, environment files, signing keys and build artifacts
are ignored. Existing local backups remain on disk. A closed Supabase backup schema
`camera_backup_20261007` also preserves the original tables.

Source identities are `(source_code, source_id)`, not coordinates or CSV row order.
Independent sources can attach to one canonical record; different IDs within a
single feed remain separate to protect lane pairs. Conflicting directions/speeds
are not merged. Missing direction requires a much tighter 5 m match; known compatible
travel direction permits 30 m. Section endpoints require explicit source roles.
Coordinates are not averaged. Unknown limits/directions stay null; mph is converted
to km/h. `camera:direction` optical facing is not treated as travel direction.

Each refresh replaces its OSM phase snapshot. The live OSM API fallback uses mirror
CSV **only to discover IDs**; mirror coordinates/tags are never imported. IDs are
re-fetched from the authoritative OSM API, and remain a single OSM source. Unknown
mirror freshness is recorded in the acquisition report. Object modification dates
and acquisition timestamps are kept separately.

The pipeline preserves `first_seen_at`, updates actual observation `last_seen_at`,
keeps missing observations, and writes `missing-observations.json` / `update-diff.json`.
A record missing from every refreshed source is marked `missing_source`, retaining
its last observation and publication state; it is not immediately deleted.
An obsolete canonical alias after a dedupe change stays in history as an inactive
candidate. LOW/conflicting/border-uncertain records are never exported. New UA/PL
candidates remain inactive so the established production feeds and Polish sections
stay unchanged until a separately reviewed replacement is justified.

## Licenses and limits

OSM-derived records carry © OpenStreetMap contributors and ODbL 1.0 attribution:
https://www.openstreetmap.org/copyright . The export exposes source provenance and
licenses. Government feeds retain their individual attribution and license terms;
this does not relicense the application. Natural Earth country geometry is public
domain. Border/coastline uncertainty is conservatively quarantined for official data.

Coverage means accessible recorded cameras, not a guarantee that every real camera
is known or that OSM-only records have government confirmation. Current downloads
can contain older official snapshots; the source snapshot date is not represented
as a recent installation date. Portable deployment sites and historical citation
locations are candidates, not asserted active fixed cameras. Traffic-monitoring CCTV
feeds and sources prohibiting commercial reuse are excluded.

Run safety checks with:

```sh
.bootstrap-venv/bin/python -m unittest discover -s scripts/tests -v
node scripts/tests/app-smoke.cjs
.bootstrap-venv/bin/python scripts/verify_samples.py
```

The Supabase migrations under `supabase/bootstrap_*.sql` document additive changes
already applied through the authorized connector. Do not rerun the initial schema
migration blindly against an existing migrated project. Rollback data are preserved;
production tables were not replaced or truncated.

Ontario OSM-only speed/combined/section records are quarantined against the current
municipal ASE prohibition effective 2025-11-14, using the Ontario polygon and the
official policy at https://www.ontario.ca/page/reducing-speeding-real-time . Red-light
records are retained. The policy rule was checked on 2026-10-07; later legal changes
need a reviewed rule update, not automatic activation from stale OSM tags.
