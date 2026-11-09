import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  announceBand,
  approximateRouteProgress,
  corridorFeed,
  distanceAlongPolyline,
  formatArrivalTime,
  formatDuration,
  guidanceState,
  narrowCamerasToRoute,
  navPhrase,
  planNavAnnouncement,
  regionForCoordinates,
  ROUTE_CORRIDOR_METERS,
  REROUTE_MAX_CALLS,
  REROUTE_MIN_INTERVAL_MS,
  shouldRequestReroute,
} from "../../route-guidance.js";

const root = new URL("../../", import.meta.url);
const north = (index) => ({ latitude: 50 + index * 0.0045, longitude: 30 });
const line = [north(0), north(1), north(2)];

test("a missing polyline does not copy or filter the camera list", () => {
  const cameras = [{ id: "a", latitude: 50, longitude: 30 }];
  assert.equal(narrowCamerasToRoute(cameras, null), cameras);
  assert.equal(narrowCamerasToRoute(cameras, []), cameras);
  assert.equal(narrowCamerasToRoute(cameras, [north(0)]), cameras);
  const feed = { speed_cameras: cameras, average_speed_sections: [{ id: "section" }] };
  assert.equal(corridorFeed(feed, null), feed);
  assert.equal(corridorFeed(feed, line).average_speed_sections, feed.average_speed_sections);
});

test("the corridor keeps a camera on the line and drops one far beside it", () => {
  const near = { id: "near", latitude: 50.0045, longitude: 30.001 };
  const far = { id: "far", latitude: 50.0045, longitude: 30.02 };
  const kept = narrowCamerasToRoute([near, far], line, ROUTE_CORRIDOR_METERS);
  assert.deepEqual(kept.map((camera) => camera.id), ["near"]);
  const feed = {
    speed_cameras: [near, far],
    red_light_cameras: [far],
    checkpoints: [],
    average_speed_sections: [{ id: "section", start: north(0), end: north(2) }],
  };
  const narrowed = corridorFeed(feed, line, ROUTE_CORRIDOR_METERS);
  assert.equal(narrowed.speed_cameras.length, 1);
  assert.equal(narrowed.red_light_cameras.length, 0);
  assert.equal(narrowed.average_speed_sections, feed.average_speed_sections);
});

test("guidance reads the next real step and the distance along the polyline", () => {
  const route = {
    polyline: line,
    steps: [
      { instructions: "Поверните направо", distance: 500, coordinates: [north(0), north(1)] },
      { instructions: "Прибудете", distance: 500, coordinates: [north(1), north(2)] },
    ],
  };
  const atStart = guidanceState(north(0), route);
  assert.equal(atStart.stepIndex, 0);
  assert.equal(atStart.instruction, "Поверните направо");
  assert.ok(atStart.distanceMeters > 450 && atStart.distanceMeters < 560, atStart.distanceMeters);
  assert.ok(atStart.offRouteMeters < 5);
  const along = distanceAlongPolyline(north(1), line);
  assert.ok(along > 450 && along < 560, along);
  assert.equal(guidanceState(north(0), { polyline: line, steps: [] }), null);
  assert.equal(regionForCoordinates([]), null);
  assert.ok(regionForCoordinates(line));
});

test("voice timing uses speed, and a camera-spoken key is not repeated", () => {
  const highway = announceBand({ distanceMeters: 400, speedMps: 30 });
  const city = announceBand({ distanceMeters: 400, speedMps: 5 });
  assert.equal(highway, "early");
  assert.equal(city, null);
  assert.equal(announceBand({ distanceMeters: 30, speedMps: 5 }), "now");
  const first = planNavAnnouncement({
    stepIndex: 0, distanceMeters: 400, speedMps: 30, spoken: {}, instruction: "Поверните направо", language: "ru",
  });
  assert.equal(first.speak, true);
  assert.match(first.phrase, /Поверните направо/);
  assert.equal(first.locale, "ru-RU");
  const again = planNavAnnouncement({
    stepIndex: 0, distanceMeters: 390, speedMps: 30, spoken: { [first.key]: true }, instruction: "Поверните направо", language: "ru",
  });
  assert.equal(again.speak, false);
  assert.equal(again.reason, "already");
  assert.equal(navPhrase("ru", "  ", 100), null);
  assert.equal(formatDuration("ru", Number.NaN), null);
});

test("moving ETA scales the last Apple estimate and is not live traffic", () => {
  const route = { polyline: line, expectedTravelTime: 600, steps: [{ instructions: "Прямо", distance: 1000 }] };
  const start = approximateRouteProgress(north(0), route);
  const middle = approximateRouteProgress(north(1), route);
  assert.equal(start.liveTraffic, false);
  assert.equal(start.approximate, true);
  assert.ok(start.remainingMeters > 900, start.remainingMeters);
  assert.ok(Math.abs(start.etaSeconds - 600) < 30, start.etaSeconds);
  assert.ok(middle.remainingMeters < start.remainingMeters);
  assert.ok(middle.etaSeconds < start.etaSeconds);
  assert.equal(approximateRouteProgress(north(0), { polyline: line, expectedTravelTime: Number.NaN }).etaSeconds, null);
  assert.equal(approximateRouteProgress(north(0), { polyline: [] }), null);
  assert.equal(formatArrivalTime("ru", Number.NaN, 0), null);
  const clock = formatArrivalTime("ru", 90, Date.UTC(2026, 10, 8, 12, 0, 0));
  assert.match(clock, /^примерно \d{2}:\d{2}$/);
  assert.doesNotMatch(clock, /пробк|traffic/i);
});

test("automatic MKDirections reroutes are capped", () => {
  const fast = { offRouteMeters: 90, speedMps: 12 };
  const first = shouldRequestReroute({ at: 0, ...fast, history: [] });
  assert.equal(first.ok, true);
  const soon = shouldRequestReroute({ at: 10_000, ...fast, history: first.history });
  assert.equal(soon.ok, false);
  assert.equal(soon.reason, "interval");
  const parked = shouldRequestReroute({ at: 0, offRouteMeters: 200, speedMps: 0, history: [] });
  assert.equal(parked.reason, "slow");
  const onRoute = shouldRequestReroute({ at: 0, offRouteMeters: 20, speedMps: 12, history: [] });
  assert.equal(onRoute.reason, "on-route");
  let history = [];
  for (let call = 0; call < REROUTE_MAX_CALLS; call += 1) {
    const decision = shouldRequestReroute({ at: call * REROUTE_MIN_INTERVAL_MS, ...fast, history });
    assert.equal(decision.ok, true);
    history = decision.history;
  }
  const blocked = shouldRequestReroute({ at: REROUTE_MAX_CALLS * REROUTE_MIN_INTERVAL_MS, ...fast, history });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "cap");
  assert.equal(blocked.history.length, REROUTE_MAX_CALLS);
});

test("the proven warning functions and background task stay on the full feed path", () => {
  const app = fs.readFileSync(new URL("App.js", root), "utf8");
  const ahead = app.slice(app.indexOf("function findNearestAhead"), app.indexOf("Notifications.setNotificationHandler"));
  assert.doesNotMatch(ahead, /routeCorridor|corridorFeed|narrowCameras/);
  const visible = app.slice(app.indexOf("function visibleCameras"), app.indexOf("function countryCameraCount"));
  assert.doesNotMatch(visible, /routeCorridor|corridorFeed|narrowCameras/);
  const speech = app.slice(app.indexOf("function speakWarning"), app.indexOf("async function startTracking"));
  assert.doesNotMatch(speech, /routeCorridor|corridorFeed|narrowCameras|approximateRouteProgress/);
  const poland = fs.readFileSync(new URL("poland-engine.js", root), "utf8");
  assert.doesNotMatch(poland.slice(poland.indexOf("export function nearestPolandPoint"), poland.indexOf("export function detectAverageSpeedSection")), /corridorFeed|polyline/);
  assert.doesNotMatch(poland.slice(poland.indexOf("export function detectAverageSpeedSection")), /corridorFeed/);
  const background = app.slice(app.indexOf("async function processBackgroundLocation"), app.indexOf("function storedCountryCodes"));
  assert.match(background, /nearestPolandPoint\(feed,/);
  assert.doesNotMatch(background, /corridorFeed|routeCorridor/);
  const tracking = app.slice(app.indexOf("async function startTracking"), app.indexOf("function stopTracking"));
  assert.match(tracking, /detectAverageSpeedSection\(\s*activeCountryFeedRef\.current/);
  assert.match(tracking, /nearestPolandPoint\(activeCountryFeedRef\.current/);
  assert.doesNotMatch(tracking, /corridorFeed|routeCorridor|narrowCamerasToRoute/);
  assert.match(tracking, /watchPositionAsync/);
  const stopping = app.slice(app.indexOf("function stopTracking"), app.indexOf("const backgroundBusy"));
  assert.match(stopping, /setRouteGuidance\(null\)/);
  assert.doesNotMatch(app.slice(app.indexOf("function endRouteOnly"), app.indexOf("async function launchNavigator")), /stopTracking/);
  assert.match(app, /onStart=\{startTracking\}/);
  assert.match(app, /Начать поездку/);
  assert.match(app, /Куда едем\?/);
  assert.match(app, /onOpenRoute=\{openInAppRoute\}/);
  assert.match(app, /onOpenExternal=\{isGoogleNavTestApp\(\) \? null : \(navigator\) => launchNavigator\(navigator, ""\)\}/);
  assert.match(app, /hideExternalNav=\{isGoogleNavTestApp\(\)\}/);
  assert.doesNotMatch(app, /visible=\{modal === "navigator"\}/);
  const navEffect = app.slice(app.indexOf("if (!active || !routeGuidance || !coords)"), app.indexOf("const routeMapCameras"));
  assert.match(navEffect, /planNavAnnouncement/);
  assert.match(navEffect, /approximateRouteProgress/);
  assert.match(navEffect, /shouldRequestReroute/);
  assert.match(app, /onOpenRoute=\{Platform\.OS === "ios" \? openInAppRoute : null\}/);
  const opener = app.slice(app.indexOf("function openInAppRoute"), app.indexOf("async function startRouteGuidance"));
  assert.match(opener, /setIosRouteOpen\(true\)/);
  assert.doesNotMatch(opener, /startTracking|stopTracking/);
  const guidance = app.slice(app.indexOf("async function startRouteGuidance"), app.indexOf("async function launchNavigator"));
  const guardAt = guidance.indexOf("if (foregroundTripRunning || sub.current) return true");
  const startAt = guidance.indexOf("await startTracking()");
  assert.ok(guardAt > 0 && startAt > guardAt);
  assert.doesNotMatch(guidance, /stopTracking/);
  assert.match(app, /accessibilityLabel=\{copy\.route\}/);
  assert.match(app, /onPress=\{onOpenRoute\}/);
  assert.doesNotMatch(app, /tripDiag\.lines\.join/);
  assert.match(app, /traceTrip\("driveRender", "render"\)/);
  assert.match(app, /onClose=\{\(\) => setIosRouteOpen\(false\)\}/);
  assert.match(app, /label: "Apple Maps"/);
  assert.match(app, /label: "Google Maps"/);
  assert.match(app, /Завершить поездку/);
  assert.match(app, /Завершить маршрут/);
  assert.match(app, /onEndRoute=\{routeGuidance \? endRouteOnly : null\}/);
  assert.match(app, /onStop=\{stopTracking\}/);
  const routeScreen = fs.readFileSync(new URL("ios-route-screen.js", root), "utf8");
  assert.match(routeScreen, /В путь/);
  assert.doesNotMatch(routeScreen, /Вести в CamAlert/);
  assert.match(routeScreen, /onStartGuidance\(packed\)/);
  assert.match(fs.readFileSync(new URL("camera-delivery.js", root), "utf8"), /https:\/\/speed-camera-data\.ternzina\.workers\.dev/);
  assert.match(fs.readFileSync(new URL("camera-data.js", root), "utf8"), /camera_remote_cache_v081|CACHE_CHUNK_CHARS/);
  assert.match(app, /REMOTE_CACHE_KEY = "camera_remote_cache_v081"/);
  assert.match(app, /buildNavigatorLinks/);
  const links = fs.readFileSync(new URL("navigator-links.js", root), "utf8");
  assert.match(links, /maps:\/\//);
  assert.match(links, /comgooglemaps:\/\//);
});
