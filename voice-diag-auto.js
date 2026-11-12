import { NativeModules } from "react-native";
import { applicationId } from "expo-application";
import { RouteStatus, TravelMode } from "@googlemaps/react-native-navigation-sdk";
import { speakCameraAlert } from "./camera-speech";
import { traceNavVoice } from "./nav-voice-trace";
import { failureCode, yevheniiaOnlyPlan } from "./voice-diag-checks";
import "./voice-diag-log";

// One destination, as Nav 59 passes a single chosen point. The navigator uses
// the device location it already has. This file never calls simulateLocation,
// and it never writes the point to the journal.
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

async function locationReady(cancelled) {
  const read = NativeModules.CamAlertVoiceDiag?.audioProbe;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    let location = "";
    if (typeof read === "function") {
      try {
        const snap = await read();
        location = typeof snap?.location === "string" ? snap.location : "";
      } catch {
        location = "";
      }
    }
    if (location === "authorizedWhenInUse" || location === "authorizedAlways") {
      traceNavVoice("auto.ready", { location, attempt });
      return true;
    }
    if (!await wait(500, cancelled)) return false;
  }
  traceNavVoice("auto.ready", { location: "pending", attempt: 8 });
  return !cancelled();
}

async function requestRoute(controller, cancelled) {
  const started = Date.now();
  const ask = async (attempt) => {
    const status = await withTimeout(controller.setDestination(
      { title: "TEST", position: DESTINATION },
      { routingOptions: { travelMode: TravelMode.DRIVING } },
    ), 25000, "route-timeout");
    traceNavVoice("auto.route", {
      status: String(status),
      attempt,
      ms: Date.now() - started,
      travelMode: "DRIVING",
      simulated: false,
    });
    return status;
  };
  let status = await ask(1);
  const waiting = status === RouteStatus.LOCATION_UNKNOWN || status === RouteStatus.LOCATION_DISABLED;
  if (!waiting || !await wait(3000, cancelled)) return status;
  return ask(2);
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
    if (cancelled() || !await locationReady(cancelled)) return;
    const controller = controllerRef.current;
    const status = await requestRoute(controller, cancelled);
    if (cancelled() || status !== RouteStatus.OK) return;
    try {
      await withTimeout(controller.startGuidance(), 15000, "guidance-timeout");
      markGuiding(true);
      traceNavVoice("auto.guidance", { started: true });
    } catch (error) {
      traceNavVoice("auto.guidance", { started: false, code: failureCode(error) });
      return;
    }
    await requestVoice(4, "google-only");
    traceNavVoice("check.google-only", { playClip: false, auto: true });
    const alongRoute = controller?.simulator?.simulateLocationsAlongExistingRoute;
    if (typeof alongRoute !== "function") {
      traceNavVoice("auto.simulation", { started: false, code: "missing" });
      return;
    }
    try {
      await Promise.resolve(alongRoute.call(controller.simulator, { speedMultiplier: 1 }));
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
