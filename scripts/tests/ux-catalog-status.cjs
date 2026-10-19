const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const babel = require("@babel/core");

const root = path.resolve(__dirname, "../..");
function load(file) {
  const module = { exports: {} };
  vm.runInNewContext(
    babel.transformSync(fs.readFileSync(path.join(root, file), "utf8"), {
      configFile: false,
      babelrc: false,
      plugins: ["@babel/plugin-transform-modules-commonjs"],
    }).code,
    {
      module,
      exports: module.exports,
      require: name => load(name.replace(/^\.\//, "") + ".js"),
      AbortController,
      setTimeout,
      clearTimeout,
      Uint8Array,
      Uint32Array,
      DataView,
      Set,
      Date,
      console,
    }
  );
  return module.exports;
}

const status = load("catalog-status.js");
const delivery = load("camera-delivery.js");
const hash = load("sha256.js");
const appSource = fs.readFileSync(path.join(root, "App.js"), "utf8");
const published = "2026-10-13T15:35:26.807485+00:00";
const checked = "2026-10-19T17:12:00.000Z";

const unchanged = status.catalogTimestamps({
  source: "cache-current",
  generatedAt: published,
  now: checked,
});
assert.equal(unchanged.publishedAt, published);
assert.equal(unchanged.checkedAt, checked);
assert.equal(unchanged.stamp, published);
assert.notEqual(unchanged.publishedAt, checked);

const downloaded = status.catalogTimestamps({
  source: "r2",
  generatedAt: published,
  previousPublishedAt: "2026-10-01T00:00:00.000Z",
  now: checked,
});
assert.equal(downloaded.publishedAt, published);
assert.equal(downloaded.checkedAt, checked);

const offline = status.catalogTimestamps({
  source: "offline",
  generatedAt: null,
  previousPublishedAt: published,
  previousCheckedAt: checked,
  now: "2026-10-19T18:00:00.000Z",
});
assert.equal(offline.publishedAt, published);
assert.equal(offline.checkedAt, checked);

const kept = status.catalogTimestamps({
  source: "r2",
  generatedAt: "not-a-date",
  previousPublishedAt: published,
  now: checked,
});
assert.equal(kept.publishedAt, published);
assert.equal(kept.checkedAt, checked);

assert.notEqual(status.formatCatalogDate(published, "ru"), status.formatCatalogDate(checked, "ru"));
assert.match(status.formatCatalogDate(published, "ru"), /13/);
assert.match(status.formatCatalogDate(checked, "ru", true), /19/);

assert.equal(status.shouldShowBackgroundGuide({ backgroundGranted: true, postponed: false }), false);
assert.equal(status.shouldShowBackgroundGuide({ backgroundGranted: false, postponed: true }), false);
assert.equal(status.shouldShowBackgroundGuide({ backgroundGranted: false, postponed: false }), true);

assert.equal(status.describeLocationAccess({ background: { granted: true, status: "granted" } }), "always");
assert.equal(status.describeLocationAccess({
  foreground: { granted: true, status: "granted" },
  background: { granted: false, status: "denied", ios: { scope: "whenInUse" } },
}), "when-in-use");
assert.equal(status.describeLocationAccess({
  foreground: { granted: false, status: "denied" },
  background: { granted: false, status: "denied" },
}), "denied");
assert.equal(status.describeLocationAccess({}), "missing");

for (const language of ["ru", "uk", "en", "pl"]) {
  for (const platform of ["ios", "android"]) {
    const copy = status.backgroundGuideCopy(language, platform);
    assert.ok(copy.body.length <= 180, copy.body);
    assert.equal(copy.steps.length, 2);
    assert.ok(copy.openSettings.length > 0);
    assert.ok(!copy.body.includes("даже при заблокированном экране или открытом навигаторе"));
  }
}
assert.ok(status.backgroundGuideCopy("ru", "ios").steps[1].includes("Всегда"));
assert.ok(status.backgroundGuideCopy("ru", "android").steps[1].includes("Любом") === false);
assert.ok(status.backgroundGuideCopy("ru", "android").steps[1].toLowerCase().includes("любом"));
assert.equal(status.backgroundAccessMessage("ru", "always"), "Доступ «Всегда» включён.");
assert.match(status.backgroundAccessMessage("en", "when-in-use"), /while using/i);

const point = { id: "1", latitude: 48.8, longitude: 2.3, speed_limit: 50 };
const feed = { schema_version: 1, country: "FR", record_count: 1, speed_cameras: [point] };
const text = JSON.stringify(feed);
const checksum = hash.sha256(text);
const manifest = {
  schema_version: 1,
  total_records: 1,
  generated_at: published,
  countries: [{
    country_code: "FR",
    record_count: 1,
    size_bytes: hash.utf8Bytes(text).length,
    checksum,
    version: checksum,
    path: `production/v1/countries/FR/${checksum}.json`,
  }],
};
let calls = [];
const fetcher = async url => {
  calls.push(String(url));
  return { ok: true, headers: { get: () => null }, text: async () => calls.at(-1).includes("manifest.json") ? JSON.stringify(manifest) : text };
};
(async () => {
let result = await delivery.refreshCountryDelivery({ country: "FR", fetcher });
assert.equal(result.source, "r2");
assert.equal(result.generatedAt, published);
assert.equal(calls.length, 2);
calls = [];
result = await delivery.refreshCountryDelivery({
  country: "FR",
  feeds: { FR: result.feed },
  versions: { FR: checksum },
  fetcher,
});
assert.equal(result.source, "cache-current");
assert.equal(result.generatedAt, published);
assert.equal(calls.length, 1);
assert.ok(calls[0].endsWith("/production/v1/manifest.json"));
assert.ok(!calls.some(url => url.includes("/countries/")));

const guideStart = appSource.indexOf("function renderBackgroundGuide");
const guideEnd = appSource.indexOf("if (onboardingState !== \"done\")", guideStart);
const guide = appSource.slice(guideStart, guideEnd);
assert.ok(guide.includes("<ScrollView"));
assert.ok(guide.indexOf("guideButton") > guide.indexOf("<ScrollView"));
assert.ok(guide.indexOf("guideButton") < guide.indexOf("</ScrollView>"));
assert.ok(guide.includes("maxFontSizeMultiplier={1.6}"));
assert.ok(guide.includes("windowHeight * 0.62"));
assert.ok(appSource.includes("Linking.openSettings"));
assert.equal(appSource.split("requestBackgroundPermissionsAsync").length - 1, 1);
assert.ok(appSource.slice(appSource.indexOf("async function openBackgroundSettings"), appSource.indexOf("async function startBackgroundSession")).includes("Platform.OS === \"android\""));
assert.ok(!appSource.includes("даже при заблокированном экране или открытом навигаторе"));
const tracking = appSource.slice(appSource.indexOf("async function startTracking"), appSource.indexOf("function stopTracking"));
assert.ok(tracking.indexOf("watchPositionAsync") > tracking.indexOf("shouldShowBackgroundGuide"));
assert.equal(appSource.split("await requestBackground()").length - 1, 1);
const seHeight = Math.max(240, Math.min(568 * 0.62, 460));
assert.ok(seHeight < 568);
assert.ok(seHeight >= 240);

console.log(JSON.stringify({
  result: "passed",
  publication_date_kept: published,
  check_time_separate: checked,
  unchanged_country_download: false,
  background_guide_reopened_when_granted_or_postponed: false,
  small_screen_sheet_max_height: seHeight,
}));
})().catch(error => { console.error(error); process.exitCode = 1; });
