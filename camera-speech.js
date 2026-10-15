import * as Engine from 'expo-speech';
import { createSpeechCoordinator } from './camera-speech-coordinator';
const coordinator = createSpeechCoordinator(Engine);
export const speak = coordinator.speak;
export const stop = coordinator.stop;
export const isSpeakingAsync = coordinator.isSpeakingAsync;
export const subscribeCameraSpeech = coordinator.subscribe;
