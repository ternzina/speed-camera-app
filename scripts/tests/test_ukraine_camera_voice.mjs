import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cameraAlertCopy } from "../../camera-alert-copy.js";
import { googleAudioMode } from "../../google-nav-banner.js";
import { ukrainianClipPlan } from "../../uk-voice-clips.js";

const AUDIO_URL = "file:///camalert-ukraine-voice/expo-audio.mjs";
const SPEECH_URL = "file:///camalert-ukraine-voice/expo-speech.mjs";
const REACT_URL = "file:///camalert-ukraine-voice/react-native.mjs";

const AUDIO_SOURCE = `
export const playerCalls = [];
export const audioModes = [];
export const control = { failPlayback: false };
export function createAudioPlayer(source) {
  if (control.failPlayback) throw new Error("playback-failed");
  playerCalls.push(String(source));
  const listeners = new Set();
  const player = {
    duration: 1.2,
    currentTime: 0,
    play() {
      queueMicrotask(() => {
        player.currentTime = player.duration;
        for (const listener of listeners) {
          listener({ didJustFinish: true, duration: player.duration, currentTime: player.duration });
        }
      });
    },
    pause() {},
    remove() {},
    addListener(_name, listener) {
      listeners.add(listener);
      return { remove() { listeners.delete(listener); } };
    },
  };
  return player;
}
export async function setAudioModeAsync(mode) { audioModes.push(mode); }
export async function setIsAudioActiveAsync() {}
`;

const SPEECH_SOURCE = `
export const calls = [];
export function speak(text, options = {}) {
  calls.push({ text, language: options?.language || "", voice: options?.voice || "" });
  queueMicrotask(() => options?.onDone?.());
}
export function stop() { return Promise.resolve(); }
export function isSpeakingAsync() { return Promise.resolve(false); }
export function getAvailableVoicesAsync() {
  return Promise.resolve([
    { identifier: "lesya", name: "Lesya", quality: "Default", language: "uk-UA" },
    { identifier: "milena", name: "Milena", quality: "Default", language: "ru-RU" },
  ]);
}
`;

const REACT_SOURCE = `export const Platform = { OS: "ios", isPad: false };\nexport default { Platform };\n`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "expo-audio" || specifier === AUDIO_URL) return { url: AUDIO_URL, shortCircuit: true };
    if (specifier === "expo-speech" || specifier === SPEECH_URL) return { url: SPEECH_URL, shortCircuit: true };
    if (specifier === "react-native" || specifier === REACT_URL) return { url: REACT_URL, shortCircuit: true };
    if (specifier.endsWith(".mp3")) {
      const file = new URL(specifier, context.parentURL);
      return { url: `${file.href}?asset`, shortCircuit: true };
    }
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      const leaf = specifier.slice(specifier.lastIndexOf("/"));
      if (specifier.startsWith(".") && !leaf.includes(".")) {
        return nextResolve(`${specifier}.js`, context);
      }
      throw error;
    }
  },
  load(url, context, nextLoad) {
    if (url === AUDIO_URL) return { format: "module", source: AUDIO_SOURCE, shortCircuit: true };
    if (url === SPEECH_URL) return { format: "module", source: SPEECH_SOURCE, shortCircuit: true };
    if (url === REACT_URL) return { format: "module", source: REACT_SOURCE, shortCircuit: true };
    if (url.includes("?asset")) {
      const file = fileURLToPath(url.slice(0, url.indexOf("?asset")));
      return { format: "module", source: `export default ${JSON.stringify(file)};\n`, shortCircuit: true };
    }
    if (url.includes("uk-voice-assets.js")) {
      const file = fileURLToPath(url);
      const source = fs.readFileSync(file, "utf8").replace(
        /require\((['"])(\.\/assets\/uk-voice\/[^'"]+)\1\)/g,
        (_match, _quote, spec) => JSON.stringify(path.resolve(path.dirname(file), spec)),
      );
      return { format: "module", source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const audio = await import(AUDIO_URL);
const systemSpeech = await import(SPEECH_URL);
const {
  queueUkrainianClip,
  speakCameraAlert,
  speakCameraAlertAndWait,
  subscribeCameraSpeech,
} = await import(pathToFileURL(fileURLToPath(new URL("../../camera-speech.js", import.meta.url))).href);

const camera = { distance: 500, speed_limit: 50 };
const expectedClips = ["lead-kamera-cherez", "dist-0500", "limit-50"];
let guiding = false;
const modes = [];
subscribeCameraSpeech((speaking) => {
  modes.push(googleAudioMode({ cameraSpeaking: speaking, guiding, voiceEnabled: true }));
});

function reset() {
  audio.playerCalls.length = 0;
  audio.audioModes.length = 0;
  audio.control.failPlayback = false;
  systemSpeech.calls.length = 0;
  modes.length = 0;
}

function playedIds() {
  return audio.playerCalls.map((source) => path.basename(source, ".mp3"));
}

function queueUkraine(language) {
  const message = cameraAlertCopy(language, camera, 40, true);
  queueUkrainianClip(ukrainianClipPlan({
    kind: "ua-camera",
    distance: camera.distance,
    limit: camera.speed_limit,
    over: message.over,
  }));
  return message;
}

test("Ukraine cameras play Yevheniia for the Russian and Ukrainian interface, with and without a route", async () => {
  for (const language of ["ru", "uk"]) {
    for (const route of [false, true]) {
      reset();
      guiding = route;
      const message = queueUkraine(language);
      const outcome = await speakCameraAlert(message.speech, message.locale);
      assert.equal(outcome, "done", `${language} route=${route}`);
      assert.deepEqual(playedIds(), expectedClips, `${language} route=${route}`);
      assert.equal(systemSpeech.calls.length, 0, `${language} route=${route}`);
      assert.equal(message.locale, language === "uk" ? "uk-UA" : "ru-RU");
      const seen = [...modes];
      assert.ok(seen.includes("silent"), `${language} route=${route}`);
      if (route) assert.equal(seen.at(-1), "alerts-and-guidance", language);
      else assert.ok(seen.every((mode) => mode === "silent"), `${language} ${seen.join(",")}`);
      for (const id of playedIds()) {
        const file = audio.playerCalls.find((source) => source.endsWith(`${id}.mp3`));
        const bytes = fs.readFileSync(file);
        assert.equal(bytes.length > 1000, true, id);
        assert.equal(bytes.subarray(0, 3).toString("latin1") === "ID3" || bytes[0] === 0xff, true, id);
      }
    }
  }
  assert.equal(cameraAlertCopy("ru", camera, 40, true).body, "Ограничение 50 км/ч.");
  assert.equal(cameraAlertCopy("uk", camera, 40, true).body, "Обмеження 50 км/год.");
  assert.equal(googleAudioMode({ cameraSpeaking: false, guiding: false, voiceEnabled: true }), "silent");
  assert.equal(googleAudioMode({ cameraSpeaking: false, guiding: true, voiceEnabled: true }), "alerts-and-guidance");
});

test("a background Ukraine warning waits for the same clips in Russian", async () => {
  reset();
  guiding = false;
  const message = queueUkraine("ru");
  const outcome = await speakCameraAlertAndWait(message.speech, message.locale);
  assert.equal(outcome, "done");
  assert.deepEqual(playedIds(), expectedClips);
  assert.equal(systemSpeech.calls.length, 0);
});

test("a missing Yevheniia file falls back to the interface language", async () => {
  for (const language of ["ru", "uk"]) {
    reset();
    const message = cameraAlertCopy(language, camera, 40, true);
    queueUkrainianClip({ steps: [{ id: "missing-clip", join: "none" }] });
    const outcome = await speakCameraAlert(message.speech, message.locale);
    assert.equal(outcome, "fallback-speech", language);
    assert.deepEqual(playedIds(), [], language);
    assert.equal(audio.audioModes.some((mode) => mode.interruptionMode === "doNotMix"), false, language);
    assert.equal(systemSpeech.calls.at(-1).language, message.locale, language);
    assert.equal(systemSpeech.calls.at(-1).text, message.speech, language);
  }
  assert.equal(systemSpeech.calls.at(-1).language, "uk-UA");
});

test("a playback error falls back to system speech and does not change Google's voice", async () => {
  reset();
  guiding = true;
  audio.control.failPlayback = true;
  const message = queueUkraine("ru");
  const outcome = await speakCameraAlert(message.speech, message.locale);
  assert.equal(outcome, "fallback-speech");
  assert.deepEqual(playedIds(), []);
  assert.equal(systemSpeech.calls.at(-1).language, "ru-RU");
  assert.equal(systemSpeech.calls.at(-1).text, message.speech);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(modes.includes("silent"));
  assert.equal(modes.at(-1), "alerts-and-guidance");
});

test("Poland and a Russian sentence without a Ukraine plan stay on system speech", async () => {
  reset();
  guiding = false;
  const poland = await speakCameraAlert("Kamera za 300 m. Ograniczenie 50 km/h.", "pl-PL");
  assert.equal(poland, "requested");
  assert.deepEqual(playedIds(), []);
  assert.equal(systemSpeech.calls.at(-1).language, "pl-PL");

  reset();
  const russian = cameraAlertCopy("ru", camera, 40, true);
  const outcome = await speakCameraAlert(russian.speech, russian.locale);
  assert.equal(outcome, "requested");
  assert.deepEqual(playedIds(), []);
  assert.equal(systemSpeech.calls.at(-1).language, "ru-RU");
  assert.equal(systemSpeech.calls.at(-1).text, russian.speech);
});

test("the app keeps the interface language and limits Yevheniia to Ukraine cameras", () => {
  const app = fs.readFileSync(new URL("../../App.js", import.meta.url), "utf8");
  const between = (start, end) => {
    const from = app.indexOf(start);
    assert.ok(from >= 0, start);
    const to = app.indexOf(end, from + start.length);
    assert.ok(to > from, end);
    return app.slice(from, to);
  };
  const settings = between("const DEFAULT_SETTINGS = {", "const WARNING_UI");
  assert.match(settings, /language: "ru"/);
  assert.match(settings, /country: "ua"/);

  const warning = between("function speakWarning", "async function startTracking");
  assert.match(warning, /ukrainianClipPlan\(\{ kind: "ua-camera"/);
  assert.doesNotMatch(warning, /language === "uk"/);
  assert.match(warning, /speakCameraAlert\(message\.speech, message\.locale\)/);
  assert.doesNotMatch(warning, /polyline|guiding|googleAudioMode/);

  const background = between('saveSpeechStatus("requested")', "saveSpeechStatus(outcome)");
  assert.match(background, /session\.country === "UA"/);
  assert.match(background, /kind: ukraineCamera \? "ua-camera" : "pl-camera"/);
  assert.match(background, /ukraineCamera \|\| bgSettings\.language === "uk"/);

  const poland = between('if (selectedCountry !== "UA")', "const n = findNearestAny");
  assert.match(poland, /settings\.language === "uk"/);
  assert.match(poland, /kind: "pl-camera"/);
  assert.doesNotMatch(poland, /kind: "ua-camera"/);

  const navigation = fs.readFileSync(new URL("../../google-nav-test-screen.js", import.meta.url), "utf8");
  assert.match(navigation, /Google turn prompts follow the iPhone language/);
  assert.match(navigation, /AudioGuidance\.VOICE_ALERTS_AND_GUIDANCE/);
  assert.match(navigation, /AudioGuidance\.SILENT/);
  assert.doesNotMatch(navigation, /ukrainianClipPlan|queueUkrainianClip/);
});
