import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { createRequire } from "module";
import {
  cameraAlertDecision,
  cameraWarningsEnabled,
  mergeStoredSettings,
  planCameraSurfaces,
} from "../../camera-warning-gate.js";
import {
  NOTICE_TEXT,
  buildConsentRecord,
  canContinue,
  consentMatches,
} from "../../notice-consent.js";
import { LEGAL_STATUSES, NOTICES, searchLegalNotices } from "../../legal-notices.js";

const require = createRequire(import.meta.url);
const root = new URL("../../", import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), "utf8");
const { COUNTRY_NAMES } = require("../../countries.js");

const DISTANCES = {
  cityDistance: 600,
  roadDistance: 900,
  highwayDistance: 1200,
  fastDistance: 1500,
};

test("warnings stay on by default and one switch gates camera surfaces only", () => {
  assert.equal(cameraWarningsEnabled(undefined), true);
  assert.equal(cameraWarningsEnabled({}), true);
  assert.equal(cameraWarningsEnabled({ cameraWarnings: false }), false);

  const off = planCameraSurfaces({ cameraWarnings: false, voice: true, vibration: true });
  for (const key of ["voice", "vibration", "backgroundNotification", "mapMarkers", "distance", "nearestCard", "sectionWarning", "mobileCheck"]) {
    assert.equal(off[key], false, key);
  }
  assert.equal(off.speedometer, true);
  assert.equal(off.plainMap, true);

  for (const camera of [{ type: "speed_camera" }, { type: "checkpoint" }, { type: "average_speed_section" }]) {
    const decision = cameraAlertDecision({ cameraWarnings: false, voice: true, vibration: true }, camera);
    assert.equal(decision.emit, false);
    assert.equal(decision.speedometer, true);
    assert.equal(decision.plainMap, true);
  }

  const on = cameraAlertDecision({ cameraWarnings: true, voice: true, vibration: true }, { type: "average_speed_section" });
  assert.equal(on.emit, true);
  assert.equal(on.section, true);
  assert.equal(on.voice, true);
});

test("a country change keeps the switch and the saved distances", () => {
  const defaults = { cameraWarnings: true, smartDistance: true, country: "ua", language: "ru", ...DISTANCES };
  const saved = mergeStoredSettings(defaults, {
    country: "pl",
    smartDistance: false,
    cityDistance: 700,
    roadDistance: 1000,
    highwayDistance: 1300,
    fastDistance: 1600,
  });
  assert.equal(saved.cameraWarnings, true);
  assert.equal(saved.cityDistance, 700);
  assert.equal(saved.roadDistance, 1000);
  assert.equal(saved.highwayDistance, 1300);
  assert.equal(saved.fastDistance, 1600);

  const changedCountry = { ...saved, country: "de" };
  assert.equal(changedCountry.cameraWarnings, true);
  assert.equal(changedCountry.cityDistance, 700);

  const explicitOff = mergeStoredSettings(defaults, { ...saved, cameraWarnings: false });
  assert.equal(explicitOff.cameraWarnings, false);
  assert.equal(explicitOff.fastDistance, 1600);
  assert.equal(mergeStoredSettings(defaults, { language: "en" }).cameraWarnings, true);
});

test("the legal notice remains stored and no longer blocks the first launch", () => {
  assert.equal(canContinue(false), false);
  assert.equal(canContinue(true), true);
  assert.equal(buildConsentRecord(false, new Date().toISOString()), null);
  const record = buildConsentRecord(true, "2026-10-23T20:00:00.000Z");
  assert.equal(consentMatches(record), true);
  assert.match(NOTICE_TEXT.ru.checkbox, /ознакомил/);
  for (const locale of ["ru", "uk", "en", "pl"]) assert.equal(typeof NOTICE_TEXT[locale].body, "string");
  const app = read("App.js");
  assert.doesNotMatch(app, /function NoticeGate|confirmNotice|noticeReady|setNoticeChecked/);
  assert.match(app, /<AboutLink label=\{t\.terms\} url=\{URLS\.terms\}\/>/);
  assert.match(app, /searchLegalNotices\(query, language\)/);
});

test("laws search is informational and does not encode a warning switch", () => {
  assert.deepEqual(LEGAL_STATUSES, ["known_limits", "checked_functions", "needs_review"]);
  assert.equal(NOTICES.length, 125);
  assert.equal(new Set(NOTICES.map(notice => notice.iso)).size, 125);
  assert.ok(NOTICES.some(notice => notice.iso === "UA"));
  assert.ok(NOTICES.some(notice => notice.iso === "PL"));
  const found = searchLegalNotices("Украина", "ru");
  assert.equal(found.some(notice => notice.iso === "UA"), true);
  assert.equal(read("legal-notices.js").includes("cameraWarnings"), false);
  assert.equal(read("notice-consent.js").includes("cameraWarnings"), false);
});

test("the current app keeps every country, the distances, and leaves the GPS resolver unwired", () => {
  assert.equal(Object.keys(COUNTRY_NAMES).length, 125);
  const app = read("App.js");
  assert.match(app, /cityDistance: 600/);
  assert.match(app, /roadDistance: 900/);
  assert.match(app, /highwayDistance: 1200/);
  assert.match(app, /fastDistance: 1500/);
  assert.match(app, /cameraWarnings: true/);
  assert.match(app, /setSettings\(current => \(\{\.\.\.current,country:code\.toLowerCase\(\)\}\)\)/);
  assert.doesNotMatch(app, /territorial-resolver|territorial-boundaries|observeTerritory|cameraWarningsAuto/);
  assert.match(app, /cameraWarningsEnabled\(bgSettings\)/);
  assert.match(app, /searchLegalNotices\(query, language\)/);
  assert.match(app, /Проверить предупреждение/);
  assert.match(app, /Перевірити попередження/);
  assert.match(app, /Check a warning/);
  assert.match(app, /Sprawdź ostrzeżenie/);
  assert.match(app, /Пример оповещения/);
  assert.match(app, /Приклад сповіщення/);
  assert.match(app, /Sample alert/);
  assert.match(app, /Przykład powiadomienia/);
  assert.doesNotMatch(app, /Предпросмотр предупреждени|Закрыть демо|Попередній перегляд|Alert preview|Podgląd ostrzeżenia|"Демо |"ДЕМО"|"Demo |"DEMO"/);
  const previewStart = app.indexOf('{modal === "alertDemo" && <Modal visible');
  const preview = app.slice(previewStart, app.indexOf("</SystemSafeArea>", previewStart));
  assert.match(preview, /voiceEnabled=\{false\}/);
  assert.match(preview, /vibrationEnabled=\{false\}/);
  assert.match(preview, /id: "demo-only-camera"/);
  assert.doesNotMatch(preview, /Speech\.|startTracking\(/);
  assert.equal(fs.existsSync(new URL("territorial-resolver.js", root)), false);
  assert.equal(fs.existsSync(new URL("territorial-boundaries.js", root)), false);
});
