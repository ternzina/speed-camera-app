# TestFlight 1.0.0 (14) — 2026-10-07

Latest UI and Driver Mode source: `11ebaa6b1a155a1cc73c175225274dd733e7dbab`, branch `feature/r2-offline-release`. Main and camera collection/data migrations were not modified. User authorized Apple testing upload only. No public App Store release or Android submission performed in this task.

Local Xcode archive and export succeeded after Expo iOS prebuild and CocoaPods integration. Verified the exported IPA signature, bundle `com.21wek.camera`, version `1.0.0`, build `14`, and embedded production Hermes bundle. App configuration already reserved build 14; Apple UI confirmed latest uploaded build 13 before upload. Android versionCode remains 6 in source, with no new Android binary.

Artifact: `build/ios-testflight-14/CamAlert.ipa`.
SHA-256: `1435f38772498a634499f687d6ac50130fda5a4fe2e40a7ca9fd54303f8b20c4`.
Local Xcode builds have no EAS Build ID.

EAS Submit ID: `11a1f7fe-6a9e-4866-a6ae-81b432a2ec6e`.
Submission: https://expo.dev/accounts/bembi26/projects/speed-camera-prototype-direction/submissions/11a1f7fe-6a9e-4866-a6ae-81b432a2ec6e
Status FINISHED at 2026-10-07 17:31:18 UTC (20:31 Kyiv).
Apple UI independently shows 1.0.0 (14), Processing. Apple build ID: `d96a78c2-36f1-4709-9f50-f3e1b7099883`. Proof: `build/testflight-14-processing.jpg`. Processing completion and tester availability have not yet been verified.

Includes updated Trip, Map and Report screens, country/offline UI and local warning engine. Mobile, driver, product presentation and six-country offline-warning tests passed before archive; native simulator screens were verified. Physical-device airplane-mode acceptance remains to be performed. Check UA/PL/DE/FR/US/CA downloads, restart offline, GPS direction/voice/limits and average-speed sections. Camera datasets are saved locally; map tiles are not downloaded.

## Previous upload

# TestFlight 0.9.0 (13) — 2026-10-07

The user explicitly authorized publishing to Apple testing after the earlier no-submission instruction. Only TestFlight upload is authorized; no public App Store release or Google Play submission.

Current application source: feature/r2-offline-release, commit 22866cb0 (including geography UI commit 5648c419). App Store Connect app 6818647205, bundle com.21wek.camera. The last uploaded TestFlight build was 0.8.2 (6); local iOS build number increased from 12 to 13. Android versionCode remains 4.

Xcode archive and app-store-connect export succeeded. Exported IPA signature, bundle identifier, version/build number, encryption declaration and embedded production JavaScript verified. Artifact: build/ios-testflight-13/CamAlert.ipa. SHA-256: 89bd34587d59e1b6289b223cbc5ee113357e455c8ee93da603baa7e89ab2a34b. A local Xcode build has no EAS Build ID.

EAS Submit ID: 68316b00-f52c-4ba6-9202-e55178e4d86f.
URL: https://expo.dev/accounts/bembi26/projects/speed-camera-prototype-direction/submissions/68316b00-f52c-4ba6-9202-e55178e4d86f

The first attempt including test notes was rejected before scheduling because changelog submission requires Enterprise. Retried the verified IPA without that optional parameter. Submission accepted; final status is recorded in builds.json.

Test on device: download UA/PL/DE/FR/US/CA, restart, enable airplane mode with location enabled, confirm downloaded datasets and warning behavior. Background location and notification permissions are required; map tiles are not stored offline. Automated six-country cache and warning checks passed, but no physical-device airplane test has been performed by the agent.

Upload FINISHED at 2026-10-07 16:10 Kyiv time. Apple TestFlight UI independently shows version 0.9.0 (13) with Processing status. The CLI status list only returned linked cloud builds; direct Apple UI was used to verify this local-build upload.
