import { Platform } from "react-native";
import { applicationId } from "expo-application";

export const STORE_BUNDLE = "com.21wek.camera";
export const GOOGLE_NAV_TEST_BUNDLE = "com.21wek.camera.navtest";

export function isGoogleNavTestApp() {
  return Platform.OS === "ios" && applicationId === GOOGLE_NAV_TEST_BUNDLE;
}

// Store and navtest both open the in-app navigator. The store build does not
// read CAMALERT_IOS_GOOGLE_NAV_TEST. Navtest-only speech and country counting
// stay on isGoogleNavTestApp so the published app keeps its saved data.
export function usesInAppGoogleNav() {
  return Platform.OS === "ios"
    && (applicationId === STORE_BUNDLE || applicationId === GOOGLE_NAV_TEST_BUNDLE);
}
