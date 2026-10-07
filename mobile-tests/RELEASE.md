# CamAlert 0.9.0

Branch: feature/r2-offline-release. Base: fc0e3dea. Isolated worktree; collection pipeline, source registry, storage migration and main were not changed.

Settings loads country choices from the R2 manifest (49 countries verified on 2026-10-07). Select multiple checkboxes and download them without changing the active driving country. Countries remain cached across restarts and switching countries. The UI shows saved countries, available updates, progress and failed downloads. Bundled offline data exist for UA and PL; other countries must be downloaded first.

Delivery: R2 manifest + SHA-256/size/schema/count checks, then validated Supabase, then verified local cache, then bundled UA/PL or an empty feed. A matching R2 checksum requires only the manifest request. Download failures still retain a successfully fetched country list. Updates and multi-country downloads are serialized; successful offline status requires a committed local cache. Cache chunks are checksummed, written to immutable generations, and the pointer is committed only after successful writes. A failed write preserves the previous generation. Corruption is isolated to the affected country.

Version audit: app 0.8.2 → 0.9.0; local iOS build 11 and EAS remote 6 → explicit build 12; EAS Android versionCode 3 → explicit 4. Production uses local version source and disables autoIncrement so the branch and artifacts agree. Future releases must increment both native numbers manually. No auto-submit is used.

Validation:
- `npm run test:mobile`: 11 country renders, settings with 49 offline choices, directional selection, Polish section ending, 16,000-camera chunked cache, retention and legacy compatibility.
- `npm run test:delivery`: live R2 UA/PL/DE/FR/US/CA; simulated network-off restart; current checksum and changed-version logic; checksum mismatch; live Supabase fallback for six countries; invalid fallback rejection; bundled fallback; failed cache write and isolated corruption.
- `npx expo export --platform all`: Android and iOS Hermes bundles.

These are automated data/cache/render checks and production compilation checks. Physical-device GPS, airplane-mode UI and background alerts were not exercised.
