import { Settings } from "react-native";

// The navtest build copies CamAlertGoogleNavKey from Info.plist into
// UserDefaults before JavaScript starts. The value is never written to git.
const PLACES_KEY = "CamAlertGoogleNavKey";

export function readPlacesKey() {
  const value = Settings.get(PLACES_KEY);
  return typeof value === "string" ? value.trim() : "";
}
