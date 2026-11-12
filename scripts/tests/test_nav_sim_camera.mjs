import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { diagnosticApproach, nearestAhead } from "../../camera-fix.js";
import { cameraDecisionJournal, navigationSample, speechTrace } from "../../nav-sim-camera.js";

test("a moving simulator is not left at zero when the SDK speed is empty", () => {
  const first = navigationSample({ lat: 50, lng: 30, speed: 0, bearing: 0, time: 1_700_000_000_000 }, null, 1_700_000_000_000);
  assert.equal(first.fix.speedKmh, 0);
  assert.equal(first.fix.source, "simulated");
  const second = navigationSample(
    { lat: 50.001, lng: 30, speed: 0, bearing: 0, time: 1_700_000_005_000 },
    first.previous,
  );
  assert.ok(second.fix.speedKmh >= 8);
  assert.equal(second.fix.heading, 0);
  const reported = navigationSample({ lat: 50, lng: 30, speed: 12, bearing: 90, time: 1_700_000_000_000 }, null);
  assert.ok(Math.abs(reported.fix.speedKmh - 43.2) < 0.01);
  assert.equal(reported.fix.speedAvailable, true);
});

test("the decision journal keeps the asked fields and drops the point", () => {
  const line = cameraDecisionJournal({
    cameraId: "ua-1",
    distance: 500.4,
    speed: 42.2,
    heading: 90,
    angle: 4,
    eligible: true,
    suppressedReason: "none",
    speechRequested: true,
    speechStarted: true,
    speechCompleted: false,
    speechError: "none",
    latitude: 50.1234,
    longitude: 30.1234,
    lat: 50.1234,
    lng: 30.1234,
  });
  assert.deepEqual(Object.keys(line), [
    "cameraId", "distance", "speed", "heading", "angle", "eligible",
    "suppressedReason", "speechRequested", "speechStarted", "speechCompleted", "speechError",
  ]);
  assert.equal(line.distance, 500);
  assert.equal(line.speed, 42);
  assert.equal(JSON.stringify(line).includes("50.1234"), false);
  assert.equal(speechTrace("done", true).speechCompleted, true);
  assert.equal(speechTrace("silent", true).speechError, "silent");
  assert.equal(speechTrace("none", false).speechRequested, false);
});

test("the simulated route starts inside the city threshold with a real camera ahead", () => {
  const feed = JSON.parse(readFileSync(new URL("../../cameras.json", import.meta.url), "utf8"));
  const cameras = Array.isArray(feed.cameras) ? feed.cameras : [];
  const route = diagnosticApproach(cameras);
  assert.ok(route?.cameraId != null && String(route.cameraId).length > 0);
  assert.ok(route.distance >= 440 && route.distance <= 600);
  const ahead = nearestAhead(cameras, route.start.lat, route.start.lng, route.heading);
  assert.equal(String(ahead?.id), String(route.cameraId));
  assert.ok(ahead.distance <= 600);
  assert.ok(ahead.angle <= 45);
});
