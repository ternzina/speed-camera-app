import * as Engine from 'expo-speech';
import { Platform } from 'react-native';
import { createSpeechCoordinator } from './camera-speech-coordinator';
import { cameraSpeechOptions } from './camera-speech-voice';
import { playClipPlan, stopUkrainianClips } from './uk-voice-player';
import { ukrainianPlanFromPhrase } from './uk-voice-clips';
const coordinator = createSpeechCoordinator(Engine);
coordinator.bindClipStop(stopUkrainianClips);
let speechSequence = 0;
export const speak = (text, options = {}) => {
  speechSequence += 1;
  return coordinator.speak(text, {
    ...(Platform.OS === 'ios' ? { useApplicationAudioSession: false } : {}),
    ...options,
  });
};
export const stop = () => {
  speechSequence += 1;
  return coordinator.stop();
};
export const isSpeakingAsync = coordinator.isSpeakingAsync;
export const subscribeCameraSpeech = coordinator.subscribe;

// A background location task must not return while its utterance is pending.
// Bound the wait when an installed TTS engine fails to deliver callbacks.
export function speakAndWait(text, options = {}) {
  const expectedSequence = speechSequence + 1;
  return new Promise(resolve => {
    let settled = false;
    const finish = status => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(status);
    };
    const timeout = setTimeout(() => {
      // A delayed callback from an old task must not cancel a newer warning.
      if (speechSequence === expectedSequence) stop().catch(() => {});
      finish('timeout');
    }, 15000);
    try {
      speak(text, {
        ...options,
        onDone: () => finish('done'),
        onStopped: () => finish('stopped'),
        onError: () => finish('error'),
      });
    } catch {
      finish('error');
    }
  });
}

let voicesPromise;
function systemVoices() {
  if (!voicesPromise) {
    const load = Engine.getAvailableVoicesAsync;
    voicesPromise = (typeof load === 'function' ? Promise.resolve().then(() => load()) : Promise.resolve([]))
      .then(voices => Array.isArray(voices) ? voices : [])
      .catch(() => []);
  }
  return voicesPromise;
}

async function resolveCameraSpeechOptions(locale) {
  const language = String(locale || '').toLowerCase().replace('_', '-');
  if (!language.startsWith('uk')) return { language: locale, rate: 0.95 };
  return cameraSpeechOptions(locale, await systemVoices());
}

function speechRequest(options) {
  return {
    language: options.language,
    rate: options.rate,
    ...(options.voice ? { voice: options.voice } : {}),
  };
}

function ukrainianLocale(locale) {
  return String(locale || "").toLowerCase().replace("_", "-").startsWith("uk");
}

let queuedPlan;
// The warning call stays two arguments. The plan is attached on the same turn.
export function queueUkrainianClip(plan) {
  queuedPlan = plan === undefined ? null : plan;
}

function clipPlanFor(text, locale, plan) {
  const queued = queuedPlan;
  queuedPlan = undefined;
  if (!ukrainianLocale(locale)) return undefined;
  if (plan !== undefined) return plan;
  if (queued !== undefined) return queued;
  return ukrainianPlanFromPhrase(text) || undefined;
}

// Clips first. If a file is missing the player skips it; if none play, the
// installed uk-UA voice speaks the same line. A stale ticket never starts.
async function playUkrainianClips(text, locale, plan, wait) {
  const session = coordinator.beginClip();
  try {
    let result = { played: 0, stopped: false };
    try {
      result = await playClipPlan(plan, session.current);
    } catch {
      result = { played: 0, stopped: !session.current() };
    }
    if (!session.current() || result.stopped) return "stopped";
    if (result.played > 0) return "done";
    if (!text) return "silent";
    const options = await resolveCameraSpeechOptions(locale);
    if (!session.current()) return "stopped";
    if (options.skip) return options.reason;
    session.end();
    if (!wait) {
      speak(text, speechRequest(options));
      return "fallback-speech";
    }
    return speakAndWait(text, speechRequest(options));
  } finally {
    session.end();
  }
}

// Ukrainian warnings play the bundled Yevheniia clips. With no installed
// uk-UA voice and no clip, stay silent instead of a Russian or English voice.
export async function speakCameraAlert(text, locale, plan) {
  const clips = clipPlanFor(text, locale, plan);
  if (ukrainianLocale(locale) && clips !== undefined) {
    if (!clips) return "silent";
    return playUkrainianClips(text, locale, clips, false);
  }
  const options = await resolveCameraSpeechOptions(locale);
  if (options.skip) return options.reason;
  await stop();
  speak(text, speechRequest(options));
  return 'requested';
}

export async function speakCameraAlertAndWait(text, locale, plan) {
  const clips = clipPlanFor(text, locale, plan);
  if (ukrainianLocale(locale) && clips !== undefined) {
    if (!clips) return "silent";
    return playUkrainianClips(text, locale, clips, true);
  }
  const options = await resolveCameraSpeechOptions(locale);
  if (options.skip) return options.reason;
  return speakAndWait(text, speechRequest(options));
}
