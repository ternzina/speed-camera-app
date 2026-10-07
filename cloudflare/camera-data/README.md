# Production camera exports

Existing R2 bucket: `speed-camera-data`, Cloudflare account `Ternzina@gmail.com's Account`.
Public Worker: `https://speed-camera-data.ternzina.workers.dev`.
No DNS change, account/bucket creation, service-role key, permanent upload route or store submission.

## Delivery contract

- `production/v1/manifest.json`: schema version, generation timestamp, total canonical published records, attribution, and country entries with ISO code, record count, version, updated_at, SHA-256, decoded UTF-8 byte size, immutable path/URL and type counts.
- `production/v1/countries/XX/<sha256>.json`: immutable compact trip JSON. Only trip fields survive; provenance/raw payload/history stay in Supabase.
- `production/v1/countries/XX.json`: convenient current alias, resolves through the manifest.
- Country objects cache for one year; manifest/aliases for 60 seconds. Content type is JSON; HTTP gzip/brotli negotiation is handled transparently by Cloudflare and the native fetch stack. JSON, gzip and Brotli were measured; gzip files are local benchmarks, not production bucket objects. Checksums cover the decoded UTF-8 JSON body, so HTTP compression does not change them.
- GET/HEAD/OPTIONS only. Public CORS supports browsers without credentials. Conditional GET accepts both strong and weak ETags. Worker streams from the existing R2 binding and caches uncompressed JSON; it never caches precompressed streams, avoiding double compression.

Poland exports all 169 published red-light devices and a separate 68-site render projection. Country record_count includes devices once (897 Polish canonical records); the app uses the preserved physical sites for warnings. The render projection is not counted as additional cameras. All 59,270 canonical records are present; 59,169 trip render records result from the existing Polish grouping.

## App and offline behavior

The app loads a small manifest and **only the selected country**. If its verified version is unchanged, it reuses the country cache. New JSON must pass SHA-256, byte length, ISO/schema, total count, coordinates and section endpoint checks before use.

Delivery fallback: R2 → retained Supabase camera-export → last successful device cache → bundled UA/PL. Other countries require a previous successful download for offline use; bundled UA/PL are never presented as data for another country.

AsyncStorage cache v4 uses bounded 200,000-character chunks, checksums and immutable write generations. All chunks succeed before the root pointer changes. Failed writes leave the previous cache usable; corruption is isolated per country. All previously downloaded countries remain cached. Legacy caches still load, including v3. Foreground/background warning engines share the loaded trip feeds.

The existing installed store builds continue using the unchanged Supabase endpoint. R2 loading is prepared in the next app source version; no App Store, Google Play or EAS OTA release was performed.

## Repeatable export/publication pipeline

1. Run `scripts/export_r2_cameras.py` with the existing isolated `.bootstrap-venv` runtime and ignored `.env.bootstrap`. It reads the existing DB/Edge endpoint, builds deterministic exports and a manifest, and asserts each canonical published count. All generated files stay under `master-db/cache/r2-migration`.
2. Run `scripts/prepare_r2_publisher.cjs`. It generates a local mode-0600 Ed25519 private key in ignored `.env.r2-publisher` if missing. Only the **public** verification key is emitted in ignored `publisher-metadata.json`.
3. Using the authorized Cloudflare connector/API, deploy `publisher.mjs` as temporary `speed-camera-data-publisher` with the generated metadata: existing R2 binding and public verification key. Enable its workers.dev subdomain, disable previews. The read-only production Worker is separate and needs no signing key. Upload deployment uses the documented Cloudflare multipart API; no mobile credentials are introduced.
4. Run `scripts/publish_r2_exports.cjs`. Each PUT requires a time-limited Ed25519 signature binding method, exact key, SHA-256 and byte length. It publishes immutable country objects, verifies decoded identity/gzip delivery for all countries, checks the DB fingerprint still matches the snapshot, and **publishes manifest last**. If the DB changed mid-run, rebuild before publishing. The previous manifest, when present, is backed up locally under `master-db/backups/r2-migration`.
5. Run `scripts/verify_r2_migration.cjs`: app loader over real public URLs, every country's legacy trip fields, aliases, count/checksum, direction/no-direction, red-light/sections/limits, Polish section ending, CORS/HEAD/304 and denied unsigned/public writes. Run the delivery/Worker/app tests. Verify bucket inventory and metadata using a paginated listing (`per_page=1000` for the current 50 objects).
6. Delete the temporary publisher Worker after verification. Do not delete immutable exports needed by current or previous manifests. Do not create an unattended update schedule without an explicit request. A later authorized camera import must rebuild/publish the static release to become visible through R2.

## Rollback

The Supabase endpoint and canonical/provenance tables are untouched. A delivery outage falls back automatically. To roll back a data release, redeploy the temporary signed publisher and upload the saved previous manifest pointing to retained immutable objects, then verify every checksum/count. To roll back application loading, use the source preceding this migration; the existing store binaries still use that endpoint. No destructive DB rollback is necessary because no database mutation occurred.

## Audit and verification

`supabase/storage_audit.sql` is a read-only, privileged aggregate audit (no raw row data). Exact before/after sizes, table counts, TOAST, all indexes and JSON value totals are stored under `master-db/reports`. No DB table/index deletion or repacking occurred: the database already sits inside the requested 250–300 MB target band. R2 shifts delivery load, not canonical storage.

Scripts: `scripts/tests/r2-delivery.cjs`, `scripts/tests/r2-worker.cjs`, `scripts/tests/app-smoke.cjs`, `scripts/verify_r2_db_snapshot.py`. No new app/native dependency is required. Worker API types and official best-practices documentation were checked at implementation time; downloaded types and all build artifacts stay in ignored project cache.

Official references: [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/), [Worker multipart metadata](https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/), [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/), [Worker best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).
