import { NativeModules } from "react-native";
import { applicationId } from "expo-application";
import { RouteStatus, TravelMode } from "@googlemaps/react-native-navigation-sdk";
import { speakCameraAlert } from "./camera-speech";
import { traceNavVoice } from "./nav-voice-trace";
import { failureCode, yevheniiaOnlyPlan } from "./voice-diag-checks";
import "./voice-diag-log";

// Fixed road points for the diagnostic process only. They are never written
// to the journal. The store bundle does not call this function.
const ORIGIN = { lat: 50.4501, lng: 30.5234 };
const DESTINATION = { lat: 50.467, lng: 30.515 };

function wait(ms, cancelled) {
  return new Promise(resolve => {
    setTimeout(() => resolve(!cancelled()), ms);
  });
}

function withTimeout(promise, ms, code) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(code);
      error.code = code;
      reject(error);
    }, ms);
    Promise.resolve(promise).then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

async function probe(label) {
  const read = NativeModules.CamAlertVoiceDiag?.audioProbe;
  if (typeof read !== "function") {
    traceNavVoice("auto.audio", { label, probe: false });
    return;
  }
  try {
    const snap = await read();
    const ports = Array.isArray(snap?.route) ? snap.route.filter(port => typeof port === "string") : [];
    const packs = Array.isArray(snap?.packs) ? snap.packs.filter(name => typeof name === "string") : [];
    traceNavVoice("auto.audio", {
      label,
      category: typeof snap?.category === "string" ? snap.category : "",
      ports: ports.join(","),
      volume: typeof snap?.volume === "number" ? Math.round(snap.volume * 100) / 100 : null,
      otherAudio: snap?.otherAudio === true,
      silenced: snap?.silenced === true,
      packs: packs.join(","),
      interruption: typeof snap?.interruption === "string" ? snap.interruption : "",
      location: typeof snap?.location === "string" ? snap.location : "",
    });
  } catch {
    traceNavVoice("auto.audio", { label, probe: false });
  }
}

async function routeFromSimulatedOrigin(controller, simulator, cancelled) {
  await Promise.resolve(simulator.simulateLocation(ORIGIN));
  traceNavVoice("auto.origin", { ok: true });
  if (!await wait(2000, cancelled)) return null;
  let status = await withTimeout(controller.setDestination(
    { title: "TEST", position: DESTINATION },
    { routingOptions: { travelMode: TravelMode.DRIVING } },
  ), 25000, "route-timeout");
  if (status === RouteStatus.LOCATION_UNKNOWN || status === RouteStatus.LOCATION_DISABLED) {
    await Promise.resolve(simulator.simulateLocation(ORIGIN));
    if (!await wait(3000, cancelled)) return null;
    status = await withTimeout(controller.setDestination(
      { title: "TEST", position: DESTINATION },
      { routingOptions: { travelMode: TravelMode.DRIVING } },
    ), 25000, "route-timeout");
  }
  return status;
}

export async function runVoiceDiagAuto({
  controllerRef, requestVoice, setOnTurnByTurn, markGuiding, ensureSession, cancelled,
}) {
  let maneuvers = 0;
  let navState = null;
  setOnTurnByTurn?.(events => {
    const list = Array.isArray(events) ? events : [];
    maneuvers += list.length > 0 ? list.length : 1;
    const state = list[0]?.navState;
    if (typeof state === "number") navState = state;
  });
  try {
    traceNavVoice("auto.begin", { test: true, bundle: applicationId || "none" });
    await withTimeout(ensureSession(), 20000, "session-timeout");
    if (cancelled()) return;
    const controller = controllerRef.current;
    const simulator = controller?.simulator;
    if (typeof simulator?.simulateLocation !== "function" || typeof simulator?.simulateLocationsAlongExistingRoute !== "function") {
      traceNavVoice("auto.origin", { ok: false, code: "missing" });
      return;
    }
    const status = await routeFromSimulatedOrigin(controller, simulator, cancelled);
    if (cancelled() || status == null) return;
    traceNavVoice("auto.route", { status: String(status) });
    if (status !== RouteStatus.OK) return;
    await requestVoice(4, "google-only");
    traceNavVoice("check.google-only", { playClip: false, auto: true });
    try {
      await withTimeout(controller.startGuidance(), 15000, "guidance-timeout");
      markGuiding(true);
      traceNavVoice("auto.guidance", { started: true });
    } catch (error) {
      traceNavVoice("auto.guidance", { started: false, code: failureCode(error) });
      return;
    }
    try {
      await Promise.resolve(simulator.simulateLocationsAlongExistingRoute({ speedMultiplier: 1 }));
      traceNavVoice("auto.simulation", { started: true, speedMultiplier: 1 });
    } catch (error) {
      traceNavVoice("auto.simulation", { started: false, code: failureCode(error) });
      return;
    }
    for (let step = 0; step < 7; step += 1) {
      if (!await wait(5000, cancelled)) return;
      await probe(`listen-${step}`);
    }
    traceNavVoice("auto.maneuvers", { count: maneuvers, navState });
    traceNavVoice("check.yevheniia", { clip: "close", auto: true });
    try {
      await speakCameraAlert("", "uk", yevheniiaOnlyPlan());
      traceNavVoice("check.yevheniia.done", { clip: "close", auto: true });
    } catch {
      traceNavVoice("check.failed", { check: "yevheniia" });
    }
    await requestVoice(4, "restore");
    traceNavVoice("check.restore.done", { clip: "close", auto: true });
    if (!await wait(8000, cancelled)) return;
    await probe("after-restore");
    traceNavVoice("auto.maneuvers", { count: maneuvers, navState, phase: "after-restore" });
    traceNavVoice("auto.done", { heard: false });
  } catch (error) {
    traceNavVoice("auto.failed", { code: failureCode(error) });
  }
}
