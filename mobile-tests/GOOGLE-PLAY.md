# Google Play internal testing — 2026-10-07

The user authorized Android testing alongside TestFlight. Apple processing does not gate an Android upload.

App 0.9.0, package com.camera21wek. Existing local/EAS Android versionCode 4 increased to 5 for the current geography/offline UI. iOS build number remains 13. EAS production Android build ID 59e7668f-0062-45a8-a28f-a08fd85a5d8f, source commit fdeaec4b. Current build state and artifact are recorded in builds.json.

Submission profile explicitly targets Google Play internal testing. No public production release is configured or performed.

The initial ordinary Chrome session only exposed HerLight, leading to an incorrect assumption that CamAlert was absent. The user screenshot showed the existing app. The correct Dolphin/Anty profile was located and confirms full access to CamAlert (console app 4973206564233406869). Its v0.8.2 (3) is already available in internal and closed testing. No new app or package is needed. EAS has no Google Play service-account key, so publication can use the authenticated native browser instead.

An internal-testing update draft was saved with name “5 (0.9.0) — offline countries” and English release notes describing multi-country offline downloads, localization, coverage filtering and dataset updates. Draft release 2, track 4701629391442996966. No AAB or rollout yet; waiting for EAS build 5.
