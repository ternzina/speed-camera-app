# Google Play internal testing — 2026-10-07

The user authorized Android testing alongside TestFlight. Apple processing does not gate an Android upload.

App 0.9.0, package com.camera21wek. Existing local/EAS Android versionCode 4 increased to 5 for the current geography/offline UI. iOS build number remains 13. EAS production Android build ID 59e7668f-0062-45a8-a28f-a08fd85a5d8f, source commit fdeaec4b. Current build state and artifact are recorded in builds.json.

Submission profile explicitly targets Google Play internal testing. No public production release is configured or performed.

Publication currently blocked: the signed-in Google account ternzina@gmail.com only exposes developer account HerLight (8497998036565797248), containing com.herlight.app. CamAlert is absent and Create app is disabled with “Permission required”. EAS Android credentials also report no Google Play submission service-account key. Do not repurpose the HerLight application or its package.

Need the intended developer account with access to an existing CamAlert record, or its owner to create the app and provide the needed access. Manual AAB upload is possible once the app and access exist; a service-account key is required only for CLI submission.
