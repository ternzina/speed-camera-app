import { Platform } from "react-native";
import { applicationId } from "expo-application";

export const STORE_BUNDLE = "com.21wek.camera";
export const GOOGLE_NAV_TEST_BUNDLE = "com.21wek.camera.navtest";
// Separate install of the store interface. It is not navtest and not the
// diagnostic app, so installing it does not replace either of those builds.
export const STORE_PREVIEW_BUNDLE = "com.21wek.camera.voicepreview";

export function isGoogleNavTestApp() {
  return Platform.OS === "ios" && applicationId === GOOGLE_NAV_TEST_BUNDLE;
}

// Store, navtest, and the separate preview open the in-app navigator. The
// store build does not read CAMALERT_IOS_GOOGLE_NAV_TEST. Navtest-only speech
// and country counting stay on isGoogleNavTestApp so the published app keeps
// its saved data.
export function usesInAppGoogleNav() {
  return Platform.OS === "ios"
    && (applicationId === STORE_BUNDLE
      || applicationId === GOOGLE_NAV_TEST_BUNDLE
      || applicationId === STORE_PREVIEW_BUNDLE);
}
