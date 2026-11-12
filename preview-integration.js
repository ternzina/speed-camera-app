import { NativeModules } from "react-native";
import { applicationId } from "expo-application";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AudioGuidance, NavigationSessionStatus, RouteStatus, TravelMode,
} from "@googlemaps/react-native-navigation-sdk";
import { STORE_PREVIEW_BUNDLE } from "./google-nav-gate";
import { buildPreviewCases } from "./camera-fix";
import { currentPreviewNavigation } from "./preview-nav-bridge";
import { withNavigationWindow } from "./navigation-readiness";
import "./voice-diag-log";

// Runs only in the preview install. Simulated fixes go through the same
// camera handler as the phone GPS watch. This file never sets the device
// location and never shows the Navigation terms dialog.

const RUN_KEY = "preview_integration_v62";
const DESTINATION = { lat: 50.467, lng: 30.515 };

function note(line) {
  const text = String(line);
  if (/CamAlertGoogleNavKey|latitude|longitude/i.test(text)) return;
  if (/-?\d{1,3}\.\d{4,}/.test(text)) return;
  console.log(text);
  const append = NativeModules.CamAlertVoiceDiag?.append;
  if (typeof append === "function") append(text);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function field(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.round(value));
  if (typeof value === "string" && value.length < 48 && !/-?\d{1,3}\.\d{4,}/.test(value)) return value;
  return "none";
}

async function probe(label) {
  const read = NativeModules.CamAlertVoiceDiag?.audioProbe;
  if (typeof read !== "function") {
    note(`CAMALERT_PREVIEW audio=${label} probe=missing`);
    return;
  }
  try {
    const snap = await read();
    const ports = Array.isArray(snap?.route) ? snap.route.filter(port => typeof port === "string") : [];
    note(`CAMALERT_PREVIEW audio=${label} category=${field(snap?.category)} ports=${ports.join(",") || "none"} interruption=${field(snap?.interruption)}`);
  } catch {
    note(`CAMALERT_PREVIEW audio=${label} probe=failed`);
  }
}

async function fixCase(api, label, speed, spot, sameId) {
  const result = await api().handleFix({
    latitude: spot.latitude,
    longitude: spot.longitude,
    speedKmh: speed,
    heading: spot.heading,
    speedAvailable: true,
    source: "simulated",
  });
  const same = sameId == null ? "none" : result?.cameraId === sameId ? "yes" : "no";
  note(`CAMALERT_PREVIEW fix=${label} source=simulated speed=${speed} distance=${field(result?.distance)} limit=${field(result?.limit)} outcome=${field(result?.outcome)} speech=${field(result?.speech)} same=${same} heard=unmeasured`);
  return result;
}

async function tryGuidance(cancelled) {
  const nav = currentPreviewNavigation();
  let controller = null;
  for (let tick = 0; tick < 40 && !cancelled(); tick += 1) {
    controller = nav?.getController?.() || null;
    if (controller) break;
    await wait(250);
  }
  if (!controller) {
    note("CAMALERT_PREVIEW navSession=missing");
    note("CAMALERT_PREVIEW navRequired=main-navigation-screen");
    return false;
  }
  let accepted = false;
  try { accepted = await controller.areTermsAccepted() === true; } catch { accepted = false; }
  note(`CAMALERT_PREVIEW navTerms=${accepted ? "accepted" : "not-accepted"} dialog=not-shown`);
  const foreground = () => !cancelled();
  let status = "error";
  try {
    status = await withNavigationWindow(() => controller.init(), foreground);
  } catch (error) {
    note(`CAMALERT_PREVIEW navInit=threw code=${field(error?.code || error?.message || "error")}`);
    return false;
  }
  note(`CAMALERT_PREVIEW navInit=${field(status)}`);
  if (status === NavigationSessionStatus.NOT_AUTHORIZED) {
    note("CAMALERT_PREVIEW navRequired=add-com.21wek.camera.voicepreview-to-the-existing-ios-key-restriction");
    return false;
  }
  if (status === NavigationSessionStatus.TERMS_NOT_ACCEPTED) {
    note("CAMALERT_PREVIEW navRequired=terms-already-accepted-dialog-not-shown");
    note("CAMALERT_PREVIEW navKey=not-reached-because-terms-stopped-init");
    return false;
  }
  if (status !== NavigationSessionStatus.OK) return false;
  nav.markReady();
  let route = "error";
  try {
    route = await withNavigationWindow(() => controller.setDestination(
      { title: "Voice", position: DESTINATION },
      { routingOptions: { travelMode: TravelMode.DRIVING } },
    ), foreground);
  } catch (error) {
    note(`CAMALERT_PREVIEW navRoute=threw code=${field(error?.code || "error")}`);
    await nav.stopGuidance?.();
    return false;
  }
  note(`CAMALERT_PREVIEW navRoute=${field(route)} simulatedLocation=false`);
  if (route !== RouteStatus.OK) {
    await nav.stopGuidance?.();
    return false;
  }
  try {
    await nav.requestVoice(AudioGuidance.VOICE_ALERTS_AND_GUIDANCE, "before-start");
    await withNavigationWindow(() => controller.startGuidance(), foreground);
    nav.setGuiding(true);
    note("CAMALERT_PREVIEW navGuidance=started source=sdk");
  } catch (error) {
    note(`CAMALERT_PREVIEW navGuidance=threw code=${field(error?.code || "error")}`);
    await nav.stopGuidance?.();
    return false;
  }
  await wait(300);
  return true;
}

export async function runPreviewIntegration({ api, cancelled }) {
  if (applicationId !== STORE_PREVIEW_BUNDLE) return;
  const already = await AsyncStorage.getItem(RUN_KEY);
  if (already) {
    note("CAMALERT_PREVIEW integration=skipped reason=already");
    return;
  }
  note("CAMALERT_PREVIEW integration=begin");
  let speechDone = false;
  try {
    await wait(800);
    if (cancelled()) return;
    api().resetRepeat();
    const plan = buildPreviewCases(api().cameras());
    if (!plan?.primary) {
      note("CAMALERT_PREVIEW integration=no-approach");
      return;
    }
    const primary = plan.primary;
    await fixCase(api, "speed7", 7, primary.at500, primary.id);
    await fixCase(api, "away", 40, { ...primary.away, heading: (primary.bearing + 180) % 360 }, primary.id);
    await fixCase(api, "far40", 40, primary.at800, primary.id);
    await fixCase(api, "warn40", 40, primary.at500, primary.id);
    await fixCase(api, "repeat", 40, primary.at400, primary.id);
    if (plan.second) await fixCase(api, "warn70", 70, plan.second.at800, plan.second.id);
    else note("CAMALERT_PREVIEW fix=warn70 source=simulated outcome=no-second-camera speech=none heard=unmeasured");
    await probe("after-warnings");
    speechDone = true;

    note("CAMALERT_PREVIEW gps=start source=device");
    api().armGpsLog(2);
    let started = false;
    try { started = !!(await api().startGps()); } catch { started = false; }
    note(`CAMALERT_PREVIEW gpsWatch=${started ? "started" : "failed"} source=device`);
    try { await api().dismissGuide(); } catch {}
    await wait(4000);
    if (!cancelled() && api().gpsRunning()) api().stopGps();
    await wait(200);
    note(`CAMALERT_PREVIEW gpsWatch=${api().gpsRunning() ? "still-running" : "stopped"} source=device`);

    const guided = await tryGuidance(cancelled);
    if (guided) {
      api().resetRepeat();
      note("CAMALERT_PREVIEW guidedRepeat=reset");
      await fixCase(api, "guided", 40, primary.at500, primary.id);
      await probe("after-guided");
    } else {
      note("CAMALERT_PREVIEW guidedWarning=skipped route=none");
    }
    note("CAMALERT_PREVIEW integration=done");
  } catch (error) {
    note(`CAMALERT_PREVIEW integration=failed code=${field(error?.code || "error")}`);
  } finally {
    try { await currentPreviewNavigation()?.stopGuidance?.(); } catch {}
    try { if (api().gpsRunning()) api().stopGps(); } catch {}
    try { api().resetRepeat(); } catch {}
    try { api().clearAhead(); } catch {}
    try { api().clearAlert(); } catch {}
    try { await api().dismissGuide(); } catch {}
    if (speechDone) await AsyncStorage.setItem(RUN_KEY, "1").catch(() => {});
    await probe("released");
  }
}
