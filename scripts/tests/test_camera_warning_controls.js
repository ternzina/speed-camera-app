import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { execSync } from "child_process";
import {
  cameraAlertDecision,
  cameraWarningsEnabled,
  mergeStoredSettings,
  planCameraSurfaces,
} from "../../camera-warning-gate.js";
import {
  NOTICE_TEXT,
  NOTICE_VERSION_ID,
  buildConsentRecord,
  canContinue,
  consentMatches,
} from "../../notice-consent.js";
import { DISPUTED_ISO, NOTICES, STATUS_LABELS, searchLegalNotices } from "../../legal-notices.js";
import { COUNTRY_NAMES } from "../../countries.js";
import { TERRITORY_IDS } from "../../territorial-boundaries.js";
import { createResolverState, observeTerritory } from "../../territorial-resolver.js";

const root = new URL("../../", import.meta.url);

function read(name) {
  return fs.readFileSync(new URL(name, root), "utf8");
}

function sample(latitude, longitude, timeMs, accuracyMeters = 10) {
  return { latitude, longitude, accuracyMeters, timeMs };
}

test("camera warnings default on and one switch gates every alert surface", () => {
  assert.equal(cameraWarningsEnabled(undefined), true);
  assert.equal(cameraWarningsEnabled({}), true);
  assert.equal(cameraWarningsEnabled({ cameraWarnings: true, voice: true }), true);
  assert.equal(cameraWarningsEnabled({ cameraWarnings: false, voice: true }), false);

  const off = planCameraSurfaces({ cameraWarnings: false, voice: true, vibration: true });
  for (const key of ["voice", "vibration", "backgroundNotification", "mapMarkers", "distance", "nearestCard", "sectionWarning", "mobileCheck"]) {
    assert.equal(off[key], false, key);
  }
  assert.equal(off.speedometer, true);
  assert.equal(off.plainMap, true);

  for (const camera of [{ type: "speed_camera" }, { type: "checkpoint" }, { type: "average_speed_section" }]) {
    const decision = cameraAlertDecision({ cameraWarnings: false, voice: true, vibration: true }, camera);
    assert.equal(decision.voice, false);
    assert.equal(decision.vibration, false);
    assert.equal(decision.notification, false);
    assert.equal(decision.marker, false);
    assert.equal(decision.distance, false);
    assert.equal(decision.nearestCard, false);
    assert.equal(decision.section, false);
    assert.equal(decision.mobile, false);
    assert.equal(decision.speedometer, true);
    assert.equal(decision.plainMap, true);
  }

  const on = cameraAlertDecision({ cameraWarnings: true, voice: true, vibration: true }, { type: "checkpoint" });
  assert.equal(on.mobile, true);
  assert.equal(on.voice, true);
  assert.equal(on.marker, true);
  const section = cameraAlertDecision({ cameraWarnings: true, voice: true, vibration: true }, { type: "average_speed_section" });
  assert.equal(section.section, true);
  assert.equal(section.voice, true);
  const quiet = planCameraSurfaces({ cameraWarnings: true, voice: false, vibration: false });
  assert.equal(quiet.voice, false);
  assert.equal(quiet.mapMarkers, true);
  assert.equal(quiet.speedometer, true);
});

test("the warning switch survives a stored restart and stays on when the old record has no key", () => {
  const defaults = { cameraWarnings: true, voice: true, language: "ru" };
  const saved = mergeStoredSettings(defaults, { cameraWarnings: false, language: "en" });
  const restored = mergeStoredSettings(defaults, JSON.parse(JSON.stringify(saved)));
  assert.equal(restored.cameraWarnings, false);
  assert.equal(restored.language, "en");
  assert.equal(mergeStoredSettings(defaults, { language: "pl" }).cameraWarnings, true);
  assert.equal(mergeStoredSettings(defaults, null).cameraWarnings, true);
});

test("first-launch notice blocks continue until the box is checked and stores version plus time", () => {
  assert.equal(NOTICE_TEXT.ru.body, "Правила использования приложений, предупреждающих о дорожных камерах, различаются по странам. В некоторых странах отдельные функции могут быть запрещены. Перед поездкой ознакомьтесь с местными ограничениями и соблюдайте правила дорожного движения.");
  assert.equal(NOTICE_TEXT.ru.checkbox, "Я ознакомился(ась) с информацией и понимаю, что обязан(а) соблюдать местное законодательство.");
  assert.equal(NOTICE_TEXT.ru.continueLabel, "Продолжить");
  for (const locale of ["ru", "uk", "en", "pl"]) {
    assert.ok(NOTICE_TEXT[locale].body.length > 40);
    assert.ok(NOTICE_TEXT[locale].checkbox.length > 20);
    assert.ok(NOTICE_TEXT[locale].continueLabel.length > 2);
  }
  const noticeSource = JSON.stringify(NOTICE_TEXT);
  assert.doesNotMatch(noticeSource, /ответственност|liability|odpowiedzial|відповідальн|снимает ответственность|не снимает/i);
  assert.equal(canContinue(false), false);
  assert.equal(canContinue(true), true);
  assert.equal(buildConsentRecord(false, "2026-10-22T00:00:00.000Z"), null);
  const record = buildConsentRecord(true, "2026-10-22T03:04:05.000Z");
  assert.deepEqual(record, { versionId: NOTICE_VERSION_ID, confirmedAt: "2026-10-22T03:04:05.000Z" });
  assert.equal(consentMatches(record), true);
  assert.equal(consentMatches({ versionId: "other", confirmedAt: record.confirmedAt }), false);
});

test("laws search is bundled and uses only the three recorded statuses", () => {
  assert.equal(read("legal-notices.js").includes("fetch("), false);
  assert.doesNotMatch(read("legal-notices.js"), /XMLHttpRequest|axios|http\.get/);
  assert.equal(NOTICES.length, 125);
  assert.equal(DISPUTED_ISO.length, 98);
  const counts = { known_limits: 0, checked_functions: 0, needs_review: 0 };
  const banned = /полностью законно|повністю законно|цілком законно|fully legal|completely legal|entirely legal|100% legal|w pełni legal|całkowicie legal/i;
  const competitor = /tomtom\.com|webfleet\.com|radarbot\.com|support\.google\.com|adac\.de|coyote\.|waze\.com|play\.google|apps\.apple/i;
  for (const notice of NOTICES) {
    assert.ok(counts[notice.status] !== undefined, notice.iso);
    counts[notice.status] += 1;
    for (const text of Object.values(notice.explanation)) assert.doesNotMatch(text, banned);
    if (notice.sourceUrl) {
      assert.match(notice.sourceUrl, /^https?:\/\//);
      assert.doesNotMatch(notice.sourceUrl, competitor);
    }
  }
  assert.deepEqual(counts, { known_limits: 8, checked_functions: 16, needs_review: 101 });
  assert.deepEqual(
    NOTICES.filter((notice) => notice.status === "known_limits").map((notice) => notice.iso).sort(),
    ["BH", "CH", "DE", "EG", "FR", "OM", "PS", "SN"],
  );
  const palestine = NOTICES.find((notice) => notice.iso === "PS");
  assert.equal(palestine.wholeTerritory, false);
  assert.match(palestine.explanation.ru, /Восточный Иерусалим/);
  assert.match(palestine.explanation.ru, /код PS/);
  assert.match(palestine.explanation.en, /East Jerusalem/);
  assert.equal(palestine.checkedOn, "2026-10-21");
  for (const iso of ["FR", "DE", "CH", "EG", "OM", "BH", "SN"]) {
    const notice = NOTICES.find((row) => row.iso === iso);
    assert.equal(notice.wholeTerritory, true, iso);
    assert.equal(notice.checkedOn, "2026-10-21");
    assert.ok(notice.sourceUrl);
  }
  const mobile = ["AD", "BE", "ES", "GB", "HU", "LU", "NL", "NO", "RO", "RU"];
  const fixed = ["IT", "KR", "NZ", "SE", "TW", "UA"];
  for (const iso of mobile) {
    const notice = NOTICES.find((row) => row.iso === iso);
    assert.equal(notice.status, "checked_functions");
    assert.deepEqual(notice.checkedFunctions, ["gps_warning", "exact_coordinates", "mobile_check"]);
    assert.equal(notice.checkedOn, "2026-10-21");
  }
  for (const iso of fixed) {
    const notice = NOTICES.find((row) => row.iso === iso);
    assert.equal(notice.status, "checked_functions");
    assert.deepEqual(notice.checkedFunctions, ["gps_warning", "exact_coordinates"]);
  }
  for (const iso of DISPUTED_ISO) {
    const notice = NOTICES.find((row) => row.iso === iso);
    assert.equal(notice.status, "needs_review", iso);
    assert.equal(notice.checkedOn, "2026-10-22", iso);
    assert.equal(mobile.includes(iso) || fixed.includes(iso), false);
  }
  for (const iso of ["XK", "SM", "VA"]) {
    const notice = NOTICES.find((row) => row.iso === iso);
    assert.equal(notice.status, "needs_review");
    assert.equal(notice.checkedOn, null);
    assert.equal(notice.sourceUrl, null);
  }
  assert.deepEqual(searchLegalNotices("Франция", "ru").map((row) => row.iso), ["FR"]);
  assert.deepEqual(searchLegalNotices("Senegal", "en").map((row) => row.iso), ["SN"]);
  assert.equal(searchLegalNotices("известные ограничения", "ru").length, 8);
  assert.equal(searchLegalNotices("проверено для конкретных функций", "ru").length, 16);
  assert.equal(searchLegalNotices("требуется уточнение", "ru").length, 101);
  assert.equal(searchLegalNotices("", "pl").length, 125);
  assert.equal(STATUS_LABELS.ru.known_limits, "известные ограничения");
  assert.equal(STATUS_LABELS.en.checked_functions, "checked for specific features");
});

test("Kosovo, San Marino, and Vatican stay on the label list and the laws page says the catalog has no cameras", () => {
  const summary = JSON.parse(read("master-db/coverage/summary.json"));
  assert.equal(summary.countries_after, 122);
  assert.equal(summary.country_growth.length, 122);
  const published = new Set(summary.country_growth.map((row) => row.country));
  for (const row of summary.country_growth) {
    assert.equal(published.has(row.country), true);
    assert.notEqual(row.after, 0);
  }
  const noCameras = {
    ru: "В опубликованном каталоге нет камер для этой страны.",
    uk: "В опублікованому каталозі немає камер для цієї країни.",
    en: "The published catalog has no cameras for this country.",
    pl: "Opublikowany katalog nie ma kamer dla tego kraju.",
  };
  assert.equal(Object.keys(COUNTRY_NAMES).length > 122, true);
  for (const iso of ["XK", "SM", "VA"]) {
    assert.equal(typeof COUNTRY_NAMES[iso], "string");
    assert.ok(COUNTRY_NAMES[iso].length > 1);
    assert.equal(published.has(iso), false);
    const notice = NOTICES.find((row) => row.iso === iso);
    assert.ok(notice);
    assert.equal(notice.status, "needs_review");
    for (const [locale, sentence] of Object.entries(noCameras)) {
      assert.equal(notice.explanation[locale].startsWith(sentence), true, `${iso} ${locale}`);
    }
  }
  assert.equal(searchLegalNotices("Косово", "ru")[0].iso, "XK");
  assert.equal(searchLegalNotices("San Marino", "en")[0].explanation.en.startsWith(noCameras.en), true);
  assert.equal(searchLegalNotices("Watykan", "pl")[0].explanation.pl.startsWith(noCameras.pl), true);
  const cameras = fs.statSync(new URL("cameras.json", root));
  const camerasPl = fs.statSync(new URL("cameras-pl.json", root));
  assert.ok(cameras.size > 1000);
  assert.ok(camerasPl.size > 1000);
});

test("resolver hysteresis does not let one point or a country code flip the territory", () => {
  assert.deepEqual([...TERRITORY_IDS].sort(), ["BH", "CH", "DE", "EG", "FR", "OM", "PS-LAW", "SN"]);
  assert.equal(TERRITORY_IDS.includes("PS"), false);
  assert.doesNotMatch(read("territorial-resolver.js"), /countryCode/);

  let state = createResolverState();
  state = observeTerritory(state, sample(48.8566, 2.3522, 1000));
  assert.equal(state.event, "pending");
  assert.equal(state.confirmed, false);
  state = observeTerritory(state, { ...sample(48.8566, 2.3522, 5000) });
  assert.equal(state.event, "duplicate");
  assert.equal(state.confirmed, false);
  state = observeTerritory(state, sample(48.8575, 2.353, 8000));
  assert.equal(state.event, "confirmed");
  assert.equal(state.confirmedId, "FR");
  assert.equal(state.restricted, true);

  const jumped = observeTerritory(state, sample(52.52, 13.405, 9000));
  assert.equal(jumped.event, "jump");
  assert.equal(jumped.confirmedId, "FR");

  const berlinAt = 8000 + 6 * 60 * 60 * 1000;
  state = observeTerritory(state, sample(52.52, 13.405, berlinAt));
  assert.equal(state.confirmedId, "FR");
  assert.equal(state.event, "pending");
  state = observeTerritory(state, sample(52.521, 13.407, berlinAt + 30000));
  assert.equal(state.confirmedId, "DE");

  state = createResolverState();
  state = observeTerritory(state, sample(48.8566, 2.3522, 1000, 500000));
  assert.equal(state.event, "band");
  state = observeTerritory(state, sample(48.857, 2.353, 8000, 500000));
  assert.equal(state.confirmed, false);

  state = createResolverState();
  state = observeTerritory(state, sample(48.8566, 2.3522, 1000));
  state = observeTerritory(state, sample(48.8566, 2.36, 10000, 2000000));
  assert.equal(state.event, "band");
  state = observeTerritory(state, sample(48.857, 2.353, 20000));
  assert.equal(state.event, "pending");
  assert.equal(state.confirmed, false);

  state = createResolverState();
  state = observeTerritory(state, sample(31.783, 35.233, 1000));
  state = observeTerritory(state, sample(31.784, 35.234, 8000));
  assert.equal(state.confirmedId, null);
  assert.equal(state.restricted, false);

  state = createResolverState();
  state = observeTerritory(state, { ...sample(52.2297, 21.0122, 1000), countryCode: "PS" });
  state = observeTerritory(state, { ...sample(52.2305, 21.013, 8000), countryCode: "FR" });
  assert.equal(state.confirmedId, null);
  assert.equal(state.restricted, false);

  state = createResolverState();
  state = observeTerritory(state, sample(31.9038, 35.2034, 1000));
  assert.equal(state.confirmed, false);
  state = observeTerritory(state, sample(31.9046, 35.2042, 8000));
  assert.equal(state.confirmedId, "PS-LAW");

  state = createResolverState();
  state = observeTerritory(state, sample(31.5017, 34.4668, 1000));
  state = observeTerritory(state, sample(31.5025, 34.4674, 8000));
  assert.equal(state.confirmedId, "PS-LAW");

  state = createResolverState();
  state = observeTerritory(state, sample(14.7167, -17.4677, 1000));
  state = observeTerritory(state, sample(14.7174, -17.4668, 8000));
  assert.equal(state.confirmedId, "SN");
  for (const [lat, lon] of [[48.2082, 16.3738], [35.1856, 33.3823], [41.9981, 21.4254], [39.9334, 32.8597]]) {
    let outside = createResolverState();
    outside = observeTerritory(outside, sample(lat, lon, 1000));
    outside = observeTerritory(outside, sample(lat + 0.001, lon + 0.001, 8000));
    assert.equal(outside.confirmedId, null);
  }
});

test("the production alert entrypoint does not reference the resolver", () => {
  const app = read("App.js");
  for (const name of ["App.js", "poland-engine.js", "camera-data.js", "camera-delivery.js"]) {
    const source = read(name);
    assert.doesNotMatch(source, /territorial-resolver|territorial-boundaries|observeTerritory/);
  }
  assert.match(app, /cameraWarnings: true/);
  assert.match(app, /Предупреждения о камерах/);
  const task = app.indexOf("TaskManager.defineTask");
  const backgroundGate = app.indexOf("if (!cameraWarningsEnabled(bgSettings)) return;", task);
  const notify = app.indexOf("scheduleNotificationAsync", task);
  assert.ok(backgroundGate > task && backgroundGate < notify);
  const tracking = app.indexOf("async function startTracking");
  const liveGate = app.indexOf("if (!cameraWarningsEnabled(live))", tracking);
  const section = app.indexOf("detectAverageSpeedSection", tracking);
  assert.ok(liveGate > tracking && liveGate < section);
  assert.match(app, /surfaces\.mapMarkers && nearbyList/);
  assert.match(app, /surfaces\.nearestCard \?/);
  assert.doesNotMatch(app, /cameraWarningsAuto|remoteConfig|buildFlag|hiddenSwitch/);
});

test("published camera catalog files are unchanged", () => {
  const diff = execSync(
    "git diff --name-only -- cameras.json cameras-pl.json master-db cloudflare supabase app.json",
    { cwd: new URL(".", root), encoding: "utf8" },
  );
  assert.equal(diff.trim(), "");
});
