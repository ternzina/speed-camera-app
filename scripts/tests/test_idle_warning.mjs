import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  holdMovingSpeech,
  idleWarningDecision,
  movePoint,
  nearestAhead,
  rememberReliableCourse,
  settleIdleLatch,
  ukraineFixDecision,
} from "../../camera-fix.js";

const car = { latitude: 50.45, longitude: 30.52 };
const heading = 0;

function offset(forward, side, extra = {}) {
  const ahead = movePoint(car.latitude, car.longitude, heading, forward);
  const spot = side ? movePoint(ahead.lat, ahead.lon, (heading + 90) % 360, side) : ahead;
  return {
    id: `f${forward}-s${side}`,
    latitude: spot.lat,
    longitude: spot.lon,
    speed_limit: 50,
    direction: null,
    ...extra,
  };
}

function courseAt(latitude, longitude, courseHeading = heading) {
  return rememberReliableCourse(null, { speedKmh: 36, heading: courseHeading, latitude, longitude });
}

test("a stop announces the camera ahead once and does not repeat it", () => {
  const camera = offset(100, 0);
  const reliable = courseAt(car.latitude, car.longitude);
  const first = idleWarningDecision({
    speedKmh: 0, latitude: car.latitude, longitude: car.longitude,
    reliable, cameras: [camera], idleSpokenId: null,
  });
  assert.equal(first.speak, true);
  assert.equal(first.reason, "idle-warn");
  assert.equal(first.cameraId, camera.id);
  assert.ok(first.distance <= 150 && first.distance >= 90);

  const again = idleWarningDecision({
    speedKmh: 3, latitude: car.latitude, longitude: car.longitude,
    reliable, cameras: [camera], idleSpokenId: first.cameraId,
  });
  assert.equal(again.speak, false);
  assert.equal(again.reason, "idle-repeat");
  assert.equal(again.cameraId, camera.id);
});

test("a stop without a saved course stays silent", () => {
  const camera = offset(80, 0);
  const decision = idleWarningDecision({
    speedKmh: 0, latitude: car.latitude, longitude: car.longitude,
    reliable: null, cameras: [camera],
  });
  assert.equal(decision.speak, false);
  assert.equal(decision.reason, "no-course");
});

test("a slow noisy heading does not replace the last reliable course", () => {
  const saved = courseAt(car.latitude, car.longitude, 12);
  const kept = rememberReliableCourse(saved, {
    speedKmh: 4, heading: 180, latitude: car.latitude, longitude: car.longitude,
  });
  assert.equal(kept.heading, 12);
  const decision = idleWarningDecision({
    speedKmh: 4, latitude: car.latitude, longitude: car.longitude,
    reliable: kept, cameras: [offset(90, 0)],
  });
  assert.equal(decision.speak, true);
});

test("a camera on the next road is not announced while stopped", () => {
  const beside = offset(80, 40);
  const decision = idleWarningDecision({
    speedKmh: 0, latitude: car.latitude, longitude: car.longitude,
    reliable: courseAt(car.latitude, car.longitude), cameras: [beside],
  });
  assert.equal(decision.speak, false);
  assert.equal(decision.reason, "none-ahead");

  const ahead = offset(120, 0, { id: "ahead" });
  const chosen = idleWarningDecision({
    speedKmh: 0, latitude: car.latitude, longitude: car.longitude,
    reliable: courseAt(car.latitude, car.longitude), cameras: [beside, ahead],
  });
  assert.equal(chosen.cameraId, "ahead");
});

test("an oncoming camera and a camera beyond 150 m stay quiet", () => {
  const oncoming = offset(70, 0, { direction: 180 });
  const far = offset(200, 0, { id: "far" });
  const reliable = courseAt(car.latitude, car.longitude);
  assert.equal(idleWarningDecision({
    speedKmh: 0, latitude: car.latitude, longitude: car.longitude, reliable, cameras: [oncoming],
  }).reason, "none-ahead");
  assert.equal(idleWarningDecision({
    speedKmh: 0, latitude: car.latitude, longitude: car.longitude, reliable, cameras: [far],
  }).reason, "none-ahead");
});

test("a course captured too far from the stop is not used", () => {
  const origin = movePoint(car.latitude, car.longitude, 180, 50);
  const reliable = courseAt(origin.lat, origin.lon);
  const decision = idleWarningDecision({
    speedKmh: 0, latitude: car.latitude, longitude: car.longitude,
    reliable, cameras: [offset(100, 0)],
  });
  assert.equal(decision.reason, "course-stale");
  assert.equal(decision.speak, false);
});

test("resuming does not repeat the camera announced while stopped", () => {
  const camera = offset(100, 0);
  const reliable = courseAt(car.latitude, car.longitude);
  const idle = idleWarningDecision({
    speedKmh: 0, latitude: car.latitude, longitude: car.longitude,
    reliable, cameras: [camera],
  });
  assert.equal(idle.speak, true);
  const ahead = nearestAhead([camera], car.latitude, car.longitude, heading, 5000, 45);
  const moving = ukraineFixDecision({
    speedKmh: 40, heading, ahead, threshold: 600, last: { id: null, distance: Infinity },
  });
  assert.equal(moving.speak, true);
  const latch = settleIdleLatch(idle.cameraId, {
    moving: true, aheadId: moving.cameraId, aheadDistance: moving.distance, threshold: 600,
  });
  assert.equal(latch, idle.cameraId);
  const held = holdMovingSpeech(moving, latch);
  assert.equal(held.speak, false);
  assert.equal(held.reason, "idle-already");

  const passed = settleIdleLatch(latch, { moving: true, aheadId: null, aheadDistance: null, threshold: 600 });
  assert.equal(passed, null);
  const later = ukraineFixDecision({
    speedKmh: 40, heading, ahead, threshold: 600, last: { id: null, distance: Infinity },
  });
  assert.equal(holdMovingSpeech(later, passed).speak, true);
});

test("moving warnings keep the 8 km/h gate, the city distance and the 250 m repeat", () => {
  assert.equal(ukraineFixDecision({
    speedKmh: 7, heading: 0, ahead: { id: 1, distance: 100, speed_limit: 50 }, threshold: 600, last: null,
  }).reason, "below-speed");
  const first = ukraineFixDecision({
    speedKmh: 40, heading: 0, ahead: { id: 1, distance: 500, speed_limit: 50 }, threshold: 600, last: null,
  });
  assert.equal(first.speak, true);
  assert.equal(ukraineFixDecision({
    speedKmh: 40, heading: 0, ahead: { id: 1, distance: 400, speed_limit: 50 }, threshold: 600, last: { id: 1, distance: 500 },
  }).reason, "repeat");
  assert.equal(holdMovingSpeech(first, null).speak, true);
  const other = ukraineFixDecision({
    speedKmh: 40, heading: 0, ahead: { id: 2, distance: 500, speed_limit: 50 }, threshold: 600, last: null,
  });
  assert.equal(holdMovingSpeech(other, "1").speak, true);
});

test("a stop is not swallowed by the moving 250 m window", () => {
  const app = fs.readFileSync(new URL("../../App.js", import.meta.url), "utf8");
  const speech = app.slice(app.indexOf("function speakWarning"), app.indexOf("async function startTracking"));
  assert.match(speech, /options\.rememberApproach !== false && last\.id === cam\.id && last\.distance - cam\.distance < 250/);
  const ukraine = app.slice(app.indexOf("function handleUkraineFix"), app.indexOf("function runForegroundWatch"));
  assert.match(ukraine, /rememberApproach: false/);
  const background = app.slice(app.indexOf("if (speedKmh < MIN_MOVING_SPEED_KMH) {"), app.indexOf("if (speedKmh < MIN_MOVING_SPEED_KMH || heading == null) return;"));
  assert.match(background, /deliverBackgroundCameraAlert/);
  assert.doesNotMatch(background, /BACKGROUND_LAST_ALERT_KEY|bgLastAlert/);
});
