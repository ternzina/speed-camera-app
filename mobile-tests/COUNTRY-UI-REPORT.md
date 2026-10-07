# Country selection and offline datasets — 2026-10-07

The checked R2 manifest contains 121 immutable country-code datasets. It has no separate US state or Canadian province datasets. US and CA each have one country export. PA resolves to Panama, not Pennsylvania; the PA export identifies country PA and its sampled coordinates are in Panama. OM is Oman, TZ Tanzania, UG Uganda, PE Peru, PG Papua New Guinea, PH Philippines, UY Uruguay.

The UI uses an explicit geography registry, not the length of a code. For a strict country-only list, its criterion is UN members plus the two observers. The checked manifest has 120 entries meeting that criterion, 0 separate state/province/region datasets, and 1 separately served geography (Taiwan). Taiwan appears in a secondary Territories view without an inferred parent country. A typed state/province entry is assigned to its explicit parent country; ambiguous codes such as US/PA and Canada/ON cannot become standalone countries. Unknown geography is excluded from the main list.

No US states or Canadian provinces were found masquerading as countries in the actual manifest. The old dictionary lacked labels for 72 of the current codes, which were displayed as raw ISO codes. `geography-audit.json` records all 72, the counts and checksum-verified sample exports. Taiwan was formerly mixed into the general country list and is now separate.

All published datasets have names and flags in Russian, Ukrainian, English and Polish. The main list is sorted by the localized country name. Available countries need at least 300 published records, except UA/PL/DE/FR/US/CA. There are 43 eligible countries and 77 weak-coverage countries hidden in the checked country catalog. Already downloaded countries remain accessible in the top Downloaded section even if their coverage is below the threshold. Territories are in the secondary view. The published manifest and cached datasets are never filtered or deleted by this UI policy.

A country name selects the driving country; its separate checkbox selects it for multi-country download. The coverage list, current geography label, download progress and failures also use names/flags. The UI count reflects visible countries rather than all 121 datasets. Bundled UA/PL fallback data alone are not labeled Downloaded.

Saved offline means the application completed `saveCameraCache` in native AsyncStorage before it updated the feed state and status. Data are stored in bounded chunks with a local checksum and committed generation pointer. Startup and the background location task reload those country datasets with `loadCameraCache`; warnings do not fetch camera data while processing GPS positions. A stale downloaded dataset still shows Saved offline plus Update available.

Validation completed:
- `npm run test:mobile`: country rendering, separate select/download actions, Downloaded first, weak coverage and subnational/territory exclusion.
- `npm run test:geography`: all current dataset names and flags in four languages, alphabetical ordering, 299/300 boundary, retained low-count downloads, US/PA and Canada/ON hierarchy cases, immutable manifest, verified sample dataset identities and live audit.
- `npm run test:delivery`: six live country exports, version/checksum updates, Supabase/local/bundled fallback, retention and corruption checks; count adapts to the growing manifest.
- `npm run test:offline-warning`: six real datasets saved to disk, new storage instance after restart, checksum verification, all network access prohibited in both App and imported modules, actual App background warning callback produces a local notification for UA/PL/DE/FR/US/CA, foreground non-UA selection and Polish average-speed section from cache. Zero network requests.
- `npx expo export --platform all`: iOS and Android Hermes bundles compiled. The live Expo Go preview bundle was also fetched successfully through the existing QR tunnel.

The disk-backed test adapter exercises the same cache API and warning callback; it is not a physical iPhone airplane-mode test. Native GPS permissions and position/heading availability are still required. Map tiles are not bundled offline. Expo Go limits background location and notification functionality; it is a UI preview rather than a substitute for validating background driving behavior in the native app.

Only the feature/r2-offline-release worktree was changed. No acquisition pipeline, source registry, storage migration or main changes. No store submission and no new production upload. The existing IPA/AAB in builds.json were built before these UI edits; the updated interface is available in the running Expo Go preview and in the committed source.
