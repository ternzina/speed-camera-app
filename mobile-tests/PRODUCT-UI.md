# CamAlert three-screen UI update — 2026-10-07

Branch feature/r2-offline-release. UI candidate remains version 1.0.0, iOS 14, Android 6; no binary build or store submission was performed for this UI-only task.

## Result

Trip: a soft speed ring; one readiness/clear-road card; honest GPS waiting/available/active state, voice status and actual locally saved dataset status. A small dataset card shows usable records and actual publication date, never sample numbers or invented dates. Start/Stop and an explicit Report button remain reachable; approaching-camera/section views use a smaller ring. Header includes country and settings. Existing warning and average-speed behavior remains intact.

Map: large native map with current location, all valid local cameras within its viewport, coherent icons for speed/red-light/mobile/average controls, presentation-only spatial clusters, zoom on a cluster, My location and Nearby cameras controls, Report button and nearest-camera card. A missing location invites explicit location permission rather than requiring a drive to start. Nearby fits the current position and closest camera together. Corrected the map size using StyleSheet.absoluteFill supported by the current React Native version. Map tiles remain online; camera markers come from the same offline dataset. Google/Apple native provider configuration was not changed. iOS map and markers are verified; Android native provider credentials and device rendering still require installed-build acceptance testing.

Report: compact action sheet titled “Что вы заметили?” with four choices and one Feather icon family. The selected type is passed to the existing report form/API. Average-speed reporting selects the supported average_speed_start point type; it does not fabricate a complete section without an end point. Cancel stays in the sheet. Existing missing-camera reporting is retained.

Navigation: Поездка / Карта / Страны / Настройки; consistent active state and icons. No subscription, paywall, advertising, registration or extra tab.

## Verification

- test:mobile: eleven country renders and cache regression pass; all four report choices open the form with their correct canonical type; readiness text appears once and Countries navigation is present.
- test:driver: existing warning/direction/voice/average-speed engine tests pass without modifying the engine.
- test:product: viewport clustering, zoom separation, original dataset immutability, localized copy and honest unknown dates pass.
- test:offline-warning: UA/PL/DE/FR/US/CA from freshly read disk cache; actual foreground GPS/speech callback and background local notifications; zero network requests. Cached Polish section calculation/end reset passes.
- Expo production JavaScript/Hermes export passes for both iOS and Android, including Feather font assets.
- iPhone 17 Pro simulator: all three screens visually inspected; actual My location, Nearby cameras and cluster actions exercised. Saved screenshots: build/product-trip.jpg, build/product-map.jpg, build/product-report.jpg. The floating blue gear in Expo Go preview belongs to Expo Go development tools, not CamAlert; it is absent from a standalone production app.

No driver-engine.js, camera-data.js, camera-delivery.js, country registry, collection pipeline, source registry, storage migration or backend data were changed. Physical phone airplane-mode and installed Android UI remain acceptance checks; exported JavaScript is not a native production-build claim.

## Changed files

- App.js — screen layout, unified navigation, status/dataset cards, map presentation wiring and report choices.
- product-ui.js — shared Feather icons and native camera map component.
- product-presentation.js — localized UI copy, date presentation and pure viewport grouping.
- package.json / package-lock.json — Expo-compatible @expo/vector-icons and product test command.
- mobile-tests/app-smoke.cjs — UI component adapter and report routing/status regression assertions.
- mobile-tests/offline-warning.cjs — UI-only component adapter for the existing real GPS/background offline test.
- mobile-tests/offline-warning-verification.json — refreshed test evidence.
- mobile-tests/product-presentation.cjs — functional local map grouping tests.
- mobile-tests/PRODUCT-UI.md — this report.
