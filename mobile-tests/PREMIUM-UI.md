# Premium UI review

Branch: feature/premium-ui-redesign. Based on product UI reference commit 606b054e; this branch includes those earlier local UI changes. Main and the camera acquisition checkout are untouched.

## Implemented

Photographic landing; five persistent tabs; driver speed/limit/GPS/map view; full-screen night warning with pulse, road name, sound and report; country search, downloaded/popular groups, details/type counts, actual download bytes and verification phase; selected local dataset removal; map filters; timeline/history summaries; display units and system/light/dark themes. Existing reporting choices and forms are retained.

Local preferences and foreground trip totals use independent `camera_ui_premium_v1` and `camera_ui_trips_v1` keys. GPS traces are in-memory only. The original country cache format is unchanged. Deletion uses the existing atomic cache writer and is blocked during foreground/background driving, including a second check when the queued operation executes. R2/Supabase data are never deleted.

## Verification

Native iPhone 17 Pro / iOS 26.5 Expo Go: landing; downloaded Poland; removed Poland and retained Ukraine; downloaded Germany and France; actual byte/verification state; selected countries; map/camera clusters; filters; system/dark theme; real simulated GPS callback at 43 km/h and 78 km/h with speed-limit 50, night warning and history. No production fixture/screenshot mode was introduced.

Automated: test:mobile, test:driver, test:offline-warning, test:android-map, test:product, test:geography, test:country-quality, and `node mobile-tests/premium-ui.cjs`. Live manifest/dataset audits are read-only. Offline warning test reloads the on-disk cache with a new storage instance and disables networking: UA, PL, DE, FR, US, CA, foreground/background warning, local speech and Polish average-speed section; zero requests during driving. Transport tests cover bytes, Unicode, abort, failure/status and manifest forwarding; cache tests cover physical chunk cleanup and remaining country retention. Expo export builds the iOS and Android JS/assets bundles; this is not an EAS store build.

## Screenshots

Local originals: `build/premium-ui/{start,countries,country-detail,downloaded,trip,warning,map,history,settings}.png`. Extras: filters, download-progress, report, settings-dark. `overview.jpg` is a contact sheet of actual simulator captures, `index.html` links full-size originals. Screenshots live in ignored build output, not the source commit.

## Reference comparison and honest differences

Real counts/sizes replace illustrative reference figures. Current manifest has 122 downloadable datasets, 120 country entries, no separate US state or Canadian province datasets, and 2 separately classified territory entries; 43 countries pass the current UI coverage policy. Country catalog/thresholds are inherited, not hardcoded to 49. Missing found/candidate metrics show a dash rather than invented numbers. Average-speed UI counts sections, whereas the engine uses gates; totals are not necessarily simple type-card sums.

Both road images are new project assets. Feather glyphs and system-rendered flags replace the reference's custom pictograms/rounded flag art. Country details have bottom navigation; filters are a full-screen modal. Country rows retain multi-select controls and driving-country selection.

The blue route is the actual foreground GPS trail, not destination turn-by-turn routing. History mileage is measured foreground movement with jitter/jump/gap rejection, not a complete background odometer. Map-type filters affect presentation only, leaving warnings active; voice/vibration toggles use the existing settings. Imperial units affect display; speech/engine remain metric. Existing background GPS configuration and manual distance controls remain accessible, making Settings longer than the illustrative reference.

Offline camera datasets, direction, speed limits and warning calculation stay local. Basemap tiles still need network unless previously cached by the map provider; this UI does not claim downloadable offline road maps. A physical-phone airplane-mode acceptance test and physical Android visual review remain outstanding. No builds were submitted to App Store Connect or Google Play.

## Phone feedback fixes — 2026-10-08

- Reproduced Accessibility XXXL text size and dark appearance on iPhone 17 Pro, Expo Go.
- Compact GPS prompt (no duplicated country caption), explicit dismiss button, location action on both GPS controls. Denied access offers Settings; position acquisition stops waiting after 12 seconds and reports failure.
- Fixed-height two-line history labels align all values; shorter localized distance caption. Driving UI text scales up to 1.35, tab captions up to 1 to avoid broken navigation at extreme system sizes.
- Explicit text colours across legacy screen styles, readable secondary colours in dark mode, white text on blue buttons remains white. Regression renders cover all five main tabs.
- Introduction revision 2 shows the bundled road image once again without deleting existing settings or country cache. The night image remains reserved for urgent driving warnings.
- Native screenshots: build/ui-fixes/start-large-text.png, history-dark-large-text.png, map-dark-large-text.png. Native dismiss action verified (prompt absent from accessibility tree after tap).
- Passed app-smoke (including dark-mode screens and history alignment), map-ui (locate/centre/dismiss), premium-ui, driver-engine, android-map and offline-warning (six countries, zero network requests). Physical phone acceptance still pending.
