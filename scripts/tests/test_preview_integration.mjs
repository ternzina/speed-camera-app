import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildPreviewCases, nearestAhead, ukraineFixDecision } from "../../camera-fix.js";

const root = new URL("../../", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");
const cameras = JSON.parse(read("cameras.json")).cameras;

test("seven, forty and seventy use the same speed, distance and repeat gate", () => {
  assert.deepEqual(ukraineFixDecision({ speedKmh: 7, heading: 0, ahead: { id: 1, distance: 500, speed_limit: 50 }, threshold: 600, last: null }).reason, "below-speed");
  assert.equal(ukraineFixDecision({ speedKmh: 7, heading: 0, ahead: { id: 1, distance: 500 }, threshold: 600, last: null }).speak, false);
  assert.equal(ukraineFixDecision({ speedKmh: 40, heading: null, ahead: { id: 1, distance: 500 }, threshold: 600, last: null }).reason, "below-speed");
  assert.equal(ukraineFixDecision({ speedKmh: 40, heading: 0, ahead: null, threshold: 600, last: null }).reason, "none-ahead");
  const far = ukraineFixDecision({ speedKmh: 40, heading: 0, ahead: { id: 1, distance: 800, speed_limit: 50 }, threshold: 600, last: null });
  assert.equal(far.reason, "distance");
  assert.equal(far.speak, false);
  const city = ukraineFixDecision({ speedKmh: 40, heading: 0, ahead: { id: 1, distance: 500, speed_limit: 50 }, threshold: 600, last: null });
  assert.equal(city.reason, "warn");
  assert.equal(city.speak, true);
  const again = ukraineFixDecision({ speedKmh: 40, heading: 0, ahead: { id: 1, distance: 400, speed_limit: 50 }, threshold: 600, last: { id: 1, distance: 500 } });
  assert.equal(again.reason, "repeat");
  const road = ukraineFixDecision({ speedKmh: 70, heading: 90, ahead: { id: 2, distance: 800, speed_limit: 50 }, threshold: 900, last: { id: 1, distance: 400 } });
  assert.equal(road.reason, "warn");
  assert.equal(road.speak, true);
});

test("the preview cases approach real cameras without treating the point as device GPS", () => {
  const plan = buildPreviewCases(cameras);
  assert.ok(plan?.primary);
  assert.ok(plan.second);
  const toward = nearestAhead(cameras, plan.primary.at500.latitude, plan.primary.at500.longitude, plan.primary.at500.heading);
  assert.equal(toward.id, plan.primary.id);
  assert.ok(toward.distance >= 440 && toward.distance <= 560);
  const awayHeading = (plan.primary.bearing + 180) % 360;
  const away = nearestAhead(cameras, plan.primary.away.latitude, plan.primary.away.longitude, awayHeading);
  assert.ok(away == null || (away.id !== plan.primary.id && away.distance > 600));
  const farther = nearestAhead(cameras, plan.primary.at800.latitude, plan.primary.at800.longitude, plan.primary.at800.heading);
  assert.ok(farther.distance >= 740 && farther.distance <= 860);
  const road = nearestAhead(cameras, plan.second.at800.latitude, plan.second.at800.longitude, plan.second.at800.heading);
  assert.equal(road.id, plan.second.id);
  assert.notEqual(plan.second.id, plan.primary.id);
});

test("the preview integration stays off the published bundle and off the system location", () => {
  const run = read("preview-integration.js");
  const app = read("App.js");
  const screen = read("google-nav-test-screen.js");
  assert.match(run, /if \(applicationId !== STORE_PREVIEW_BUNDLE\) return/);
  assert.match(run, /source=simulated/);
  assert.match(run, /source=device/);
  assert.match(run, /dialog=not-shown/);
  assert.doesNotMatch(run, /watchPositionAsync|showTermsAndConditionsDialog|simulateLocationsAlongExistingRoute|setMockLocation|Location\./);
  assert.match(app, /if \(applicationId !== STORE_PREVIEW_BUNDLE \|\| previewRun\.current\) return undefined/);
  assert.match(app, /handleUkraineFix\(\{[\s\S]*source: "gps"/);
  assert.match(app, /source: "simulated"/);
  assert.match(screen, /Куда едем\?/);
  assert.match(screen, /go: "В путь"/);
  assert.match(screen, /if \(diagnostic \|\| applicationId !== STORE_PREVIEW_BUNDLE\) return undefined/);
  const plain = screen.indexOf("if (!props.diagnostic) return body");
  const panel = screen.indexOf("<VoiceDiagPanel");
  assert.ok(plain !== -1 && panel > plain);
});
