import * as Engine from 'expo-speech';
import { Platform } from 'react-native';
import { createSpeechCoordinator } from './camera-speech-coordinator';
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
