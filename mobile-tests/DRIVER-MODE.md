# Driver Mode 1.0 — 2026-10-07

Source candidate: app 1.0.0, iOS build 14, Android versionCode 6. Previous values were 0.9.0 / 13 / 5. Worktree: /Users/zina/Downloads/speed-camera-r2-offline-release; branch feature/r2-offline-release. No subscription, paywall, purchases or trial added.

## Product changes

Driver screen shows large current GPS speed, camera/section limit when known, protection status, clear-road state and an approaching camera card. Normal alerts have three distance stages; speeding adds a stronger red presentation. Coordinates, headings, camera IDs and delivery sources are absent from this screen. The + menu offers speed camera, mobile control and red-light camera; the existing missing-camera report remains available for the current alert. Map, nearby-camera list, warning history, background notification control and existing reporting API are retained.

The shared on-device engine normalizes speed_camera, red_light_camera, average_speed_start, average_speed_end and mobile_control; legacy unknown records default to speed_camera. Example records and unusable coordinates are rejected without changing exported datasets or cached raw records.

First voice warning targets 22 seconds, clamped to 150–1500 metres; second targets 8 seconds, clamped to 60–500 metres. The original manual speed-band distances remain configurable. A per-camera recent history prevents repeated speech, including when two nearby camera IDs alternate. A speeding transition is voiced once. Russian, Ukrainian, English and Polish voice locales are supported; native OS speech is retained.

Direction filtering checks vehicle bearing, known camera direction, forward angle and lateral corridor. Unknown camera direction uses a tighter corridor. The foreground handler derives bearing from movement if GPS bearing is unavailable. Poor GPS accuracy suppresses direction alerts/section tracking. No online routing is needed.

Average-speed tracking begins at the start gate, not the approach warning. It accumulates the trip's actual GPS distance and elapsed time, including stops, shows average and known limit, and resets at the end gate or on an implausible jump/long GPS gap/reversal. Average-speed overspeed is voiced once. Remaining distance is explicitly approximate: endpoint distance, because the local datasets have endpoints rather than full road polylines.

## Offline countries

A dedicated screen uses localized names/flags, alphabetical names, downloaded countries first, usable record count, manifest byte size, dataset publication date and Download/Update actions. A section counts as one usable record although driving uses two gates. Poland counts physical red-light sites after the existing delivery projection; this can be lower than source device count. Weak countries are hidden below 300 records; previously supported core countries and saved downloads remain available. Backend data are never deleted.

The verified live manifest contains 120 countries, 0 separate state/province/region datasets and 1 separately grouped geography (Taiwan), 121 downloadable datasets total. The main available-country catalog contains 43 countries; 77 weak countries are hidden. USA and Canada remain single country datasets. Full country-quality-audit.json verifies every dataset checksum and counts its usable records.

Core usable records at audit time: Ukraine 426, Poland 796, Germany 5794, France 6239, USA 3509, Canada 1343. Counts are data-dependent and will change as collection continues.

Saved offline means the country dataset has been successfully committed to device AsyncStorage in checksum-verified chunks. Driving does not depend on R2/Supabase requests. Existing R2 → Supabase → local cache → bundled fallback is preserved. Internet is used for downloads/updates and live map tiles; no offline map tile package is implemented or claimed.

## Verification

- test:driver: forward/opposing/behind/parallel geometry, time clamps, two voice stages, speeding transitions, alternating IDs, legacy types, actual section odometer, stopped time, gate start/end and poor-GPS reset.
- test:mobile: 11 country renders, localized/filtered country UI and independent country choice/batch selection; bounded cache for 16000 records, restart retention and legacy cache compatibility.
- test:delivery: unchanged download/checksum/update/fallback and failed-save behavior passed.
- test:geography: country/region/territory classification and available/downloaded list behavior passed.
- test:country-quality: all 121 current R2 datasets downloaded read-only, checksums validated; zero failed datasets.
- test:offline-warning: six datasets saved to disk, read with a fresh storage instance, all fetch calls blocked. Actual App foreground GPS callback invokes native speech once despite repeated GPS updates; actual background task emits a local notification. UA/PL/DE/FR/US/CA each make zero network requests. A cached Polish section computes average across its full simulated trip and resets at the end gate.
- Expo production JavaScript/Hermes export succeeds for iOS and Android.
- iPhone 17 Pro simulator: actual 78 km/h test route displays speeding/camera distance and later clear-road status. Offline country cards and + menu inspected; screenshots under build/driver-*.png.

Physical iPhone/Android airplane-mode, installed offline OS voices and locked-screen behavior still need device acceptance testing. Very close parallel roads or opposite carriageways without direction/road geometry cannot be distinguished reliably by GPS alone. The filter is conservative but is not a road-map matcher.

No store upload was performed for this 1.0.0 source candidate. Previous EAS Android 0.9.0 (5) build 59e7668f-0062-45a8-a28f-a08fd85a5d8f has finished; it predates Driver Mode and must not be described as a 1.0.0 build. Existing TestFlight 0.9.0 (13) also predates this work. Build IDs/artifact provenance remain in builds.json.
