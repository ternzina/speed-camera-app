import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  FALLBACK_MAP_REGION,
  canBuildRoute,
  centerPick,
  finitePoint,
  formatCoordinates,
  movedEnough,
  openingRegion,
  placeNameFromGeocode,
} from "../../route-map-pick.js";

const kyiv = { latitude: 50.4501, longitude: 30.5234 };

test("the map opens on a real fix and does not invent one", () => {
  const withFix = openingRegion(kyiv);
  assert.equal(withFix.followsUser, true);
  assert.equal(withFix.region.latitude, kyiv.latitude);
  assert.equal(withFix.region.longitude, kyiv.longitude);
  const withoutFix = openingRegion(null);
  assert.equal(withoutFix.followsUser, false);
  assert.deepEqual(withoutFix.region, FALLBACK_MAP_REGION);
  assert.equal(finitePoint({ latitude: 100, longitude: 0 }), false);
});

test("the center becomes the destination only after a real fix or a move", () => {
  const region = { latitude: 50.45, longitude: 30.52 };
  assert.equal(centerPick(region, { userMoved: false, openedOnFix: false, routeLocked: false }), null);
  assert.equal(centerPick(FALLBACK_MAP_REGION, { routeLocked: true, userMoved: true }), null);
  assert.deepEqual(centerPick(region, { openedOnFix: true }), { latitude: 50.45, longitude: 30.52 });
  assert.deepEqual(centerPick(region, { userMoved: true }), { latitude: 50.45, longitude: 30.52 });
});

test("a missing address still leaves a routable point", () => {
  assert.equal(placeNameFromGeocode(null), "");
  assert.equal(placeNameFromGeocode({}), "");
  assert.equal(placeNameFromGeocode({ name: "Хрещатик", street: "Хрещатик", city: "Київ" }), "Хрещатик, Київ");
  assert.equal(canBuildRoute(kyiv), true);
  assert.equal(canBuildRoute(null), false);
  assert.equal(formatCoordinates(kyiv), "50.45010, 30.52340");
  assert.equal(movedEnough(kyiv, { latitude: 50.45011, longitude: 30.5234 }), false);
  assert.equal(movedEnough(kyiv, { latitude: 50.452, longitude: 30.5234 }), true);
});

test("the route screen is one map, with pick, search, and back", () => {
  const screen = fs.readFileSync(new URL("../../ios-route-screen.js", import.meta.url), "utf8");
  assert.equal((screen.match(/<MapView/g) || []).length, 1);
  assert.match(screen, /Построить маршрут/);
  assert.match(screen, /Моё местоположение/);
  assert.match(screen, /Отменить точку/);
  assert.match(screen, /Назад/);
  assert.match(screen, /Вести в CamAlert/);
  assert.match(screen, /onStartGuidance\(packed\)/);
  assert.match(screen, /searchPlaces\(/);
  assert.match(screen, /calculateRoutes\(/);
  assert.doesNotMatch(screen, /MKLocalSearch/);
  assert.doesNotMatch(screen, /numberOfLines=\{1\}/);
  const choose = screen.slice(screen.indexOf("function choosePlace"), screen.indexOf("async function buildRoute"));
  assert.doesNotMatch(choose, /calculateRoutes/);
  const build = screen.slice(screen.indexOf("async function buildRoute"), screen.indexOf("function chooseRoute"));
  assert.match(build, /calculateRoutes/);
  assert.doesNotMatch(screen, /startTracking|stopTracking/);
});
