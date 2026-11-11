import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../../App.js", import.meta.url), "utf8");
const bridge = readFileSync(new URL("../../carplay-alert.js", import.meta.url), "utf8");
const scene = readFileSync(new URL("../../ios/CamAlert/CarPlaySceneDelegate.mm", import.meta.url), "utf8");

test("CarPlay shows the existing warning and does not speak a second time", () => {
  assert.match(app, /import \{ showCarPlayAlert \} from "\.\/carplay-alert"/);
  assert.match(app, /showCarPlayAlert\(message\.title, message\.body\)/);
  assert.match(app, /showCarPlayAlert\(shown\.title, shown\.body\)/);
  assert.match(app, /if \(phrase\) showCarPlayAlert\(phrase, ""\)/);
  assert.doesNotMatch(bridge, /Speech|expo-speech|expo-audio|speakCameraAlert/);
  assert.doesNotMatch(scene, /speakCameraAlert|AVSpeechSynthesizer/);
  assert.match(scene, /enableNavigationWithSession/);
  assert.match(scene, /startNavigationSessionForTrip/);
  assert.doesNotMatch(scene, /guidanceActive = NO/);
  assert.doesNotMatch(scene, /clearDestinations/);
});

test("the Google voice fix stays on the phone screen", () => {
  const screen = readFileSync(new URL("../../google-nav-test-screen.js", import.meta.url), "utf8");
  assert.match(screen, /googleAudioMode\(\{ cameraSpeaking: cameraSpeakingRef\.current, guiding, voiceEnabled \}\)/);
  assert.doesNotMatch(app, /territorial-resolver/);
});
