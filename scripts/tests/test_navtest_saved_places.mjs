import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  SAVED_PLACES_KEY, addFavorite, assignSavedSlot, clearSavedSlot, emptySavedPlaces, loadSavedPlaces,
  normalizeSavedPlace, parseSavedPlaces, removeFavorite, savedPlaceCopy, savedPlaceFromNearby,
  savedPlaceFromSuggestion, savedPlaceRoute, storeSavedPlaces,
} from "../../navtest-saved-places.js";

const root = new URL("../../", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");

const HOME = { name: "Дом на Подоле", address: "ул. Хорива, 1", latitude: 50.4701, longitude: 30.5142, placeId: "home-place" };
const WORK = { name: "Офис", address: "ул. Крещатик, 10", latitude: 50.4476, longitude: 30.522, placeId: "work-place" };
const CAFE = { name: "Кафе", address: "ул. Сагайдачного, 4", latitude: 50.462, longitude: 30.518, placeId: "cafe-place" };

function memory(seed = {}) {
  const items = { ...seed };
  const writes = [];
  return {
    items,
    writes,
    async getItem(key) {
      return Object.prototype.hasOwnProperty.call(items, key) ? items[key] : null;
    },
    async setItem(key, value) {
      writes.push(key);
      items[key] = value;
    },
  };
}

test("the first Home and Work save stores name, address, coordinates, and place id", () => {
  let store = emptySavedPlaces();
  store = assignSavedSlot(store, "home", HOME);
  store = assignSavedSlot(store, "work", WORK);
  assert.deepEqual(store.home, HOME);
  assert.deepEqual(store.work, WORK);
  assert.deepEqual(store.favorites, []);
  assert.deepEqual(assignSavedSlot(store, "home", { name: "без точки" }).home, HOME);
});

test("changing a saved place replaces that slot and leaves the other", () => {
  const saved = assignSavedSlot(assignSavedSlot(emptySavedPlaces(), "home", HOME), "work", WORK);
  const nextHome = { ...HOME, name: "Новый дом", address: "ул. Набережно-Крещатицкая, 3", latitude: 50.469, longitude: 30.52, placeId: "home-2" };
  const changed = assignSavedSlot(saved, "home", nextHome);
  assert.deepEqual(changed.home, nextHome);
  assert.deepEqual(changed.work, WORK);
});

test("deleting Home or Work clears only that slot", () => {
  const saved = assignSavedSlot(assignSavedSlot(emptySavedPlaces(), "home", HOME), "work", WORK);
  const cleared = clearSavedSlot(saved, "home");
  assert.equal(cleared.home, null);
  assert.deepEqual(cleared.work, WORK);
  assert.deepEqual(clearSavedSlot(cleared, "garage").work, WORK);
});

test("a favorite from search keeps the returned fields and skips a duplicate place id", () => {
  const suggestion = { title: "Кафе", address: "ул. Сагайдачного, 4", placeId: "cafe-place" };
  const located = { lat: 50.462, lng: 30.518 };
  const place = savedPlaceFromSuggestion(suggestion, located);
  assert.deepEqual(place, CAFE);
  const first = addFavorite(emptySavedPlaces(), place);
  assert.equal(first.added, true);
  assert.deepEqual(first.store.favorites, [CAFE]);
  const again = addFavorite(first.store, { ...CAFE, name: "Другое имя", latitude: 1, longitude: 2 });
  assert.equal(again.added, false);
  assert.equal(again.reason, "duplicate");
  assert.equal(again.store.favorites.length, 1);
  assert.equal(addFavorite(first.store, { name: "" }).reason, "invalid");
});

test("a favorite from Nearby uses the place id and skips the same id", () => {
  const nearby = { id: "near-1", name: "Аптека", address: "ул. Межигорская, 2", latitude: 50.466, longitude: 30.511 };
  const place = savedPlaceFromNearby(nearby);
  assert.equal(place.placeId, "near-1");
  assert.equal(place.name, "Аптека");
  const first = addFavorite(emptySavedPlaces(), place);
  const duplicate = addFavorite(first.store, { ...nearby, name: "Аптека 2" });
  assert.equal(duplicate.added, false);
  assert.equal(duplicate.store.favorites.length, 1);
});

test("a place without a place id is a duplicate only when the name and coordinates match", () => {
  const first = { name: "Точка", address: "", latitude: 50.45, longitude: 30.52, placeId: "" };
  const saved = addFavorite(emptySavedPlaces(), first).store;
  assert.equal(addFavorite(saved, { ...first, address: "другой адрес" }).added, false);
  assert.equal(addFavorite(saved, { ...first, name: "Другая точка" }).added, true);
  assert.equal(addFavorite(saved, { ...first, latitude: 50.46 }).added, true);
  const withId = addFavorite(saved, { ...first, placeId: "later-id" });
  assert.equal(withId.added, true);
  assert.equal(withId.store.favorites.length, 2);
});

test("saved places survive a restart and do not touch other storage keys", async () => {
  const storage = memory({
    camera_settings_v060: "{\"voice\":true}",
    camera_history_v060: "[1]",
    camalert_onboarding_v1: "done",
  });
  let store = assignSavedSlot(emptySavedPlaces(), "home", HOME);
  store = assignSavedSlot(store, "work", WORK);
  store = addFavorite(store, CAFE).store;
  store = addFavorite(store, { name: "Без id", address: "двор", latitude: 50.4, longitude: 30.5, placeId: "" }).store;
  await storeSavedPlaces(storage, store);
  const restarted = await loadSavedPlaces(storage);
  assert.deepEqual(restarted.home, HOME);
  assert.deepEqual(restarted.work, WORK);
  assert.equal(restarted.favorites.length, 2);
  assert.equal(restarted.favorites[0].placeId, "cafe-place");
  assert.equal(restarted.favorites[1].placeId, "");
  assert.deepEqual(storage.writes, [SAVED_PLACES_KEY]);
  assert.equal(storage.items.camera_settings_v060, "{\"voice\":true}");
  assert.equal(storage.items.camera_history_v060, "[1]");
  assert.equal(storage.items.camalert_onboarding_v1, "done");
});

test("corrupt or old saved data becomes an empty book and does not throw", async () => {
  assert.deepEqual(parseSavedPlaces("{"), emptySavedPlaces());
  assert.deepEqual(parseSavedPlaces("[]"), emptySavedPlaces());
  assert.deepEqual(parseSavedPlaces(null), emptySavedPlaces());
  assert.equal(parseSavedPlaces({ home: "Киев", work: { name: "Офис" }, favorites: "нет", extra: 1 }).home, null);
  assert.deepEqual(parseSavedPlaces({ favorites: [{ name: "без точки", placeId: "x" }, CAFE, null, 4] }).favorites, [CAFE]);
  const storage = memory({ camera_settings_v060: "keep", [SAVED_PLACES_KEY]: "{not json" });
  assert.deepEqual(await loadSavedPlaces(storage), emptySavedPlaces());
  assert.equal(storage.items.camera_settings_v060, "keep");
  assert.deepEqual(storage.writes, []);
  const broken = memory();
  broken.getItem = async () => { throw new Error("storage"); };
  assert.deepEqual(await loadSavedPlaces(broken), emptySavedPlaces());
});

test("a saved place hands off to the route and asks before replacing an active one", () => {
  const idle = savedPlaceRoute(HOME, false);
  assert.equal(idle.action, "open");
  assert.deepEqual(idle.destination, { lat: HOME.latitude, lng: HOME.longitude, title: HOME.name, placeId: HOME.placeId });
  assert.equal(savedPlaceRoute(WORK, true).action, "confirm");
  assert.equal(savedPlaceRoute({ name: "пусто" }, false).action, "ignore");
  const removed = removeFavorite(addFavorite(emptySavedPlaces(), CAFE).store, CAFE);
  assert.deepEqual(removed.favorites, []);
  const local = addFavorite(emptySavedPlaces(), { name: "Точка", address: "", latitude: 1, longitude: 2, placeId: "" }).store;
  assert.deepEqual(removeFavorite(local, { name: "Точка", latitude: 1, longitude: 2 }).favorites, []);
});

test("labels, prompts, confirmations, errors, and empty states exist in four languages", () => {
  const keys = ["home", "work", "favorites", "saveHome", "saveWork", "saveFavorite", "change", "delete", "cancel", "close", "replaceTitle", "replaceBody", "replace", "go", "add", "favorite", "empty", "duplicate", "saveFailed"];
  for (const language of ["ru", "uk", "en", "pl"]) {
    const copy = savedPlaceCopy(language);
    for (const key of keys) {
      assert.equal(typeof copy[key], "string");
      assert.ok(copy[key].trim().length > 0, `${language}.${key}`);
    }
  }
  assert.equal(savedPlaceCopy("ru").home, "Дом");
  assert.equal(savedPlaceCopy("uk").home, "Дім");
  assert.equal(savedPlaceCopy("en").home, "Home");
  assert.equal(savedPlaceCopy("pl").home, "Dom");
  assert.equal(savedPlaceCopy("ru").go, "Поехать");
  assert.equal(savedPlaceCopy("uk").go, "Поїхати");
  assert.equal(savedPlaceCopy("en").go, "Go");
  assert.equal(savedPlaceCopy("pl").go, "Jedź");
  assert.equal(savedPlaceCopy("de"), savedPlaceCopy("ru"));
  assert.notEqual(savedPlaceCopy("ru").empty, savedPlaceCopy("uk").empty);
  assert.notEqual(savedPlaceCopy("en").saveFailed, savedPlaceCopy("pl").saveFailed);
});

test("the Drive screen keeps the buttons under the search and routes through the existing destination", () => {
  const screen = read("google-nav-test-screen.js");
  const app = read("App.js");
  const nearby = read("navtest-nearby.js");
  const top = screen.slice(screen.indexOf('remember("top"'), screen.indexOf('remember("bottom"'));
  const bottom = screen.slice(screen.indexOf('remember("bottom"'), screen.indexOf("function MapTools"));
  const open = screen.slice(screen.indexOf("function openSaved"), screen.indexOf("function pressSaved"));
  const remember = screen.slice(screen.indexOf("function rememberChosen"), screen.indexOf("function openSaved"));
  const choose = screen.slice(screen.indexOf("function chooseResult"), screen.indexOf("function startGuidance"));
  const home = app.slice(app.indexOf("function DriveHome"), app.indexOf("function CountriesDataScreen"));
  const map = app.slice(app.indexOf("function BrowseMap"), app.indexOf("function RoadCamerasScreen"));
  const favorite = app.slice(app.indexOf("async function rememberNearbyFavorite"), app.indexOf("async function startRouteGuidance"));
  assert.match(screen, /savedPlaceCopy\(language\)/);
  assert.match(screen, /SystemSafeArea/);
  assert.ok(top.indexOf("placeholder={copy.where}") < top.indexOf("<SavedPlaceBar"));
  assert.ok(top.indexOf("styles.maneuverClearance") < top.indexOf("<SavedPlaceBar"));
  assert.match(top, /windowHeight < 700/);
  assert.doesNotMatch(bottom, /<SavedPlaceBar/);
  assert.match(open, /savedPlaceRoute\(place, routed \|\| guiding\)/);
  assert.match(open, /Alert\.alert\(places\.replaceTitle, places\.replaceBody/);
  assert.match(open, /buildRoute\(decision\.destination\)/);
  assert.doesNotMatch(open, /startGuidance\(/);
  assert.equal(remember.match(/placeDetailsLocation\(/g).length, 1);
  assert.doesNotMatch(remember, /for \(|while \(|startGuidance\(|watchPositionAsync|startTracking/);
  assert.match(choose, /if \(saveSlot\) \{\s*rememberChosen\(saveSlot, result\);\s*return;\s*\}/);
  assert.match(choose, /buildRoute\(\{ lat: result\.lat, lng: result\.lng, title: result\.title, placeId: result\.placeId \}\)/);
  assert.match(screen, /assignSavedSlot\(savedRef\.current, slot, place\)/);
  assert.match(screen, /clearSavedSlot\(savedRef\.current, slot\)/);
  assert.match(screen, /addFavorite\(savedRef\.current, place\)/);
  assert.match(screen, /places\.change/);
  assert.match(screen, /places\.delete/);
  assert.match(screen, /places\.empty/);
  assert.match(screen, /places\.duplicate/);
  assert.match(screen, /places\.saveFailed/);
  assert.doesNotMatch(screen, /AsyncStorage\.(clear|setItem|removeItem)|watchPositionAsync|startTracking|sideButton|fetch\(|places\.googleapis/);
  assert.match(app, /isGoogleNavTestApp\(\) && \(iosRouteOpen \|\| \(tab === "drive" && active\)\)/);
  assert.match(app, /onFavorite=\{rememberNearbyFavorite\}/);
  assert.match(favorite, /addFavorite\(current, savedPlaceFromNearby\(place\)\)/);
  assert.match(favorite, /if \(!isGoogleNavTestApp\(\)\) return/);
  assert.doesNotMatch(favorite, /startTracking|watchPositionAsync|startGuidance|setDestination|AsyncStorage\.clear/);
  const card = nearby.slice(nearby.indexOf('status === "ready"'), nearby.indexOf("const styles"));
  assert.match(card, /onFavorite\?\.\(place\)/);
  assert.match(nearby, /savedPlaceCopy\(language\)/);
  assert.ok(card.indexOf("onFavorite") < card.indexOf("onGo"));
  assert.doesNotMatch(card.slice(card.indexOf("onFavorite"), card.indexOf("onGo")), /onGo|watchPositionAsync|startTracking/);
  assert.doesNotMatch(home, /SavedPlaceBar|savedPlaceCopy|SAVED_PLACES_KEY/);
  assert.doesNotMatch(map, /SavedPlaceBar|savedPlaceCopy|onFavorite/);
  assert.equal(normalizeSavedPlace({ name: "  Дом  ", lat: "50.1", lng: "30.2", placeId: " id " }).placeId, "id");
});
