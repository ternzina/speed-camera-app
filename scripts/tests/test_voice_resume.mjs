import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { locationPermissionDisruption, prepareNavigatorForGuidance, resumeAfterAuthorization } from "../../voice-resume.js";

const app = readFileSync(new URL("../../App.js", import.meta.url), "utf8");
const nav = readFileSync(new URL("../../google-nav-test-screen.js", import.meta.url), "utf8");
const delegate = readFileSync(new URL("../../ios/CamAlert/AppDelegate.swift", import.meta.url), "utf8");
const speech = readFileSync(new URL("../../node_modules/expo-speech/ios/SpeechModule.swift", import.meta.url), "utf8");

test("returning from Settings refreshes services without speaking or adding a GPS watch", () => {
  const installed = resumeAfterAuthorization({
    previousAccess: "missing",
    nextAccess: "always",
    foregroundWatchActive: false,
    guiding: false,
  });
  assert.deepEqual(installed, {
    replaceForegroundWatch: false,
    restartRoadSnappedLocation: false,
    speak: false,
  });

  const trip = resumeAfterAuthorization({
    previousAccess: "when-in-use",
    nextAccess: "always",
    foregroundWatchActive: true,
    guiding: true,
  });
  assert.equal(trip.replaceForegroundWatch, true);
  assert.equal(trip.restartRoadSnappedLocation, true);
  assert.equal(trip.speak, false);

  const unchanged = resumeAfterAuthorization({
    previousAccess: "always",
    nextAccess: "always",
    foregroundWatchActive: true,
    guiding: true,
  });
  assert.equal(unchanged.replaceForegroundWatch, false);
  assert.equal(unchanged.restartRoadSnappedLocation, false);
  assert.equal(unchanged.speak, false);
});

test("a navigator is replaced only after audio or location disruption, and not during guidance", () => {
  assert.deepEqual(prepareNavigatorForGuidance({
    disruption: false, guiding: false, navigatorReady: true, cleanNavigator: true,
  }), { replace: false, discardFreshSession: false });
  assert.deepEqual(prepareNavigatorForGuidance({
    disruption: true, guiding: true, navigatorReady: true, cleanNavigator: true,
  }), { replace: false, discardFreshSession: false });
  assert.deepEqual(prepareNavigatorForGuidance({
    disruption: true, guiding: false, navigatorReady: true, cleanNavigator: true,
  }), { replace: true, discardFreshSession: false });
  assert.deepEqual(prepareNavigatorForGuidance({
    disruption: true, guiding: false, navigatorReady: false, cleanNavigator: false,
  }), { replace: true, discardFreshSession: true });

  assert.equal(locationPermissionDisruption({ previous: null, next: "always", navigatorReady: false }), false);
  assert.equal(locationPermissionDisruption({ previous: "always", next: "always" }), false);
  assert.equal(locationPermissionDisruption({ previous: "when-in-use", next: "always" }), true);
  assert.equal(locationPermissionDisruption({ previous: "missing", next: "always", navigatorReady: false }), false);
  assert.equal(locationPermissionDisruption({ previous: "missing", next: "when-in-use", navigatorReady: true }), true);
  assert.equal(locationPermissionDisruption({ previous: null, next: "when-in-use", navigatorReady: true }), true);

  const start = nav.slice(nav.indexOf("function startGuidance()"), nav.indexOf("async function endRoute()"));
  const renewAt = start.indexOf("renewNavigatorIfDisrupted");
  const voiceAt = start.indexOf('"before-start"');
  const goAt = start.indexOf("controllerRef.current.startGuidance()");
  assert.ok(renewAt >= 0 && voiceAt > renewAt && goAt > voiceAt);
  assert.match(nav, /await releaseNavigator\(\)/);
  assert.match(nav, /await ensureSession\(\)/);
  const renew = nav.slice(nav.indexOf("async function renewNavigatorIfDisrupted"), nav.indexOf("async function run"));
  const releaseAt = renew.indexOf("await releaseNavigator()");
  const sessionAt = renew.indexOf("await ensureSession()");
  assert.ok(releaseAt >= 0 && sessionAt > releaseAt);
  assert.equal(nav.includes("AppState.addEventListener"), false);
});

test("resume uses the existing watch and the existing guidance session", () => {
  const active = app.slice(app.indexOf("onAppActiveRef.current = async"), app.indexOf("useEffect(() => {\n    if (tab !== \"nearby\""));
  assert.match(active, /resumeAfterAuthorization/);
  assert.match(active, /replaceOnly:\s*true/);
  assert.doesNotMatch(active, /Speech\.speak|speakCameraAlert|speakAndWait/);
  const tracking = app.slice(app.indexOf("async function startTracking"), app.indexOf("function stopTracking"));
  assert.equal(tracking.split("watchPositionAsync").length - 1, 1);
  assert.match(tracking, /replaceOnly/);
  assert.match(tracking, /if \(sub\.current\) sub\.current\.remove\(\)/);

  const go = nav.slice(nav.indexOf("function startGuidance"), nav.indexOf("async function endRoute"));
  const voiceAt = go.indexOf('"before-start"');
  const guidanceAt = go.indexOf("controllerRef.current.startGuidance()");
  assert.ok(voiceAt >= 0 && guidanceAt > voiceAt);
  const resume = nav.slice(nav.indexOf("const plan = resumeAfterAuthorization"), nav.indexOf("function measureProbe"));
  assert.match(resume, /stopUpdatingLocation/);
  assert.match(resume, /startUpdatingLocation/);
  assert.doesNotMatch(resume, /stopGuidance|startGuidance|setAudioGuidanceType|Speech\.speak|speakCameraAlert/);
});

test("audio and the speech synthesizer are rebuilt on become-active, not only on a cold start", () => {
  const start = delegate.indexOf("func applicationDidBecomeActive");
  const become = delegate.slice(start, delegate.indexOf("\n  //", start + 1));
  assert.ok(start >= 0);
  assert.match(become, /setActive\(true\)/);
  assert.doesNotMatch(become, /speak|AVSpeechSynthesizer|setCategory/);
  const observer = speech.slice(speech.indexOf("CamAlertSpeechResume"), speech.indexOf("Events("));
  assert.match(observer, /didBecomeActiveNotification/);
  assert.match(observer, /replaceSynthesizerForResume/);
  assert.doesNotMatch(observer, /\.speak\(/);
  const reset = speech.slice(speech.indexOf("func replaceSynthesizerForResume"), speech.indexOf("func didStart"));
  assert.match(reset, /AVSpeechSynthesizer\(\)/);
  assert.match(reset, /stopSpeaking/);
  assert.doesNotMatch(reset, /\.speak\(/);
});
