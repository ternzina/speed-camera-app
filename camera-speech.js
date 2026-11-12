import * as Engine from 'expo-speech';
import { Platform } from 'react-native';
import { createSpeechCoordinator } from './camera-speech-coordinator';
import { cameraSpeechOptions } from './camera-speech-voice';
import { clipPlanMissing, playClipPlan, stopUkrainianClips } from './uk-voice-player';
import { ukrainianPlanFromPhrase } from './uk-voice-clips';
import { traceNavVoice } from './nav-voice-trace';
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
  // An explicit Ukraine-camera plan plays in every interface language.
  // Phrase parsing stays Ukrainian-only, so another country's sentence
  // is never turned into a Yevheniia clip.
  if (plan !== undefined) return plan;
  if (queued !== undefined) return queued;
  if (!ukrainianLocale(locale)) return undefined;
  return ukrainianPlanFromPhrase(text) || undefined;
}

// Clips first. A missing file or a player error leaves the warning to system
// speech in the locale the caller asked for. A stale ticket never starts.
async function playUkrainianClips(text, locale, plan, wait) {
  traceNavVoice("warning.begin", { kind: "clips", steps: Array.isArray(plan) ? plan.length : 0 });
  const session = coordinator.beginClip();
  try {
    let result = { played: 0, stopped: false, failed: false };
    if (clipPlanMissing(plan)) {
      result = { played: 0, stopped: false, failed: true };
    } else {
      try {
        result = await playClipPlan(plan, session.current);
      } catch {
        result = { played: 0, stopped: !session.current(), failed: true };
      }
    }
    if (!session.current() || result.stopped) return "stopped";
    if (result.played > 0 && !result.failed) return "done";
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
    traceNavVoice("warning.end", { kind: "clips" });
  }
}

// A queued or passed clip plan plays for any interface language. Without one,
// only a Ukrainian sentence is matched to clips. Ukrainian system speech still
// refuses a Russian or English voice when the clips cannot play.
function beginCameraAlert(text, locale, plan) {
  const clips = clipPlanFor(text, locale, plan);
  if (clips) return { clips };
  if (clips === null && ukrainianLocale(locale)) return { silent: true };
  return {};
}

export async function speakCameraAlert(text, locale, plan) {
  const alert = beginCameraAlert(text, locale, plan);
  if (alert.silent) return "silent";
  if (alert.clips) return playUkrainianClips(text, locale, alert.clips, false);
  const options = await resolveCameraSpeechOptions(locale);
  if (options.skip) return options.reason;
  traceNavVoice("warning.begin", { kind: "speech" });
  await stop();
  speak(text, speechRequest(options));
  return 'requested';
}

export async function speakCameraAlertAndWait(text, locale, plan) {
  const alert = beginCameraAlert(text, locale, plan);
  if (alert.silent) return "silent";
  if (alert.clips) return playUkrainianClips(text, locale, alert.clips, true);
  const options = await resolveCameraSpeechOptions(locale);
  if (options.skip) return options.reason;
  return speakAndWait(text, speechRequest(options));
}
