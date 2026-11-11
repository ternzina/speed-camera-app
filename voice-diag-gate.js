import { Platform } from "react-native";
import { applicationId } from "expo-application";

// This bundle is the diagnostic install only. It is not the store app and
// not the navtest app, so installing it does not replace either one.
export const VOICE_DIAG_BUNDLE = "com.21wek.camera.voicediag";

export function isVoiceDiagApp() {
  return Platform.OS === "ios" && applicationId === VOICE_DIAG_BUNDLE;
}
