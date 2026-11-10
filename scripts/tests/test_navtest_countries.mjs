import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { countryFeedsAfterDelivery, navtestCountryDownload, navtestCountryReady, navtestStoredCountryCodes } from "../../navtest-country-store.js";

const shaHref = new URL("../../sha256.js", import.meta.url).href;
function loadModule(name) {
  const source = fs.readFileSync(new URL(`../../${name}`, import.meta.url), "utf8")
    .replaceAll("from './sha256'", `from ${JSON.stringify(shaHref)}`);
  return import(`data:text/javascript,${encodeURIComponent(source)}`);
}
const { loadCameraCache, saveCameraCache, countryFeed } = await loadModule("camera-data.js");
const { CAMERA_DELIVERY_URL, CAMERA_MANIFEST_PATH, refreshCountryDelivery } = await loadModule("camera-delivery.js");
const { sha256, utf8Bytes } = await import("../../sha256.js");

function memory() {
  const values = new Map();
  return {
    values,
    async getItem(key) { return values.has(key) ? values.get(key) : null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
}

function body(code, limit = 50) {
  return {
    schema_version: 1,
    country: code,
    speed_cameras: [{ id: `${code}-1`, latitude: 50, longitude: 20, speed_limit: limit }],
    red_light_cameras: [],
    checkpoints: [],
    average_speed_sections: [],
  };
}

function published(code) {
  const feed = {
    schema_version: 1,
    country: code,
    record_count: 1,
    speed_cameras: [{ id: `${code}-1`, latitude: 52.5, longitude: 13.4, speed_limit: 80 }],
    red_light_cameras: [],
    checkpoints: [],
    average_speed_sections: [],
  };
  const text = JSON.stringify(feed);
  const checksum = sha256(text);
  const entry = {
    country_code: code,
    record_count: 1,
    size_bytes: utf8Bytes(text).length,
    checksum,
    version: checksum,
    path: `production/v1/countries/${code}/${checksum}.json`,
  };
  return { text, entry };
}

test("an empty cache stores no countries", () => {
  assert.deepEqual(navtestStoredCountryCodes(null), []);
  assert.deepEqual(navtestStoredCountryCodes({}), []);
  assert.deepEqual(navtestStoredCountryCodes({ UA: undefined, PL: undefined }), []);
  assert.equal(navtestCountryDownload({}, "DE"), "download");
});

test("one saved country counts, and a second can be downloaded", () => {
  const de = body("DE");
  const feeds = { DE: de };
  assert.deepEqual(navtestStoredCountryCodes(feeds), ["DE"]);
  assert.equal(navtestCountryDownload(feeds, "DE"), "saved");
  assert.equal(navtestCountryDownload(feeds, "FR"), "download");
  const next = countryFeedsAfterDelivery(feeds, "FR", { feed: body("FR"), source: "r2" });
  assert.deepEqual(navtestStoredCountryCodes(next), ["DE", "FR"]);
  assert.equal(next.DE, de);
});

test("two saved countries block a third and keep both bodies", () => {
  const de = body("DE");
  const fr = body("FR");
  const feeds = { DE: de, FR: fr };
  assert.deepEqual(navtestStoredCountryCodes(feeds), ["DE", "FR"]);
  assert.equal(navtestCountryDownload(feeds, "IT"), "limit");
  const blocked = countryFeedsAfterDelivery(feeds, "IT", { feed: body("IT"), source: "r2" });
  assert.equal(blocked, feeds);
  assert.equal(blocked.DE, de);
  assert.equal(blocked.FR, fr);
  assert.equal(blocked.IT, undefined);
});

test("a catalog entry with no downloaded body is not stored", () => {
  const catalog = [
    { country_code: "DE", record_count: 10 },
    { country_code: "IT", record_count: 4 },
  ];
  const feeds = { DE: body("DE"), IT: catalog[1] };
  assert.deepEqual(navtestStoredCountryCodes(feeds), ["DE"]);
  assert.equal(catalog.some(entry => entry.country_code === "IT"), true);
  assert.equal(navtestCountryDownload(feeds, "IT"), "download");
});

test("a network error keeps the last good body and does not save a failed country", async () => {
  const de = body("DE");
  const feeds = { DE: de };
  const offline = async () => { throw new Error("offline"); };
  const failedNew = await refreshCountryDelivery({ country: "FR", feeds, fetcher: offline });
  assert.equal(failedNew.source, "bundled");
  assert.equal(failedNew.feed, null);
  const unchanged = countryFeedsAfterDelivery(feeds, "FR", failedNew);
  assert.equal(unchanged, feeds);
  assert.equal(unchanged.FR, undefined);

  const failedSaved = await refreshCountryDelivery({ country: "DE", feeds, versions: {}, fetcher: offline });
  assert.equal(failedSaved.source, "offline");
  assert.equal(failedSaved.feed, de);
  const kept = countryFeedsAfterDelivery(feeds, "DE", { feed: body("DE", 999), source: "offline" });
  assert.equal(kept, feeds);
  assert.equal(kept.DE, de);
  assert.equal(kept.DE.speed_cameras[0].speed_limit, 50);
});

test("a restart reads the saved bodies and ignores a catalog country and a broken body", async () => {
  const storage = memory();
  const countries = [{ country_code: "DE" }, { country_code: "FR" }, { country_code: "IT" }];
  await saveCameraCache(storage, "camera_remote_cache_v081", {
    feeds: { DE: body("DE"), FR: body("FR") },
    countries,
    countryVersions: { DE: "de", FR: "fr" },
  }, "DE");
  const loaded = await loadCameraCache(storage, "camera_remote_cache_v081");
  assert.deepEqual(navtestStoredCountryCodes(loaded.feeds), ["DE", "FR"]);
  assert.equal(loaded.countries.some(entry => entry.country_code === "IT"), true);
  assert.equal(navtestStoredCountryCodes(loaded.feeds).includes("IT"), false);

  const index = JSON.parse(storage.values.get("camera_remote_cache_v081"));
  storage.values.set(`${index.feedChunks.FR.prefix}:0`, "broken");
  const restarted = await loadCameraCache(storage, "camera_remote_cache_v081");
  assert.deepEqual(navtestStoredCountryCodes(restarted.feeds), ["DE"]);
  assert.equal(restarted.feeds.DE.speed_cameras[0].id, "DE-1");
});

test("changing country still downloads that file from the existing worker address", async () => {
  const de = published("DE");
  const manifest = {
    schema_version: 1,
    generated_at: "2026-10-13T00:00:00Z",
    total_records: 1,
    countries: [de.entry],
  };
  const urls = [];
  const fetcher = async url => {
    urls.push(String(url));
    const text = String(url).endsWith("manifest.json") ? JSON.stringify(manifest) : de.text;
    return { ok: true, headers: { get: () => null }, text: async () => text };
  };
  const result = await refreshCountryDelivery({ country: "DE", feeds: {}, countries: [], fetcher });
  assert.equal(result.source, "r2");
  assert.deepEqual(urls, [
    `${CAMERA_DELIVERY_URL}${CAMERA_MANIFEST_PATH}`,
    `${CAMERA_DELIVERY_URL}/${de.entry.path}`,
  ]);
  const saved = countryFeedsAfterDelivery({}, "DE", result);
  assert.deepEqual(navtestStoredCountryCodes(saved), ["DE"]);
  assert.equal(saved.DE.speed_cameras[0].speed_limit, 80);
});

test("with no saved body the bundled Ukraine and Poland files remain usable", () => {
  const bundledUA = { cameras: [{ id: "ua", latitude: 50, longitude: 30 }] };
  const bundledPL = { speed_cameras: [{ id: "pl", latitude: 52, longitude: 21 }] };
  assert.equal(countryFeed({}, "UA", bundledUA, bundledPL), bundledUA);
  assert.equal(countryFeed({}, "PL", bundledUA, bundledPL), bundledPL);
  assert.equal(countryFeed({}, "DE", bundledUA, bundledPL).speed_cameras.length, 0);
  assert.equal(navtestCountryReady({}, "UA", bundledUA.cameras), true);
  assert.equal(navtestCountryReady({}, "DE", []), false);
  assert.equal(navtestStoredCountryCodes({}).includes("UA"), false);
});

test("the production counter still counts bundled Ukraine and Poland without a body", () => {
  const app = fs.readFileSync(new URL("../../App.js", import.meta.url), "utf8");
  const fn = app.slice(app.indexOf("function storedCountryCodes"), app.indexOf("function selectedDatabaseReady"));
  assert.match(fn, /if \(isGoogleNavTestApp\(\)\) return navtestStoredCountryCodes\(feeds\);/);
  assert.match(fn, /return \[\.\.\.new Set\(\["UA", "PL", \.\.\.Object\.keys\(feeds\)\]\)\]/);
  assert.match(fn, /return !!feed \|\| code === "UA" \|\| code === "PL";/);
  const refresh = app.slice(app.indexOf("async function refreshRemoteData"), app.indexOf("function confirmRemoveDatabase"));
  assert.match(refresh, /refreshCountryDelivery\(\{country,feeds:remoteFeedsRef\.current/);
  assert.match(refresh, /countryFeedsAfterDelivery\(remoteFeedsRef\.current, country, result\)/);
  assert.match(refresh, /!result\.feed \|\| result\.source==='offline' \|\| result\.source==='bundled'/);
});
