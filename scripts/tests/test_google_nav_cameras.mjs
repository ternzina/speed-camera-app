import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { cameraBanner, googleAudioMode, googleBackgroundLocationEnabled, navChrome } from "../../google-nav-banner.js";
import { noteNavtestCameraSpeech, resetNavtestCameraSpeech, skipRepeatedCameraSpeech, skipSharedNavtestSpeech } from "../../navtest-speech.js";

const root = new URL("../../", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");

test("the camera banner shows only fields the feed actually has", () => {
  assert.equal(cameraBanner(null, "Камера скорости"), null);
  assert.equal(cameraBanner({ latitude: 50 }, "Камера скорости"), null);
  assert.deepEqual(cameraBanner({ distance: 240.4 }, "Камера скорости"), { distance: 240 });
  assert.deepEqual(
    cameraBanner({ distance: 180, type: "speed_camera", speed_limit: 50 }, "Камера скорости"),
    { type: "Камера скорости", distance: 180, limit: 50 },
  );
  assert.deepEqual(cameraBanner({ type: "red_light", speed_limit: "" }, "Red-light camera"), { type: "Red-light camera" });
  assert.equal(cameraBanner({ speed_limit: "fast" }, ""), null);
});

test("camera speech pauses Google voice and the banner does not speak", () => {
  assert.equal(googleAudioMode({ cameraSpeaking: true, guiding: true, voiceEnabled: true }), "silent");
  assert.equal(googleAudioMode({ cameraSpeaking: false, guiding: true, voiceEnabled: true }), "alerts-and-guidance");
  assert.equal(googleAudioMode({ cameraSpeaking: false, guiding: true, voiceEnabled: false }), "silent");
  assert.equal(googleAudioMode({ cameraSpeaking: false, guiding: false, voiceEnabled: true }), "silent");
  const screen = read("google-nav-test-screen.js");
  assert.match(screen, /googleAudioMode\(/);
  assert.match(screen, /cameraBanner\(/);
  assert.doesNotMatch(screen, /Speech\.speak|GMSLocationSimulator|simulateLocations/);
});

test("navigation chrome changes with the route and does not duplicate the maneuver", () => {
  const map = navChrome({});
  assert.equal(map.search, true);
  assert.equal(map.maneuver, false);
  assert.equal(map.ordinaryMap, true);
  assert.equal(map.routeBar, false);
  const preview = navChrome({ routed: true, hasPoint: true });
  assert.equal(preview.go, true);
  assert.equal(preview.endRoute, true);
  assert.equal(preview.maneuver, false);
  assert.equal(preview.following, false);
  const guiding = navChrome({ guiding: true, routed: true });
  assert.equal(guiding.search, false);
  assert.equal(guiding.maneuver, true);
  assert.equal(guiding.go, false);
  assert.equal(guiding.routeBar, true);
  assert.equal(guiding.following, true);
  const ended = navChrome({});
  assert.deepEqual(ended, map);
});

test("warnings stay on the phone GPS feed and ignore the Google route line", () => {
  const app = read("App.js");
  const aheadStart = app.indexOf("function findNearestAhead");
  const ahead = app.slice(aheadStart, app.indexOf("return best;", aheadStart));
  assert.match(ahead, /angleDiff\(movementHeading,Number\(cam\.direction\)\)>60/);
  assert.match(ahead, /FORWARD_ANGLE_DEGREES/);
  assert.doesNotMatch(ahead, /polyline|narrowCamerasToRoute/);
  const speech = app.slice(app.indexOf("function speakWarning"), app.indexOf("async function startTracking"));
  assert.match(speech, /last\.distance - cam\.distance < 250/);
  const tracking = app.slice(app.indexOf("async function startTracking"), app.indexOf("function stopTracking"));
  assert.match(tracking, /watchPositionAsync/);
  assert.match(tracking, /AppState\.currentState !== "active"/);
  const mount = app.slice(app.indexOf("isGoogleNavTestApp() && (iosRouteOpen"), app.indexOf("if (iosRouteOpen)"));
  assert.match(mount, /camera=\{cameraWarningsEnabled\(settings\) \? ahead : null\}/);
  assert.match(mount, /if \(foregroundTripRunning \|\| sub\.current\) return true/);
  assert.doesNotMatch(mount, /watchPositionAsync|simulate/);
  const screen = read("google-nav-test-screen.js");
  assert.match(screen, /headerEnabled=\{chrome\.maneuver\}/);
  assert.match(screen, /recenterButtonEnabled=\{false\}/);
  assert.match(screen, /setFollowingPerspective\?\.\(CameraPerspective\.TILTED\)/);
  assert.match(screen, /setNavigationUIEnabled\?\.\(false\)/);
  assert.doesNotMatch(screen, /copy\.reroute|copy\.pick|copy\.routed/);
});

test("navtest skips a repeated non-UA camera phrase and production still speaks", () => {
  assert.equal(skipRepeatedCameraSpeech({ id: "pl-1", distance: 400 }, { id: "pl-1", distance: 280 }), true);
  assert.equal(skipRepeatedCameraSpeech({ id: "pl-1", distance: 400 }, { id: "pl-1", distance: 150 }), false);
  assert.equal(skipRepeatedCameraSpeech({ id: "pl-1", distance: 400 }, { id: "pl-2", distance: 390 }), false);
  assert.equal(skipRepeatedCameraSpeech({ id: null, distance: Infinity }, { id: "pl-1", distance: 200 }), false);
  const app = read("App.js");
  const branch = app.slice(app.indexOf('if (selectedCountry !== "UA")'), app.indexOf("const n = findNearestAny"));
  const guard = branch.indexOf("isGoogleNavTestApp() && (skipRepeatedCameraSpeech");
  const stop = branch.indexOf("Speech.stop()");
  const speak = branch.indexOf("Speech.speak(");
  assert.ok(guard > 0 && guard < stop && stop < speak);
  assert.match(branch, /if \(point\.distance <= threshold && settings\.voice && !repeatedNavtestSpeech\)/);
  assert.match(branch, /if \(isGoogleNavTestApp\(\)\) navtestPolandSpoken\.current = \{ id: String\(point\.id\), distance: point\.distance \};/);
  const screen = read("google-nav-test-screen.js");
  assert.match(screen, /footerEnabled=\{false\}/);
  assert.match(screen, /<RouteBar/);
  const header = fs.readFileSync(new URL("../../ios/Pods/GoogleNavigation/Frameworks/GoogleNavigation.xcframework/ios-arm64/GoogleNavigation.framework/Headers/GMSNavigationTypes.h", import.meta.url), "utf8");
  const format = header.slice(header.indexOf("typedef NS_ENUM(NSInteger, GMSNavigationRouteCalloutFormat)"), header.indexOf("typedef NS_ENUM(NSInteger, GMSNavigationAlternateRoutesStrategy)"));
  assert.match(format, /GMSNavigationRouteCalloutFormatTime/);
  assert.match(format, /GMSNavigationRouteCalloutFormatDistance/);
  assert.doesNotMatch(format, /None|Hidden|Disabled/);
  assert.doesNotMatch(screen, /routeCalloutFormat|setRouteCallout|navigationFooterEnabled/);
});

test("background road-snap updates run only while guidance and the trip are both active", () => {
  assert.equal(googleBackgroundLocationEnabled({ guiding: true, tripActive: true }), true);
  assert.equal(googleBackgroundLocationEnabled({ guiding: true, tripActive: false }), false);
  assert.equal(googleBackgroundLocationEnabled({ guiding: false, tripActive: true }), false);
  assert.equal(googleBackgroundLocationEnabled(), false);
  const screen = read("google-nav-test-screen.js");
  assert.match(screen, /setBackgroundLocationUpdatesEnabled/);
  assert.match(screen, /googleBackgroundLocationEnabled\(\{ guiding, tripActive \}\)/);
  assert.match(screen, /setRoadSnapBackground\(false\); onStopTrip\(\)/);
  const end = screen.slice(screen.indexOf("async function endRoute"), screen.indexOf("function showLocation"));
  assert.match(end, /setRoadSnapBackground\(false\)/);
  assert.doesNotMatch(screen, /simulateLocations|GMSLocationSimulator/);
});

test("navtest shares the 250 m camera skip between foreground and background", () => {
  resetNavtestCameraSpeech();
  assert.equal(skipSharedNavtestSpeech({ id: "pl-1", distance: 300 }), false);
  noteNavtestCameraSpeech({ id: "pl-1", distance: 400 });
  assert.equal(skipSharedNavtestSpeech({ id: "pl-1", distance: 280 }), true);
  assert.equal(skipSharedNavtestSpeech({ id: "pl-1", distance: 140 }), false);
  assert.equal(skipRepeatedCameraSpeech({ id: "pl-1", distance: 400 }, { id: "pl-1", distance: 280 }), true);
  noteNavtestCameraSpeech({ id: "ua-9", distance: 500 });
  assert.equal(skipSharedNavtestSpeech({ id: "ua-9", distance: 460 }), true);
  resetNavtestCameraSpeech();
  assert.equal(skipSharedNavtestSpeech({ id: "ua-9", distance: 460 }), false);
  const app = read("App.js");
  const background = app.slice(app.indexOf("async function processBackgroundLocation"), app.indexOf("function storedCountryCodes"));
  const shared = background.indexOf("isGoogleNavTestApp() && skipSharedNavtestSpeech");
  const noted = background.indexOf("isGoogleNavTestApp()) noteNavtestCameraSpeech");
  assert.ok(shared > 0 && noted > shared);
  const warning = app.slice(app.indexOf("function speakWarning"), app.indexOf("async function startTracking"));
  const last = warning.indexOf("last.distance - cam.distance < 250");
  const sharedWarning = warning.indexOf("isGoogleNavTestApp() && skipSharedNavtestSpeech");
  assert.ok(last > 0 && sharedWarning > last);
  const stopping = app.slice(app.indexOf("function stopTracking"), app.indexOf("const backgroundBusy"));
  assert.match(stopping, /stopLocationUpdatesAsync\(BACKGROUND_LOCATION_TASK\)|stopBackground\(\)/);
  assert.match(stopping, /resetNavtestCameraSpeech\(\)/);
});

test("search, route, buttons, and warnings have RU UK EN and PL copy", () => {
  const screen = read("google-nav-test-screen.js");
  for (const text of ["Куда едем?", "Куди їдемо?", "Where to?", "Dokąd jedziemy?", "В путь", "У дорогу", "Start guidance", "W drogę", "Завершить маршрут", "Завершити маршрут", "End route", "Zakończ trasę"]) {
    assert.match(screen, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const app = read("App.js");
  for (const text of ["Поездка", "Поїздка", "Drive", "Jazda", "Рядом", "Поруч", "Nearby", "W pobliżu", "Настройки", "Налаштування", "Settings", "Ustawienia"]) {
    assert.match(app, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const labels = app.slice(app.indexOf("function cameraTypeLabel"), app.indexOf("function LawsPage"));
  for (const text of ["Камера скорости", "Камера швидкості", "Speed camera", "Fotoradar"]) {
    assert.match(labels, new RegExp(text));
  }
});
