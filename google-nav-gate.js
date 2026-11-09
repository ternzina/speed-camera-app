import { Platform } from "react-native";
import { applicationId } from "expo-application";

export const GOOGLE_NAV_TEST_BUNDLE = "com.21wek.camera.navtest";

export function isGoogleNavTestApp() {
  return Platform.OS === "ios" && applicationId === GOOGLE_NAV_TEST_BUNDLE;
}
