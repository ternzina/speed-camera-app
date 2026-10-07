# CamAlert reference UI — 2026-10-08

Branch: feature/product-ui-reference, based on 1a7d285f. This is a UI candidate; app/iOS/Android versions, EAS configuration and existing submitted binaries are unchanged. No store upload or rollout is performed for this task.

The supplied visual reference informs typography, white cards, blue actions and five bottom tabs. Existing React Native architecture remains: App state, delivery/cache modules and warning engine retain their responsibilities.

## Changes

- Trip: consistent blue/white presentation; large speed and smaller ring during warnings; meaningful readiness status and actual dataset count/date. Warning card has a camera halo, large distance and conditional overspeed treatment. Dataset summary is hidden during warnings so Stop/Report remain visible.
- Map: existing iOS native map and Android bundled Leaflet adapter retained. Current position, local camera markers/clusters, locate/nearby/report controls and nearest-camera card remain. A warning banner uses the same forward-camera decision as Trip. Short distances display metres. Map height is measured against the viewport and header so the bottom card remains visible above navigation.
- Countries: localized name search; All/Downloaded/Popular filters (popular core: UA/PL/DE/FR/US/CA); downloaded items first; white cards, cloud download icons and multiple-download checkboxes. Existing coverage and geography filtering are reused. Country detail sheet shows actual publication count, known size and cached publication date, with the original download/update callback. No invented progress, file sizes or dates. Offline explanatory note makes clear that local camera alerts work without internet, while base map tiles require internet.
- History: direct navigation tab; Today/7 days/30 days filtering of the existing persisted warning events, excluding malformed/future dates; actual warning count and downloaded-country count. No fabricated mileage or visited-country metrics. The existing history schema/storage and recording behavior are unchanged.
- Settings: grouped white rows and consistent icons; all existing language/voice/vibration/distance/background/update/about actions retained. Removed the long duplicate coverage inventory from Settings; coverage is available through Countries. OpenStreetMap attribution remains.
- Report: existing four-type action sheet and submission workflow preserved in the shared palette.
- New presentation copy is localized in Russian/Ukrainian/English/Polish. Native back handling on country details and tab accessibility states added.

## Preserved and verified

No changes to camera-data.js, camera-delivery.js, driver-engine.js, poland-engine.js, countries.js, R2/Supabase data, collection pipelines, source registry, storage migrations or EAS configuration.

- test:mobile: existing country/cache/report routing checks pass.
- test:driver: heading/geometry, time-based distances, voice suppression, overspeed and average-speed checks pass.
- test:product and reference-presentation test: map clustering, immutable data, localized search/downloaded/popular filters and bounded history pass.
- test:delivery: current manifest and UA/PL/DE/FR/US/CA download/checksum; manifest-only update checks; Supabase/local/bundled fallbacks; failed writes and corruption isolation pass.
- test:offline-warning: six countries read from disk after restart, foreground GPS callback/speech and background warning, zero network requests. This is automated verification, not a physical-device airplane-mode claim.
- test:android-map: existing embedded map bridge and assets pass.
- Expo Hermes export for both platforms passes; this is not a new EAS/native build.
- iPhone 17 Pro / iOS 26.5 simulator: native screenshots of Trip, Countries, downloaded filter, details, Map, camera warning, History, Settings and Report. Simulator route at 21.6667 m/s toward the real camera at 50.479648646,30.45352909 produced 78 km/h, limit 50 and decreasing forward distance. No production warning fixture or debug route was introduced. Route stopped/cleared after capture.

## Screenshots

Ignored local artifacts in build/reference-ui/: overview.jpg, index.html, trip.png, countries.png, country-detail.png, downloaded.png, warning.png, map.png, history.png, settings.png, report.png. Gallery uses the actual native screenshots. History rows are simulator test trips. Blue floating gear is Expo Go developer UI, not part of CamAlert production UI.

Physical Android rendering and real-phone airplane-mode acceptance remain device checks. This task does not add auto-update toggles, unsupported lane-control data, offline base-map downloads, navigation routes or new subscriptions merely because they appear in the visual reference.

## Files

App.js; product-ui.js; reference-presentation.js; mobile-tests/reference-presentation.cjs; mobile-tests/offline-warning-verification.json; this report. No new dependencies.
