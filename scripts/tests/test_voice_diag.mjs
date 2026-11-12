import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ukrainianClipPlan } from "../../uk-voice-clips.js";
import { approachDelayMs, AUTO_ORDER, cameraVoiceCheckPlan, failureCode, googleOnlyRequest, restoreRequest, routeSimulationRequest, yevheniiaOnlyPlan } from "../../voice-diag-checks.js";
import { setNavVoiceSink, traceNavVoice } from "../../nav-voice-trace.js";

const read = (name) => readFileSync(new URL(`../../${name}`, import.meta.url), "utf8");

test("simulation waits for guidance and the three sound checks stay separate", () => {
  assert.deepEqual(routeSimulationRequest(false), { start: false, reason: "waiting" });
  assert.deepEqual(routeSimulationRequest(true), { start: true, speedMultiplier: 1 });
  assert.equal(googleOnlyRequest().playClip, false);
  assert.equal(googleOnlyRequest().index, 4);
  assert.equal(yevheniiaOnlyPlan().changeVoice, false);
  assert.equal(yevheniiaOnlyPlan().steps[0].id, "close");
  assert.deepEqual(cameraVoiceCheckPlan(), ukrainianClipPlan({ kind: "ua-camera", distance: 500, limit: 50, over: false }));
  assert.deepEqual(restoreRequest(), { silentIndex: 0, voiceIndex: 4, clip: "close" });

  const panel = read("voice-diag-panel.js");
  assert.match(panel, /Проверить голос камеры/);
  assert.match(panel, /onCheckCameraVoice[\s\S]*speakCameraAlert\(/);
  assert.doesNotMatch(panel.slice(panel.indexOf("async function onCheckCameraVoice"), panel.indexOf("async function onApproach")), /simulateLocations|requestVoice\(/);
  const approach = panel.slice(panel.indexOf("async function onApproach"), panel.indexOf("async function onRestore"));
  assert.match(approach, /onStartApproach/);
  assert.doesNotMatch(approach, /speakCameraAlert|playClipPlan/);
  assert.equal(approachDelayMs({ screen: false, firstTurnAt: 1000, now: 9000 }), null);
  assert.equal(approachDelayMs({ screen: true, firstTurnAt: 0, now: 9000 }), null);
  assert.equal(approachDelayMs({ screen: true, firstTurnAt: 1000, now: 3000 }), 4000);
  assert.equal(approachDelayMs({ screen: true, firstTurnAt: 1000, now: 9000 }), 0);
  assert.match(panel, /onSimulate[\s\S]*simulateLocationsAlongExistingRoute/);
  assert.match(panel, /onGoogleOnly[\s\S]*requestVoice\(request\.index/);
  assert.doesNotMatch(panel.slice(panel.indexOf("async function onGoogleOnly"), panel.indexOf("async function onYevheniia")), /playClipPlan/);
  assert.doesNotMatch(panel.slice(panel.indexOf("async function onYevheniia"), panel.indexOf("async function onRestore")), /requestVoice/);
  assert.match(panel.slice(panel.indexOf("async function onRestore"), panel.indexOf("const location")), /playClipPlan/);
  for (const effect of panel.matchAll(/useEffect\(\(\) => \{[\s\S]*?\n  \}, \[\]\);/g)) {
    assert.doesNotMatch(effect[0], /simulateLocationsAlongExistingRoute|playClipPlan|requestVoice\(/);
  }
});

test("the diagnostic screen is gated and does not join the store navigator", () => {
  const screen = read("google-nav-test-screen.js");
  const app = read("App.js");
  const gate = read("voice-diag-gate.js");
  assert.match(gate, /com\.21wek\.camera\.voicediag/);
  assert.doesNotMatch(read("google-nav-gate.js"), /voicediag/);
  assert.match(screen, /if \(!props\.diagnostic\) return body/);
  assert.match(screen, /<VoiceDiagPanel/);
  assert.doesNotMatch(screen, /simulateLocations|GMSLocationSimulator/);
  assert.match(app, /if \(isVoiceDiagApp\(\)\)/);
  const store = app.slice(app.indexOf('if (usesInAppGoogleNav() && (tab === "drive"'));
  assert.doesNotMatch(store.slice(0, 900), /\bdiagnostic\b/);
  for (const name of ["App.js", "google-nav-test-screen.js", "voice-diag-panel.js", "voice-diag-log.js", "voice-diag-gate.js"]) {
    assert.doesNotMatch(read(name), /territorial-resolver/);
  }
});

test("the automatic run builds a route before guidance and does not log coordinates", () => {
  const auto = read("voice-diag-auto.js");
  const screen = read("google-nav-test-screen.js");
  const markers = [
    "simulateLocation",
    "controller.setDestination(",
    'requestVoice(4, "before-start")',
    "controller.startGuidance()",
    "simulateLocationsAlongExistingRoute",
    "camera.audible",
    "await rollApproach(",
  ];
  assert.equal(markers.length, AUTO_ORDER.length);
  assert.match(auto, /const CAMERA_SIM_SPEED = 1/);
  assert.doesNotMatch(auto, /speakCameraAlert\(/);
  assert.match(auto, /onNavigationFix\?\.\(sample\.fix\)/);
  assert.match(auto, /getCurrentTimeAndDistance/);
  assert.match(auto, /setTurnByTurnLoggingEnabled/);
  assert.match(screen, /navigationSample\(/);
  assert.match(screen, /onNavigationFixRef/);
  assert.match(read("App.js"), /onNavigationFix=\{handleUkraineFix\}/);
  assert.doesNotMatch(auto, /traceNavVoice\([\s\S]{0,120}latitude/);
  let cursor = 0;
  for (const marker of markers) {
    const at = auto.indexOf(marker);
    assert.ok(at > cursor, marker);
    cursor = at;
  }
  assert.match(screen, /if \(!diagnostic \|\| autoStarted\.current\) return undefined/);
  assert.doesNotMatch(screen, /simulateLocations/);
  assert.equal(failureCode({ message: "50.4501,30.5234" }), "failed");
  assert.equal(failureCode({ code: "LOCATION_UNKNOWN" }), "LOCATION_UNKNOWN");
  assert.doesNotMatch(auto, /territorial-resolver/);
});

test("the journal drops coordinates and the key", () => {
  const seen = [];
  setNavVoiceSink(line => seen.push(line));
  traceNavVoice("voice.request", { guidance: "AlertsAndGuidance", latitude: 1, key: "secret", reason: "google-only" });
  assert.equal(seen.length, 1);
  assert.match(seen[0], /AlertsAndGuidance/);
  assert.doesNotMatch(seen[0], /latitude|secret/);
  setNavVoiceSink(null);
});
