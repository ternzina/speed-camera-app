import { NativeModules, TurboModuleRegistry } from "react-native";
import { applicationId } from "expo-application";
import AsyncStorage from "@react-native-async-storage/async-storage";
import data from "./cameras.json";
import plData from "./cameras-pl.json";
import { cameraPoints, countryFeed } from "./camera-data";
import { STORE_PREVIEW_BUNDLE } from "./google-nav-gate";
import { ukrainianClipPlan } from "./uk-voice-clips";
import { ukVoiceSources } from "./uk-voice-assets";
import "./voice-diag-log";

const SETTINGS_KEY = "camera_settings_v060";
const FORWARD_ANGLE_DEGREES = 45;

function note(line) {
  const text = String(line);
  if (/CamAlertGoogleNavKey|latitude|longitude/i.test(text)) return;
  if (/-?\d{1,3}\.\d{4,}/.test(text)) return;
  console.log(text);
  const append = NativeModules.CamAlertVoiceDiag?.append;
  if (typeof append === "function") append(text);
}

function move(lat, lon, bearingDeg, distanceM) {
  const radius = 6371000;
  const delta = distanceM / radius;
  const theta = (bearingDeg * Math.PI) / 180;
  const phi1 = (lat * Math.PI) / 180;
  const lambda1 = (lon * Math.PI) / 180;
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
  const lambda2 = lambda1 + Math.atan2(
    Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
    Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
  );
  return { lat: (phi2 * 180) / Math.PI, lon: (lambda2 * 180) / Math.PI };
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const radius = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDegrees(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
    - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  const degrees = Math.atan2(y, x) * 180 / Math.PI;
  return ((degrees % 360) + 360) % 360;
}

function angleDiff(a, b) {
  const norm = (value) => ((value % 360) + 360) % 360;
  const delta = Math.abs(norm(a) - norm(b));
  return delta > 180 ? 360 - delta : delta;
}

function nearestAhead(points, lat, lon, heading) {
  let best = null;
  let bestDistance = Infinity;
  for (const camera of points) {
    const distance = distanceMeters(lat, lon, camera.latitude, camera.longitude);
    if (distance > 5000) continue;
    if (camera.direction != null && /^\d+(\.\d+)?$/.test(String(camera.direction)) && angleDiff(heading, Number(camera.direction)) > 60) continue;
    const bearing = bearingDegrees(lat, lon, camera.latitude, camera.longitude);
    if (angleDiff(heading, bearing) <= FORWARD_ANGLE_DEGREES && distance < bestDistance) {
      bestDistance = distance;
      best = camera;
    }
  }
  return best ? { limit: best.speed_limit, distance: Math.round(bestDistance) } : null;
}

function simulatedApproach(points) {
  for (const camera of points) {
    if (!Number.isFinite(Number(camera.latitude)) || !Number.isFinite(Number(camera.longitude))) continue;
    for (const bearing of [0, 90, 180, 270]) {
      const spot = move(camera.latitude, camera.longitude, (bearing + 180) % 360, 500);
      const ahead = nearestAhead(points, spot.lat, spot.lon, bearing);
      if (ahead && ahead.distance >= 450 && ahead.distance <= 550) {
        const plan = ukrainianClipPlan({
          kind: "ua-camera",
          distance: ahead.distance,
          limit: ahead.limit,
          over: false,
        });
        const clips = (plan?.steps || []).map((step) => step.id);
        const missing = clips.filter((id) => ukVoiceSources[id] == null);
        return { distance: ahead.distance, limit: ahead.limit, clips, missing };
      }
    }
  }
  return null;
}

// Runs only in the separate preview install. It does not start a trip, write
// camera settings, or read a route. Playback belongs to the integration run.
export async function runPreviewInstallCheck() {
  if (applicationId !== STORE_PREVIEW_BUNDLE) return;
  try {
    const points = cameraPoints(countryFeed({}, "UA", data, plData)).filter((camera) => !camera._example_only);
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    let warnings = "defaults-on";
    if (stored) {
      const parsed = JSON.parse(stored);
      warnings = parsed?.cameraWarnings === false ? "saved-off" : "saved-on";
    }
    const snapshot = await NativeModules.CamAlertVoiceDiag?.snapshot?.();
    const approach = simulatedApproach(points);
    const nav = TurboModuleRegistry.get("NavModule");
    note(`CAMALERT_PREVIEW cameras=${points.length}`);
    note(`CAMALERT_PREVIEW settings=${stored ? "saved" : "defaults"} warnings=${warnings}`);
    note(`CAMALERT_PREVIEW location=${snapshot?.location || "unread"}`);
    note(`CAMALERT_PREVIEW navModule=${nav ? "present" : "missing"} diagnostic=off`);
    if (!approach) {
      note("CAMALERT_PREVIEW approach=none audioPlayed=false");
      return;
    }
    note(`CAMALERT_PREVIEW approach distance=${approach.distance} limit=${approach.limit} route=none`);
    note(`CAMALERT_PREVIEW clips=${approach.clips.join(",")} missing=${approach.missing.length}`);
    note("CAMALERT_PREVIEW below8=no-search");
    note("CAMALERT_PREVIEW playback=integration");
  } catch {
    note("CAMALERT_PREVIEW check=failed audioPlayed=false");
  }
}
