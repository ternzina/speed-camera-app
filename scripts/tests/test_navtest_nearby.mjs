import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  NEARBY_CATEGORIES, NEARBY_COPY, NEARBY_FIELD_MASK, NEARBY_MAX_RESULTS, NEARBY_RADIUS_M,
  NAVTEST_BUNDLE, PLACES_NEARBY_URL, createNearbyController, formatNearbyDistance, nearbyCategory, nearbyCopy,
  nearbyFix, nearbyHandoff, nearbyPlaces, nearbySearchStep, parseNearbyPlaces,
} from "../../google-places.js";

const root = new URL("../../", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");

const ORIGIN = { latitude: 50.45, longitude: 30.5234 };

function place(id, extra = {}) {
  return {
    id,
    displayName: { text: extra.name || `Place ${id}` },
    formattedAddress: extra.address,
    location: { latitude: extra.latitude ?? 50.451, longitude: extra.longitude ?? 30.5234 },
    rating: extra.rating,
  };
}

test("place categories use Places API (New) table A types and cameras stays local", () => {
  assert.deepEqual(NEARBY_CATEGORIES.map(item => item.id), ["gas", "parking", "food", "repair", "hospital", "pharmacy", "cameras"]);
  assert.equal(nearbyCategory("cameras").types, undefined);
  assert.deepEqual(nearbyCategory("gas").types, ["gas_station"]);
  assert.deepEqual(nearbyCategory("parking").types, ["parking"]);
  assert.deepEqual(nearbyCategory("food").types, ["cafe", "restaurant"]);
  assert.deepEqual(nearbyCategory("repair").types, ["car_repair", "tire_shop"]);
  assert.deepEqual(nearbyCategory("hospital").types, ["hospital"]);
  assert.deepEqual(nearbyCategory("pharmacy").types, ["pharmacy"]);
  assert.equal(nearbyCategory("unknown"), null);
});

test("category labels and every nearby message exist in four languages", () => {
  const keys = ["title", "gas", "parking", "food", "repair", "hospital", "pharmacy", "cameras", "go", "loading", "empty", "error", "timeout", "denied", "settings", "retry", "replaceTitle", "replaceBody", "replace", "cancel", "meters", "km"];
  assert.deepEqual(Object.keys(NEARBY_COPY).sort(), ["en", "pl", "ru", "uk"]);
  for (const language of ["ru", "uk", "en", "pl"]) {
    const copy = nearbyCopy(language);
    for (const key of keys) {
      assert.equal(typeof copy[key], "string");
      assert.ok(copy[key].length > 0);
    }
  }
  assert.equal(nearbyCopy("ru").title, "Рядом");
  assert.equal(nearbyCopy("uk").title, "Поруч");
  assert.equal(nearbyCopy("en").title, "Nearby");
  assert.equal(nearbyCopy("pl").title, "W pobliżu");
  assert.equal(nearbyCopy("ru").go, "Поехать");
  assert.equal(nearbyCopy("en").food, "Cafes and restaurants");
  assert.equal(nearbyCopy("en").repair, "Car repair and tire service");
  assert.equal(nearbyCopy("de"), nearbyCopy("ru"));
  assert.equal(nearbyCopy("ru").gas, "АЗС");
  assert.equal(nearbyCopy("uk").gas, "АЗС");
  assert.equal(nearbyCopy("pl").gas, "Stacja paliw");
  assert.equal(nearbyCopy("ru").timeout, "Поиск не ответил. Проверьте сеть и повторите");
  assert.equal(nearbyCopy("en").timeout, "The search did not answer. Check the network and try again");
  assert.equal(nearbyCopy("ru").cameras, "Камеры рядом");
  assert.equal(nearbyCopy("uk").cameras, "Камери поруч");
  assert.equal(nearbyCopy("en").cameras, "Nearby cameras");
  assert.equal(nearbyCopy("pl").cameras, "Kamery w pobliżu");
});

test("a granted fix can search and a denied or missing fix cannot", () => {
  assert.deepEqual(nearbyFix("granted", ORIGIN), { ok: true, latitude: 50.45, longitude: 30.5234 });
  assert.deepEqual(nearbyFix("denied", ORIGIN), { ok: false, reason: "denied" });
  assert.deepEqual(nearbyFix("undetermined", ORIGIN), { ok: false, reason: "waiting" });
  assert.equal(nearbyFix("granted", null).reason, "waiting");
  assert.equal(nearbyFix("granted", { latitude: Number.NaN, longitude: 0 }).reason, "waiting");
  assert.equal(nearbySearchStep("granted", ORIGIN).step, "search");
  assert.equal(nearbySearchStep("denied", ORIGIN).step, "denied");
  assert.equal(nearbySearchStep("granted", null).step, "locate");
  assert.equal(nearbySearchStep("unknown", null).step, "locate");
});

function okFetch(payload) {
  return async () => ({ ok: true, json: async () => payload });
}

test("a place search uses the current fix and does not ask for another one", async () => {
  let located = 0;
  const result = await createNearbyController().search({
    categoryId: "gas",
    permission: "granted",
    coords: ORIGIN,
    languageCode: "ru",
    key: "test-key",
    fetch: okFetch({ places: [place("station", { name: "АЗС", address: "вул. Тестова, 1" })] }),
    locate: () => { located += 1; },
  });
  assert.equal(located, 0);
  assert.equal(result.status, "ready");
  assert.equal(result.places[0].name, "АЗС");
  assert.equal(result.places[0].address, "вул. Тестова, 1");
  assert.equal("rating" in result.places[0], false);
  assert.ok(result.places[0].distance >= 0);
});

test("without a trip fix the search takes one location read and then one request", async () => {
  const calls = [];
  let located = 0;
  const result = await createNearbyController().search({
    categoryId: "gas",
    permission: "unknown",
    coords: null,
    languageCode: "uk",
    key: "test-key",
    locate: async () => {
      located += 1;
      return { permission: "granted", latitude: 50.45, longitude: 30.5234 };
    },
    fetch: async (url, options) => {
      calls.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ places: [place("station", { name: "АЗС", address: "вул. Тестова, 1" })] }) };
    },
  });
  assert.equal(located, 1);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].includedTypes, ["gas_station"]);
  assert.equal(calls[0].locationRestriction.circle.center.latitude, 50.45);
  assert.equal(result.status, "ready");
  assert.equal(result.places[0].name, "АЗС");
});

test("a denied location never calls the network", async () => {
  let called = 0;
  const result = await createNearbyController().search({
    categoryId: "pharmacy",
    permission: "denied",
    coords: ORIGIN,
    key: "test-key",
    fetch: () => { called += 1; },
    locate: () => { called += 1; },
  });
  assert.equal(called, 0);
  assert.equal(result.status, "denied");
  assert.deepEqual(result.places, []);
});

test("a network error ends the search without inventing places", async () => {
  const result = await createNearbyController().search({
    categoryId: "hospital",
    permission: "granted",
    coords: ORIGIN,
    key: "test-key",
    fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    locate: () => { throw new Error("no locate"); },
  });
  assert.equal(result.status, "error");
  assert.deepEqual(result.places, []);
});

test("a request that never settles ends as a timeout", async () => {
  const result = await createNearbyController().search({
    categoryId: "gas",
    permission: "granted",
    coords: ORIGIN,
    key: "test-key",
    timeoutMs: 20,
    fetch: () => new Promise(() => {}),
    locate: () => { throw new Error("no locate"); },
  });
  assert.equal(result.status, "timeout");
  assert.deepEqual(result.places, []);
});

test("opening the same category again replaces the hung request", async () => {
  const controller = createNearbyController();
  let fetches = 0;
  const first = controller.search({
    categoryId: "gas",
    permission: "granted",
    coords: ORIGIN,
    key: "test-key",
    fetch: (_url, options) => new Promise((_resolve, reject) => {
      fetches += 1;
      options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError", code: "aborted" })));
    }),
    locate: () => { throw new Error("no locate"); },
  });
  const second = controller.search({
    categoryId: "gas",
    permission: "granted",
    coords: { latitude: 50.451, longitude: 30.524 },
    key: "test-key",
    fetch: okFetch({ places: [place("next", { name: "Друга АЗС", address: "вул. Друга, 2", latitude: 50.452 })] }),
    locate: () => { throw new Error("no locate"); },
  });
  const [stale, fresh] = await Promise.all([first, second]);
  assert.equal(stale.status, "stale");
  assert.equal(fresh.status, "ready");
  assert.equal(fresh.places[0].name, "Друга АЗС");
  assert.equal(fetches, 1);
  assert.equal(fresh.places.length, 1);
});

test("nearby search uses one fixture request and keeps only real fields", async () => {
  const calls = [];
  const payload = {
    places: [
      place("real", { name: "АЗС", address: "вул. Тестова, 1", rating: 4.2, latitude: 50.451, longitude: 30.5234 }),
      { id: "no-name", location: { latitude: 50.45, longitude: 30.52 }, displayName: { text: "  " } },
      { id: "", displayName: { text: "Без id" }, location: { latitude: 50.45, longitude: 30.52 } },
      { id: "bad-point", displayName: { text: "Без точки" } },
      { id: "text-rating", displayName: { text: "Без оценки" }, location: { latitude: 50.452, longitude: 30.53 }, rating: "5", formattedAddress: 12 },
      ...Array.from({ length: 12 }, (_, index) => place(`extra-${index}`, { latitude: 50.46 + index / 1000 })),
    ],
  };
  const found = await nearbyPlaces({
    categoryId: "food",
    latitude: ORIGIN.latitude,
    longitude: ORIGIN.longitude,
    languageCode: "uk",
    key: "test-key",
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => payload };
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, PLACES_NEARBY_URL);
  assert.equal(calls[0].url, "https://places.googleapis.com/v1/places:searchNearby");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["X-Goog-Api-Key"], "test-key");
  assert.equal(calls[0].options.headers["X-Goog-FieldMask"], NEARBY_FIELD_MASK);
  assert.equal(calls[0].options.headers["X-Ios-Bundle-Identifier"], NAVTEST_BUNDLE);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    includedTypes: ["cafe", "restaurant"],
    maxResultCount: NEARBY_MAX_RESULTS,
    rankPreference: "DISTANCE",
    languageCode: "uk",
    locationRestriction: { circle: { center: ORIGIN, radius: NEARBY_RADIUS_M } },
  });
  assert.equal(found.length, NEARBY_MAX_RESULTS);
  assert.equal(found[0].name, "АЗС");
  assert.equal(found[0].address, "вул. Тестова, 1");
  assert.equal("rating" in found[0], false);
  assert.equal(calls[0].options.headers["X-Goog-FieldMask"].includes("rating"), false);
  assert.ok(found[0].distance > 0);
  assert.equal(found.some(item => item.id === "no-name" || item.id === "bad-point"), false);
  const unrated = found.find(item => item.id === "text-rating");
  assert.equal("rating" in unrated, false);
  assert.equal(unrated.address, "");
  assert.equal(JSON.stringify(found).includes("invented"), false);
});

test("no results, a network failure, and a missing key do not invent places", async () => {
  const empty = await nearbyPlaces({
    categoryId: "pharmacy",
    ...ORIGIN,
    languageCode: "pl",
    key: "test-key",
    fetch: async () => ({ ok: true, json: async () => ({ places: [] }) }),
  });
  assert.deepEqual(empty, []);
  await assert.rejects(
    () => nearbyPlaces({
      categoryId: "hospital",
      ...ORIGIN,
      key: "test-key",
      fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    }),
    error => error.code === "places-failed",
  );
  await assert.rejects(
    () => nearbyPlaces({
      categoryId: "gas",
      ...ORIGIN,
      key: "test-key",
      fetch: async () => { throw new Error("offline"); },
    }),
    error => error.message === "offline",
  );
  let called = false;
  await assert.rejects(
    () => nearbyPlaces({ categoryId: "parking", ...ORIGIN, key: "", fetch: () => { called = true; } }),
    error => error.code === "missing-key",
  );
  assert.equal(called, false);
  let cameraCalled = false;
  await assert.rejects(
    () => nearbyPlaces({ categoryId: "cameras", ...ORIGIN, key: "test-key", fetch: () => { cameraCalled = true; } }),
    error => error.code === "places-failed",
  );
  assert.equal(cameraCalled, false);
  assert.deepEqual(parseNearbyPlaces({ places: [{ id: "x", displayName: { text: "X" }, location: { latitude: "50.4", longitude: "30.5" }, distanceMeters: 12 }] }, ORIGIN)[0].name, "X");
  assert.equal(parseNearbyPlaces({ places: [{ id: "x", displayName: { text: "X" }, location: { latitude: "50.4", longitude: "30.5" } }] }, null)[0].distance, null);
});

test("distance is calculated from the current fix and omitted when it is not finite", () => {
  assert.match(formatNearbyDistance(240, "ru"), /^240 м$/);
  assert.match(formatNearbyDistance(1500, "en"), /^1\.5 km$/);
  assert.equal(formatNearbyDistance(Number.NaN, "pl"), "");
  assert.equal(formatNearbyDistance(-1, "uk"), "");
});

test("going to a place opens the existing route or asks before replacing it", () => {
  const placePoint = { id: "p1", name: "Аптека", latitude: 50.46, longitude: 30.51, rating: null };
  assert.deepEqual(nearbyHandoff(placePoint, false), {
    action: "open",
    destination: { lat: 50.46, lng: 30.51, title: "Аптека" },
  });
  assert.equal(nearbyHandoff(placePoint, true).action, "confirm");
  assert.equal(nearbyHandoff({ name: "без точки" }, false).action, "ignore");
});

test("navtest nearby is list-only and hands the chosen point to the existing Google route", () => {
  const app = read("App.js");
  const screen = read("google-nav-test-screen.js");
  const nearby = read("navtest-nearby.js");
  const places = read("google-places.js");
  const handoff = app.slice(app.indexOf("function handoffNearbyPlace"), app.indexOf("function openInAppRoute"));
  const effect = screen.slice(screen.indexOf("if (!handoff || handoff.token"), screen.indexOf("function dismissSearch"));
  const build = screen.slice(screen.indexOf("function buildRoute"), screen.indexOf("function startGuidance"));
  assert.match(app, /tab === "nearby" && usesInAppGoogleNav\(\) && \([\s\S]*<NavtestNearby/);
  assert.match(app, /navtestNearbyKind === "cameras"/);
  assert.match(app, /onKind=\{setNavtestNearbyKind\}/);
  assert.match(nearby, /status === "cameras"|!nearbyCategory\(id\)\?\.types/);
  assert.doesNotMatch(nearby, /rating/);
  assert.doesNotMatch(places, /rating/);
  assert.match(app, /tab === "nearby" && \(!usesInAppGoogleNav\(\) \|\| navtestNearbyKind === "cameras"\) && cameraWarningsEnabled\(settings\)/);
  assert.match(app, /Камеры рядом/);
  assert.match(app, /usesInAppGoogleNav\(\) \? t\.nearby : nearbyCopy\.title/);
  assert.match(handoff, /nearbyHandoff\(place, navtestRouteActiveRef\.current\)/);
  assert.match(handoff, /Alert\.alert/);
  assert.match(handoff, /setIosRouteOpen\(true\)/);
  assert.doesNotMatch(handoff, /startTracking|Linking|calculateRoutes|maps\.google|startGuidance/);
  assert.match(effect, /buildRoute\(\{ lat, lng, title: handoff\.title \}\)/);
  assert.doesNotMatch(effect, /startGuidance\(/);
  assert.match(build, /setDestination\(/);
  assert.match(build, /position: \{ lat: next\.lat, lng: next\.lng \}/);
  assert.match(screen, /subscribeCameraSpeech/);
  assert.match(screen, /styles\.camera/);
  assert.match(app, /averageSectionSpeech/);
  assert.match(app, /if \(foregroundTripRunning \|\| sub\.current\) return true/);
  assert.doesNotMatch(nearby, /MapView|react-native-maps|places\.googleapis|AIza|console\.log/);
  assert.equal(nearby.match(/createNearbyController\(/g).length, 1);
  assert.match(places, /runNearbySearch\(/);
  assert.match(nearby, /getCurrentPositionAsync/);
  assert.doesNotMatch(nearby, /watchPositionAsync|startTracking|point\.latitude/);
  assert.match(nearby, /status === "timeout"/);
  assert.match(nearby, /status === "denied"/);
  assert.match(nearby, /status === "empty"/);
  assert.match(nearby, /status === "error"/);
  assert.match(nearby, /status === "loading"/);
  assert.doesNotMatch(places, /AIza|GOOGLE_MAPS_ANDROID_API_KEY|MKDirections/);
  assert.match(places, /places:searchNearby/);
  assert.doesNotMatch(screen, /places\.googleapis|fetch\(/);
});
