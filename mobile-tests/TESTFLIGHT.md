# TestFlight 0.9.0 (13) — 2026-10-07

The user explicitly authorized publishing to Apple testing after the earlier no-submission instruction. Only TestFlight upload is authorized; no public App Store release or Google Play submission.

Current application source: feature/r2-offline-release, commit 22866cb0 (including geography UI commit 5648c419). App Store Connect app 6818647205, bundle com.21wek.camera. The last uploaded TestFlight build was 0.8.2 (6); local iOS build number increased from 12 to 13. Android versionCode remains 4.

Xcode archive and app-store-connect export succeeded. Exported IPA signature, bundle identifier, version/build number, encryption declaration and embedded production JavaScript verified. Artifact: build/ios-testflight-13/CamAlert.ipa. SHA-256: 89bd34587d59e1b6289b223cbc5ee113357e455c8ee93da603baa7e89ab2a34b. A local Xcode build has no EAS Build ID.

EAS Submit ID: 68316b00-f52c-4ba6-9202-e55178e4d86f.
URL: https://expo.dev/accounts/bembi26/projects/speed-camera-prototype-direction/submissions/68316b00-f52c-4ba6-9202-e55178e4d86f

The first attempt including test notes was rejected before scheduling because changelog submission requires Enterprise. Retried the verified IPA without that optional parameter. Submission accepted; final status is recorded in builds.json.

Test on device: download UA/PL/DE/FR/US/CA, restart, enable airplane mode with location enabled, confirm downloaded datasets and warning behavior. Background location and notification permissions are required; map tiles are not stored offline. Automated six-country cache and warning checks passed, but no physical-device airplane test has been performed by the agent.

Upload FINISHED at 2026-10-07 16:10 Kyiv time. Apple TestFlight UI independently shows version 0.9.0 (13) with Processing status. The CLI status list only returned linked cloud builds; direct Apple UI was used to verify this local-build upload.
