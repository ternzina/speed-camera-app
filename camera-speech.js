import * as Engine from 'expo-speech';
import { Platform } from 'react-native';
import { createSpeechCoordinator } from './camera-speech-coordinator';
import { cameraSpeechOptions } from './camera-speech-voice';
const coordinator = createSpeechCoordinator(Engine);
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

// Ukrainian warnings name a uk-UA voice. With none installed, stay silent
// instead of letting the system default read Ukrainian with another accent.
export async function speakCameraAlert(text, locale) {
  const options = await resolveCameraSpeechOptions(locale);
  if (options.skip) return options.reason;
  await stop();
  speak(text, speechRequest(options));
  return 'requested';
}

export async function speakCameraAlertAndWait(text, locale) {
  const options = await resolveCameraSpeechOptions(locale);
  if (options.skip) return options.reason;
  return speakAndWait(text, speechRequest(options));
}
