import { NativeModules } from "react-native";
import { setNavVoiceSink } from "./nav-voice-trace";

// Copies the trace into the app's Documents file. The native writer ignores
// every bundle except the diagnostic one, and drops coordinates and the key.
setNavVoiceSink((line) => {
  if (typeof line !== "string" || line.length > 500) return;
  if (/CamAlertGoogleNavKey|latitude|longitude|"lat"|"lng"/i.test(line)) return;
  if (/-?\d{1,3}\.\d{4,}/.test(line)) return;
  const append = NativeModules.CamAlertVoiceDiag?.append;
  if (typeof append === "function") append(line);
});
