import { NativeModules, Platform } from "react-native";

// Shows the warning already chosen by CamAlert. It does not speak and does not
// invent a camera, a limit, or a distance.
export function showCarPlayAlert(title, subtitle) {
  if (Platform.OS !== "ios") return;
  const bridge = NativeModules.CamAlertCarPlay;
  if (!bridge || typeof bridge.showAlert !== "function") return;
  const heading = String(title || "").trim();
  if (!heading) return;
  bridge.showAlert(heading, String(subtitle || "").trim());
}
