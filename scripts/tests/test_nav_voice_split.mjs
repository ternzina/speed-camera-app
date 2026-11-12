import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createSpeechCoordinator } from "../../camera-speech-coordinator.js";
import { googleAudioMode, voiceModeBeforeGuidance } from "../../google-nav-banner.js";
import { nativeVoiceGuidance, voiceGuidanceChange } from "../../nav-voice-trace.js";
import { audibleSteps } from "../../uk-voice-clips.js";

const root = new URL("../../", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");
const VOICE = 4;
const SILENT = 0;

test("Google voice without a camera assigns AlertsAndGuidance once", () => {
  assert.equal(
    googleAudioMode({ cameraSpeaking: false, guiding: true, voiceEnabled: true }),
    "alerts-and-guidance",
  );
  assert.equal(nativeVoiceGuidance(VOICE), "AlertsAndGuidance");
  const first = voiceGuidanceChange(undefined, VOICE);
  assert.equal(first.changed, true);
  assert.equal(voiceGuidanceChange(first.next, VOICE).changed, false);

  const bridge = read("node_modules/@googlemaps/react-native-navigation-sdk/ios/react-native-navigation-sdk/NavModule.mm");
  const setter = bridge.slice(bridge.indexOf("setAudioGuidanceType"), bridge.indexOf("startGuidance:"));
  assert.match(setter, /index == 0[\s\S]*GMSNavigationVoiceGuidanceSilent/);
  assert.match(setter, /index == 1[\s\S]*GMSNavigationVoiceGuidanceAlertsOnly/);
  assert.match(setter, /setVoiceGuidance:GMSNavigationVoiceGuidanceAlertsAndGuidance/);
  assert.equal(bridge.match(/setVoiceGuidance:/g).length, 3);
  const start = bridge.slice(bridge.indexOf("- (void)startGuidance:"), bridge.indexOf("- (void)stopGuidance:"));
  assert.match(start, /guidanceActive = YES/);
  assert.doesNotMatch(start, /setVoiceGuidance/);

  assert.equal(
    voiceModeBeforeGuidance({ cameraSpeaking: false, voiceEnabled: true }),
    "alerts-and-guidance",
  );
  assert.equal(
    voiceModeBeforeGuidance({ cameraSpeaking: true, voiceEnabled: true }),
    "silent",
  );
  const screen = read("google-nav-test-screen.js");
  const screenStart = screen.slice(screen.indexOf("function startGuidance()"), screen.indexOf("async function endRoute()"));
  const voiceAt = screenStart.indexOf('"before-start"');
  const goAt = screenStart.indexOf("controllerRef.current.startGuidance()");
  assert.ok(voiceAt > 0 && goAt > voiceAt, "voice mode is set before guidance becomes active");
  assert.match(screen, /requestVoiceGuidance\(controllerRef\.current, AudioGuidance\.SILENT, "session"\)/);
  assert.doesNotMatch(screen, /MIN_MOVING_SPEED/);
  const app = read("App.js");
  assert.match(app, /voiceEnabled=\{cameraWarningsEnabled\(settings\) && settings\.voice\}/);
});

test("Yevheniia leaves the audio session alone when no clip plays", () => {
  assert.deepEqual(audibleSteps(null, ["close"]), []);
  assert.deepEqual(audibleSteps({ steps: [] }, ["close"]), []);
  assert.deepEqual(audibleSteps({ steps: [{ id: "close", join: "none" }] }, []), []);

  const player = read("uk-voice-player.js");
  const body = player.slice(player.indexOf("export async function playClipPlan"));
  const skip = body.indexOf('traceNavVoice("clip.skip"');
  const take = body.indexOf("setAudioModeAsync(UK_CLIP_AUDIO_MODE)");
  const release = body.indexOf('traceNavVoice("clip.release"');
  assert.ok(skip > 0 && skip < take, "a clip with no steps returns before doNotMix");
  assert.ok(release > take);
  assert.equal(player.slice(0, player.indexOf("export async function playClipPlan")).includes("setAudioModeAsync("), false);
  assert.match(read("uk-voice-clips.js"), /interruptionMode: "doNotMix"/);

  const audio = read("node_modules/expo-audio/ios/AudioModule.swift");
  const setMode = audio.slice(audio.indexOf("private func setAudioMode"));
  assert.match(setMode, /case \.doNotMix:\s*break/);
  assert.match(audio, /notifyOthersOnDeactivation/);
  const onCreate = audio.slice(audio.indexOf("OnCreate {"), audio.indexOf('AsyncFunction("setAudioModeAsync")'));
  assert.equal(onCreate.includes("setAudioMode("), false);
  assert.equal(onCreate.includes("setActive"), false);
  assert.match(audio, /interruptionMode: InterruptionMode = \.mixWithOthers/);
});

test("after Yevheniia the native value changes from Silent to AlertsAndGuidance", async () => {
  assert.equal(googleAudioMode({ cameraSpeaking: true, guiding: true, voiceEnabled: true }), "silent");
  assert.equal(googleAudioMode({ cameraSpeaking: false, guiding: true, voiceEnabled: true }), "alerts-and-guidance");
  const during = voiceGuidanceChange(undefined, SILENT);
  const after = voiceGuidanceChange(during.next, VOICE);
  assert.equal(during.guidance, "Silent");
  assert.equal(after.changed, true);
  assert.equal(after.guidance, "AlertsAndGuidance");
  assert.equal(voiceGuidanceChange("AlertsAndGuidance", VOICE).changed, false);

  const heard = [];
  const coordinator = createSpeechCoordinator({
    stop: () => Promise.resolve(),
    isSpeakingAsync: () => Promise.resolve(false),
    speak() {},
  });
  coordinator.subscribe(speaking => {
    heard.push(googleAudioMode({ cameraSpeaking: speaking, guiding: true, voiceEnabled: true }));
  });
  const session = coordinator.beginClip();
  assert.equal(heard.at(-1), "silent");
  await coordinator.stop();
  assert.equal(session.current(), false);
  assert.equal(heard.at(-1), "alerts-and-guidance");
  assert.match(read("App.js"), /function stopTracking\(\)[\s\S]*Speech\.stop\(\)/);

  const screen = read("google-nav-test-screen.js");
  assert.match(screen, /traceNavVoice\("warning\.speech"/);
  assert.match(screen, /traceNavVoice\("guidance\.start"/);
  const speech = read("camera-speech.js");
  assert.match(speech, /traceNavVoice\("warning\.begin"/);
  assert.match(speech, /traceNavVoice\("warning\.end"/);
  const app = read("App.js");
  assert.match(app, /if \(speedKmh < MIN_MOVING_SPEED_KMH \|\| heading == null\) return;/);
  assert.match(app, /if \(AppState\.currentState !== "active"\) return;/);
});
