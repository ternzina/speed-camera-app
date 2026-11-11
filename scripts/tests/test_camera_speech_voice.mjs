import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { cameraSpeechOptions, pickUkrainianVoice } from "../../camera-speech-voice.js";

const lesya = { identifier: "com.apple.voice.super-compact.uk-UA.Lesya", name: "Lesya", quality: "Default", language: "uk-UA" };
const lesyaPremium = { identifier: "com.apple.voice.premium.uk-UA.Lesya", name: "Lesya", quality: "Default", language: "uk-UA" };
const milena = { identifier: "com.apple.voice.super-compact.ru-RU.Milena", name: "Milena", quality: "Default", language: "ru-RU" };
const samantha = { identifier: "com.apple.voice.super-compact.en-US.Samantha", name: "Samantha", quality: "Default", language: "en-US" };

test("Ukrainian camera warnings use an installed uk-UA voice", () => {
  const picked = pickUkrainianVoice([samantha, milena, lesya]);
  assert.equal(picked.identifier, lesya.identifier);
  assert.deepEqual(cameraSpeechOptions("uk-UA", [milena, lesya]), {
    language: "uk-UA",
    voice: lesya.identifier,
    rate: 0.95,
  });
  assert.equal(cameraSpeechOptions("uk", [lesyaPremium, lesya]).voice, lesyaPremium.identifier);
});

test("Ukrainian warnings stay silent when the only voices are Russian or English", () => {
  assert.equal(pickUkrainianVoice([milena, samantha]), null);
  assert.deepEqual(cameraSpeechOptions("uk-UA", [milena, samantha]), {
    skip: true,
    reason: "no-ukrainian-voice",
  });
  assert.equal(cameraSpeechOptions("uk-UA", []).skip, true);
  assert.equal(cameraSpeechOptions("uk-UA", null).skip, true);
});

test("other warning languages keep the locale and do not pin a voice", () => {
  assert.deepEqual(cameraSpeechOptions("ru-RU", [milena, lesya]), { language: "ru-RU", rate: 0.95 });
  assert.deepEqual(cameraSpeechOptions("en-US", [samantha]), { language: "en-US", rate: 0.95 });
  assert.deepEqual(cameraSpeechOptions("pl-PL", []), { language: "pl-PL", rate: 0.95 });
});

test("camera warning call sites ask for the Ukrainian voice", () => {
  const app = fs.readFileSync(new URL("../../App.js", import.meta.url), "utf8");
  assert.equal(app.includes("Speech.speak(message.speech"), false);
  assert.equal(app.includes("speakCameraAlertAndWait(message.speech, message.locale)"), true);
  assert.equal(app.includes("speakCameraAlert(message.speech, message.locale)"), true);
  assert.equal(app.includes("speakCameraAlert(cameraPhrase, cameraLocale)"), true);
  const navigation = fs.readFileSync(new URL("../../google-nav-test-screen.js", import.meta.url), "utf8");
  assert.equal(navigation.includes("setAudioGuidanceType"), true);
});
