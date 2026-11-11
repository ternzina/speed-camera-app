import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  UK_CLIP_IDS,
  UK_CLIP_AUDIO_MODE,
  UK_CLIP_RELEASE_MODE,
  audibleSteps,
  createClipGate,
  ukrainianClipPlan,
  ukrainianPlanFromPhrase,
} from "../../uk-voice-clips.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ids = (plan) => (plan?.steps || []).map((step) => step.id);

test("a camera closer than 100 m is Камера поруч and never сто метрів", () => {
  for (const distance of [0, 1, 40, 99.4]) {
    const plan = ukrainianClipPlan({ kind: "ua-camera", distance, limit: 50, over: false });
    assert.equal(ids(plan).includes("close"), true);
    assert.equal(ids(plan).includes("dist-0100"), false);
    assert.equal(ids(plan).includes("limit-50"), true);
  }
  const poland = ukrainianClipPlan({ kind: "pl-camera", distance: 80, limit: null });
  assert.deepEqual(ids(poland), ["close"]);
});

test("distances from 100 m to 1500 m keep the 100 m step and the right case clip", () => {
  assert.deepEqual(ids(ukrainianClipPlan({ kind: "ua-camera", distance: 100, limit: 50, over: false })), [
    "lead-kamera-cherez", "dist-0100", "limit-50",
  ]);
  assert.deepEqual(ids(ukrainianClipPlan({ kind: "ua-camera", distance: 149, limit: 70, over: true })), [
    "lead-kamera-cherez", "dist-0100", "slow-70",
  ]);
  assert.deepEqual(ids(ukrainianClipPlan({ kind: "ua-camera", distance: 150, limit: 90, over: false })), [
    "lead-kamera-cherez", "dist-0200", "limit-90",
  ]);
  assert.deepEqual(ids(ukrainianClipPlan({ kind: "ua-camera", distance: 1540, limit: 110, over: true })), [
    "lead-kamera-cherez", "dist-1500", "slow-110",
  ]);
  const joins = ukrainianClipPlan({ kind: "pl-camera", distance: 250, limit: 50 }).steps.map((step) => step.join);
  assert.deepEqual(joins, ["none", "crossfade", "pause"]);
});

test("an unknown or unrecorded limit adds no number and no bare Обмеження", () => {
  assert.deepEqual(ids(ukrainianClipPlan({ kind: "ua-camera", distance: 400, limit: null })), [
    "lead-kamera-cherez", "dist-0400", "ahead",
  ]);
  assert.deepEqual(ids(ukrainianClipPlan({ kind: "ua-camera", distance: 400, limit: 80, over: true })), [
    "lead-kamera-cherez", "dist-0400",
  ]);
  assert.equal(ukrainianClipPlan({ kind: "section-over", limit: null, averageKmh: 90 }), null);
  assert.deepEqual(ids(ukrainianClipPlan({ kind: "section-over", limit: 80, averageKmh: 100 })), ["average-over"]);
  assert.deepEqual(ids(ukrainianClipPlan({ kind: "section-over", limit: 50, averageKmh: 70 })), ["average-over", "limit-50"]);
  assert.deepEqual(ids(ukrainianClipPlan({ kind: "section-approaching", distance: 40, limit: null })), ["close"]);
  assert.deepEqual(ids(ukrainianClipPlan({ kind: "section-ending" })), ["section-end"]);
});

test("a missing clip is skipped and a stale ticket does not stay current", () => {
  const plan = ukrainianClipPlan({ kind: "ua-camera", distance: 400, limit: 50, over: false });
  const available = new Set(UK_CLIP_IDS.filter((id) => id !== "limit-50" && id !== "lead-kamera-cherez"));
  assert.deepEqual(audibleSteps(plan, available).map((step) => step.id), ["dist-0400"]);
  assert.equal(audibleSteps(plan, available)[0].join, "none");
  const gate = createClipGate();
  const first = gate.start();
  const second = gate.start();
  assert.equal(gate.current(first), false);
  assert.equal(gate.current(second), true);
  gate.stop();
  assert.equal(gate.current(second), false);
});

test("bundled clips are local files and playback stays audible in the background", () => {
  const assets = fs.readFileSync(path.join(root, "uk-voice-assets.js"), "utf8");
  assert.equal(assets.includes("http"), false);
  for (const id of UK_CLIP_IDS) {
    assert.equal(fs.existsSync(path.join(root, "assets/uk-voice", `${id}.mp3`)), true, id);
    assert.equal(assets.includes(`'${id}'`), true, id);
  }
  assert.equal(UK_CLIP_AUDIO_MODE.playsInSilentMode, true);
  assert.equal(UK_CLIP_AUDIO_MODE.shouldPlayInBackground, true);
  assert.equal(UK_CLIP_AUDIO_MODE.interruptionMode, "doNotMix");
  assert.equal(UK_CLIP_RELEASE_MODE.interruptionMode, "mixWithOthers");
  const player = fs.readFileSync(path.join(root, "uk-voice-player.js"), "utf8");
  const releaseAt = player.indexOf("setAudioModeAsync(UK_CLIP_RELEASE_MODE)");
  const deactivateAt = player.indexOf("setIsAudioActiveAsync(false)");
  assert.equal(releaseAt > 0 && deactivateAt > releaseAt, true);
  const plist = fs.readFileSync(path.join(root, "ios/CamAlert/Info.plist"), "utf8");
  assert.equal(plist.includes("<string>audio</string>"), true);
  assert.equal(plist.includes("<string>location</string>"), true);
});

test("Ukrainian warnings use clips, other languages and the Google voice stay as they were", () => {
  const app = fs.readFileSync(path.join(root, "App.js"), "utf8");
  assert.equal(app.includes('ukrainianClipPlan({ kind: "ua-camera"'), true);
  assert.equal(app.includes('kind: "pl-camera"'), true);
  assert.equal(app.includes("Speech.queueUkrainianClip(plan)"), true);
  assert.equal(app.includes("speakCameraAlert(message.speech, message.locale)"), true);
  assert.equal(app.includes('language:\n                      "ru-RU"') || app.includes('"ru-RU"'), true);
  const navigation = fs.readFileSync(path.join(root, "google-navigation-screen.js"), "utf8");
  assert.equal(navigation.includes("AudioGuidance.VOICE_ALERTS_AND_GUIDANCE"), true);
  assert.equal(navigation.includes("AudioGuidance.SILENT"), true);
  assert.equal(navigation.includes("!cameraSpeaking"), true);
  const parsed = ukrainianPlanFromPhrase("Камера через 40 метрів. Знизьте швидкість до 50 кілометрів на годину.");
  assert.deepEqual(ids(parsed), ["close", "slow-50"]);
  const poland = ukrainianPlanFromPhrase("Камера попереду через 300 метрів.");
  assert.deepEqual(ids(poland), ["lead-poperedu-cherez", "dist-0300"]);
});
