import { NativeModules } from "react-native";
import { applicationId } from "expo-application";
import { RouteStatus, TravelMode } from "@googlemaps/react-native-navigation-sdk";
import { movePoint } from "./camera-fix";
import { navigationSample } from "./nav-sim-camera";
import { traceNavVoice } from "./nav-voice-trace";
import { failureCode } from "./voice-diag-checks";
import "./voice-diag-log";

// The simulated car starts beside a real camera and then moves along the
// route. The point stays in the navigator. This file does not write it down.
const CAMERA_SIM_SPEED = 1;
const SAMPLE_MS = 5000;
const BEFORE_LIMIT_MS = 45000;
const AFTER_LIMIT_MS = 25000;
const TURN_GOAL = 3;
const NAV_STATE_NAME = ["UNKNOWN", "ENROUTE", "REROUTING", "STOPPED"];

function navStateName(value) {
  return NAV_STATE_NAME[value] || "none";
}

function metersBetween(from, to) {
  const rad = Math.PI / 180;
  const dLat = (to.lat - from.lat) * rad;
  const dLng = (to.lng - from.lng) * rad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(from.lat * rad) * Math.cos(to.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function stepCount(event) {
  const steps = event?.getRemainingSteps;
  return Array.isArray(steps) ? steps.length : null;
}

const MANEUVER = [
  "UNKNOWN", "DEPART", "DESTINATION", "DESTINATION_LEFT", "DESTINATION_RIGHT", "STRAIGHT",
  "TURN_LEFT", "TURN_RIGHT", "KEEP_LEFT", "KEEP_RIGHT", "SLIGHT_LEFT", "SLIGHT_RIGHT",
  "SHARP_LEFT", "SHARP_RIGHT", "UTURN_CLOCKWISE", "UTURN_COUNTER",
  "MERGE", "MERGE_LEFT", "MERGE_RIGHT", "FORK_LEFT", "FORK_RIGHT",
  "ON_RAMP", "ON_RAMP_LEFT", "ON_RAMP_RIGHT", "ON_RAMP_KEEP_LEFT", "ON_RAMP_KEEP_RIGHT",
  "ON_RAMP_SLIGHT_LEFT", "ON_RAMP_SLIGHT_RIGHT", "ON_RAMP_SHARP_LEFT", "ON_RAMP_SHARP_RIGHT",
  "ON_RAMP_UTURN_CLOCKWISE", "ON_RAMP_UTURN_COUNTER",
  "OFF_RAMP", "OFF_RAMP_LEFT", "OFF_RAMP_RIGHT", "OFF_RAMP_KEEP_LEFT", "OFF_RAMP_KEEP_RIGHT",
  "OFF_RAMP_SLIGHT_LEFT", "OFF_RAMP_SLIGHT_RIGHT", "OFF_RAMP_SHARP_LEFT", "OFF_RAMP_SHARP_RIGHT",
  "OFF_RAMP_UTURN_CLOCKWISE", "OFF_RAMP_UTURN_COUNTER",
  "ROUNDABOUT_CLOCKWISE", "ROUNDABOUT_COUNTER",
  "ROUNDABOUT_STRAIGHT_CLOCKWISE", "ROUNDABOUT_STRAIGHT_COUNTER",
  "ROUNDABOUT_LEFT_CLOCKWISE", "ROUNDABOUT_LEFT_COUNTER",
  "ROUNDABOUT_RIGHT_CLOCKWISE", "ROUNDABOUT_RIGHT_COUNTER",
  "ROUNDABOUT_SLIGHT_LEFT_CLOCKWISE", "ROUNDABOUT_SLIGHT_LEFT_COUNTER",
  "ROUNDABOUT_SLIGHT_RIGHT_CLOCKWISE", "ROUNDABOUT_SLIGHT_RIGHT_COUNTER",
  "ROUNDABOUT_SHARP_LEFT_CLOCKWISE", "ROUNDABOUT_SHARP_LEFT_COUNTER",
  "ROUNDABOUT_SHARP_RIGHT_CLOCKWISE", "ROUNDABOUT_SHARP_RIGHT_COUNTER",
  "ROUNDABOUT_UTURN_CLOCKWISE", "ROUNDABOUT_UTURN_COUNTER",
  "ROUNDABOUT_EXIT_CLOCKWISE", "ROUNDABOUT_EXIT_COUNTER",
  "FERRY", "FERRY_TRAIN", "NAME_CHANGE",
];

function maneuverCode(raw) {
  const code = typeof raw === "number" ? raw : Number(raw);
  return Number.isInteger(code) ? code : null;
}

function maneuverLabel(raw) {
  const code = maneuverCode(raw);
  if (code != null && MANEUVER[code]) return MANEUVER[code];
  return typeof raw === "string" ? raw.slice(0, 48) : "";
}

function maneuverName(event) {
  return maneuverLabel(event?.currentStep?.maneuver);
}

function turnStepCount(event) {
  const steps = event?.getRemainingSteps;
  if (!Array.isArray(steps)) return null;
  return steps.filter(step => {
    const code = maneuverCode(step?.maneuver);
    return code != null && code >= 6 && code <= 62;
  }).length;
}

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

async function requestRoute(controller, cancelled, approach) {
  const place = controller?.simulator?.simulateLocation;
  if (approach?.start && typeof place === "function") {
    await withTimeout(
      Promise.resolve(place.call(controller.simulator, approach.start)),
      8000,
      "place-timeout",
    );
    traceNavVoice("camera.route", {
      placed: true,
      cameraId: approach.cameraId || "none",
      distance: approach.distance ?? null,
      heading: approach.heading == null ? null : Math.round(approach.heading),
    });
    if (!await wait(500, cancelled)) return "cancelled";
  } else {
    traceNavVoice("camera.route", { placed: false, cameraId: approach?.cameraId || "none" });
    return "no-camera";
  }
  const started = Date.now();
  const ask = async (attempt) => {
    const status = await withTimeout(controller.setDestination(
      { title: "TEST", position: approach.destination },
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

async function rollApproach(controller, approach, onNavigationFix, cancelled) {
  const place = controller?.simulator?.simulateLocation;
  if (!approach?.start || typeof place !== "function") {
    traceNavVoice("camera.roll", { started: false });
    return;
  }
  let lat = approach.start.lat;
  let lng = approach.start.lng;
  let previous = null;
  for (let step = 0; step < 6; step += 1) {
    if (cancelled()) return;
    const next = movePoint(lat, lng, approach.heading, 16);
    lat = next.lat;
    lng = next.lon;
    const now = Date.now();
    try {
      await Promise.resolve(place.call(controller.simulator, { lat, lng }));
    } catch {
      traceNavVoice("camera.roll", { started: false, step });
      return;
    }
    const sample = navigationSample({
      lat,
      lng,
      speed: 16,
      bearing: approach.heading,
      time: now,
    }, previous, now);
    previous = sample?.previous || previous;
    if (sample?.fix) await Promise.resolve(onNavigationFix?.(sample.fix));
    if (!await wait(1000, cancelled)) return;
  }
  traceNavVoice("camera.roll", { started: true, steps: 6, speedKmh: 58 });
}

export async function runVoiceDiagAuto({
  controllerRef, requestVoice, setOnTurnByTurn, observeLocation, decisionRef, approach, onNavigationFix, markGuiding, ensureSession, cancelled,
}) {
  const phases = {
    before: { events: 0, maneuvers: [] },
    clip: { events: 0, maneuvers: [] },
    after: { events: 0, maneuvers: [] },
  };
  let phase = "before";
  let locationUpdates = 0;
  let movedMeters = 0;
  let lastFix = null;
  let lastTurnSig = "";
  let turnSteps = null;
  let loggedShape = false;
  setOnTurnByTurn?.(events => {
    const list = Array.isArray(events) ? events : [];
    const bucket = phases[phase] || phases.before;
    if (list.length === 0) {
      bucket.events += 1;
      traceNavVoice("auto.turn", { phase, navState: "none", empty: true });
      return;
    }
    for (const event of list) {
      bucket.events += 1;
      const maneuver = maneuverName(event);
      const steps = stepCount(event);
      const turnsAhead = turnStepCount(event);
      if (turnsAhead != null) turnSteps = turnsAhead;
      if (maneuver) bucket.maneuvers.push(maneuver);
      if (!loggedShape && Array.isArray(event?.getRemainingSteps)) {
        loggedShape = true;
        const labels = event.getRemainingSteps.map(step => maneuverLabel(step?.maneuver)).filter(Boolean);
        traceNavVoice("auto.shape", {
          steps: labels.length,
          turns: labels.filter(label => !/^(DEPART|DESTINATION|STRAIGHT|UNKNOWN|NAME_CHANGE)/.test(label)).length,
          sample: [...new Set(labels)].slice(0, 8).join(","),
        });
      }
      const signature = `${navStateName(event?.navState)}|${maneuver}|${steps}|${turnsAhead}`;
      if (signature === lastTurnSig) continue;
      lastTurnSig = signature;
      traceNavVoice("auto.turn", {
        phase,
        navState: navStateName(event?.navState),
        maneuver,
        steps,
        turnSteps: turnsAhead,
        remainMeters: Math.round(Number(event?.distanceToFinalDestinationMeters) || 0),
        stepMeters: Math.round(Number(event?.distanceToCurrentStepMeters) || 0),
      });
    }
  });
  observeLocation?.(location => {
    locationUpdates += 1;
    const lat = Number(location?.lat);
    const lng = Number(location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (lastFix) movedMeters += metersBetween(lastFix, { lat, lng });
    lastFix = { lat, lng };
  });
  async function sample(label) {
    try {
      const remaining = await controllerRef.current?.getCurrentTimeAndDistance?.();
      const meters = Math.round(Number(remaining?.meters));
      const seconds = Math.round(Number(remaining?.seconds));
      traceNavVoice("auto.progress", {
        label,
        meters: Number.isFinite(meters) ? meters : null,
        seconds: Number.isFinite(seconds) ? seconds : null,
        locationUpdates,
        movedMeters: Math.round(movedMeters),
        turns: (phases[phase] || phases.before).events,
      });
      return Number.isFinite(meters) ? meters : null;
    } catch (error) {
      traceNavVoice("auto.progress", { label, error: error?.code || "progress-failed" });
      return null;
    }
  }
  async function watch(limitMs, goal) {
    const started = Date.now();
    let first = null;
    let last = null;
    let samples = 0;
    while (Date.now() - started < limitMs) {
      if (!await wait(SAMPLE_MS, cancelled)) return { first, last, samples };
      samples += 1;
      const meters = await sample(`t${samples}`);
      if (first == null && meters != null) first = meters;
      if (meters != null) last = meters;
      const bucket = phases[phase] || phases.before;
      if (goal && bucket.events >= goal && turnSteps > 0) break;
      if (first != null && last != null && first - last > 30 && last < 80) break;
    }
    return { first, last, samples };
  }
  try {
    traceNavVoice("auto.begin", { test: true, bundle: applicationId || "none" });
    try {
      controllerRef.current?.setTurnByTurnLoggingEnabled?.(true);
      traceNavVoice("auto.turnlog", { enabled: true });
    } catch (error) {
      traceNavVoice("auto.turnlog", { enabled: false, error: error?.code || "turnlog-failed" });
    }
    await withTimeout(ensureSession(), 20000, "session-timeout");
    if (cancelled() || !await locationReady(cancelled)) return;
    const controller = controllerRef.current;
    const status = await requestRoute(controller, cancelled, approach);
    if (cancelled() || status !== RouteStatus.OK) return;
    await requestVoice(4, "before-start");
    traceNavVoice("check.google-only", { playClip: false, auto: true, when: "before-start" });
    try {
      await withTimeout(controller.startGuidance(), 15000, "guidance-timeout");
      markGuiding(true);
      traceNavVoice("auto.guidance", { started: true });
    } catch (error) {
      traceNavVoice("auto.guidance", { started: false, code: failureCode(error) });
      return;
    }
    await rollApproach(controller, approach, onNavigationFix, cancelled);
    if (cancelled()) return;
    const alongRoute = controller?.simulator?.simulateLocationsAlongExistingRoute;
    if (typeof alongRoute !== "function") {
      traceNavVoice("auto.simulation", { started: false, code: "missing" });
      return;
    }
    try {
      await Promise.resolve(alongRoute.call(controller.simulator, { speedMultiplier: CAMERA_SIM_SPEED }));
      traceNavVoice("auto.simulation", { started: true, speedMultiplier: CAMERA_SIM_SPEED });
    } catch (error) {
      traceNavVoice("auto.simulation", { started: false, code: failureCode(error) });
      return;
    }
    try {
      const legs = await controller.getRouteSegments?.();
      traceNavVoice("auto.legs", { legs: Array.isArray(legs) ? legs.length : 0 });
    } catch (error) {
      traceNavVoice("auto.legs", { error: error?.code || "segments-failed" });
    }
    const before = await watch(BEFORE_LIMIT_MS, TURN_GOAL);
    let approachDecision = decisionRef?.current || null;
    const approachStarted = Date.now();
    while (approachDecision?.outcome !== "spoken" && Date.now() - approachStarted < 20000) {
      if (!await wait(500, cancelled)) break;
      approachDecision = decisionRef?.current || approachDecision;
    }
    await probe("approach");
    traceNavVoice("auto.approach", {
      outcome: approachDecision?.outcome || "none",
      cameraId: approachDecision?.cameraId ?? "none",
      distance: approachDecision?.distance ?? null,
      speed: approachDecision?.speedKmh ?? null,
      speech: typeof approachDecision?.speech === "string" ? approachDecision.speech : "none",
    });
    traceNavVoice("auto.maneuvers", {
      phase: "before",
      count: phases.before.events,
      kinds: [...new Set(phases.before.maneuvers)].slice(0, 8).join(","),
      metersStart: before.first,
      metersEnd: before.last,
      movedMeters: Math.round(movedMeters),
      locationUpdates,
    });
    phase = "after";
    const after = await watch(AFTER_LIMIT_MS, 0);
    await probe("after-restore");
    traceNavVoice("auto.maneuvers", {
      phase: "after",
      count: phases.after.events,
      clip: phases.clip.events,
      kinds: [...new Set(phases.after.maneuvers)].slice(0, 8).join(","),
      metersStart: after.first,
      metersEnd: after.last,
      movedMeters: Math.round(movedMeters),
      locationUpdates,
    });
    traceNavVoice("auto.done", {
      before: phases.before.events,
      clip: phases.clip.events,
      after: phases.after.events,
      movedMeters: Math.round(movedMeters),
      locationUpdates,
      heard: false,
    });
  } catch (error) {
    traceNavVoice("auto.failed", { code: failureCode(error) });
  }
}
