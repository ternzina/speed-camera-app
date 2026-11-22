import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  backgroundModeStatus,
  locationPermissionCopy,
  shouldShowTripLocationHint,
  voiceReadyLine,
} from "../../location-permission.js";

const app = readFileSync(new URL("../../App.js", import.meta.url), "utf8");
const screen = readFileSync(new URL("../../location-permission-screen.js", import.meta.url), "utf8");
const nav = readFileSync(new URL("../../google-nav-test-screen.js", import.meta.url), "utf8");

const KEYS = [
  "settingsTitle", "back", "continue", "next", "title", "body",
  "voiceReady", "hint", "more", "enableBackground", "backgroundOn", "backgroundOff",
];

function lines(text, fontSize, width) {
  const perLine = Math.max(8, Math.floor(width / (fontSize * 0.62)));
  return Math.ceil(String(text).length / perLine);
}

test("location explanation stays readable in every language", () => {
  for (const language of ["ru", "uk", "en", "pl"]) {
    const copy = locationPermissionCopy(language, "ios");
    for (const key of KEYS) {
      assert.equal(typeof copy[key], "string", `${language}.${key}`);
      assert.ok(copy[key].trim().length > 0, `${language}.${key}`);
    }
    assert.equal(copy.observed, undefined);
    assert.equal(copy.whenTitle, undefined);
    assert.equal(copy.alwaysModeTitle, undefined);
    assert.equal(copy.openSettings, undefined);
    assert.doesNotMatch(JSON.stringify(copy), /не подтверждено|не підтверджено|not confirmed|jeszcze potwierdzone|готовы|gotowe|are ready/i);
    assert.ok(copy.body.length <= 90, copy.body);
    assert.ok(copy.hint.length <= 90, copy.hint);
    assert.ok(copy.more.length <= 16, copy.more);
    for (const width of [320, 390, 430]) {
      for (const scale of [1, 1.35]) {
        const content = width - 44;
        const titleSize = (width < 360 ? 24 : 28) * Math.min(scale, 1.4);
        assert.ok(lines(copy.title, titleSize, content) <= 4, `${language} title ${width}`);
        assert.ok(lines(copy.body, 17 * scale, content) <= 3, `${language} body ${width}`);
        assert.ok(lines(copy.voiceReady, 16 * scale, content) <= 2, `${language} voice ${width}`);
        assert.ok(lines(copy.backgroundOn, 16 * scale, content) <= 2, `${language} status ${width}`);
        assert.ok(lines(copy.continue, 17 * scale, content - 32) <= 2, `${language} continue ${width}`);
        assert.ok(lines(copy.enableBackground, 20 * scale, content - 32) <= 2, `${language} background ${width}`);
        assert.ok(lines(copy.hint, 14 * scale, width - 48) <= 3, `${language} hint ${width}`);
      }
    }
    assert.equal(shouldShowTripLocationHint("always"), false);
    assert.equal(shouldShowTripLocationHint("when-in-use"), true);
    assert.equal(voiceReadyLine(language, { voiceEnabled: false, granted: true }), "");
    assert.equal(voiceReadyLine(language, { voiceEnabled: true, granted: false }), "");
    assert.equal(voiceReadyLine(language, { voiceEnabled: true, granted: true }), copy.voiceReady);
  }
  const ru = locationPermissionCopy("ru", "ios");
  assert.equal(ru.settingsTitle, "Разрешения и голос");
  assert.equal(ru.title, "Настройка голосовых предупреждений");
  assert.equal(ru.body, "Для фоновой работы понадобится геолокация «Всегда».");
  assert.equal(ru.hint, "Для полноценной фоновой работы CamAlert настройте геолокацию");
  assert.equal(ru.more, "Подробнее");
  assert.equal(ru.voiceReady, "Голосовые предупреждения включены.");
  assert.equal(ru.enableBackground, "Включить фоновый режим");
  assert.equal(backgroundModeStatus("ru", true), "Фоновый режим включён.");
  assert.equal(backgroundModeStatus("ru", false), "Фоновый режим выключен.");
  assert.match(screen, /ScrollView/);
  assert.match(screen, /compact/);
  assert.doesNotMatch(screen, /numberOfLines|onOpenSettings|whenTitle|alwaysMode|copy\.later|copy\.path/);
});

test("the explanation is shown before the system prompt and can be reopened", () => {
  const open = app.slice(app.indexOf("function showPermissionScreen"), app.indexOf("function closePermissionScreen"));
  assert.match(open, /readLocationAccess/);
  assert.doesNotMatch(open, /requestForegroundPermissionsAsync|requestBackgroundPermissionsAsync/);
  const cont = app.slice(app.indexOf("async function continuePermissionScreen"), app.indexOf("function renderPermissionScreen"));
  assert.match(cont, /requestForegroundPermissionsAsync/);
  assert.match(app, /showPermissionScreen\("launch"\)/);
  assert.match(app, /showPermissionScreen\("settings"\)/);
  assert.match(app, /onOpenPermissionDetails=\{\(\) => showPermissionScreen\("settings"\)\}/);
  assert.match(app, /permissionScreen === "launch"/);
  assert.match(app, /onBack={closePermissionScreen}/);
  assert.match(app, /howToUseCopy\(settings\.language\)\.title/);
  assert.doesNotMatch(screen, /requestForegroundPermissionsAsync|Alert\.alert/);
  assert.match(screen, /copy\.back/);
  assert.match(screen, /copy\.continue|primary/);
  assert.match(screen, /onEnableBackground && !backgroundOn/);
  assert.doesNotMatch(screen, /requestBackgroundPermissionsAsync|toggleBackground|Linking|onOpenSettings/);
  const guide = readFileSync(new URL("../../catalog-status.js", import.meta.url), "utf8");
  assert.match(guide, /Чтобы предупреждать при заблокированном экране/);
  assert.match(guide, /Геопозиция → Всегда/);
});

test("welcome and settings start the same background flow", () => {
  const handler = "() => { if (denyPaid()) return; toggleBackground(); }";
  assert.equal(app.split(handler).length - 1, 2);
  const launch = app.slice(app.indexOf('if (permissionScreen === "launch") {'), app.indexOf("<WelcomeScreen"));
  assert.match(launch, /renderPermissionScreen\(\)/);
  assert.match(launch, /renderBackgroundGuide\(\)/);
  const cont = app.slice(app.indexOf("async function continuePermissionScreen"), app.indexOf("function renderPermissionScreen"));
  assert.doesNotMatch(cont, /toggleBackground|rememberBackgroundChoice|requestBackground\(/);
  const decline = app.slice(app.indexOf("async function declineBackground"), app.indexOf("async function dismissVoiceNotice"));
  assert.doesNotMatch(decline, /finishOnboarding/);
  assert.match(app, /readLocationAccess\(\)/);
});

test("the trip hint does not disable guidance", () => {
  const go = nav.slice(nav.indexOf("function startGuidance"), nav.indexOf("async function endRoute"));
  assert.doesNotMatch(go, /shouldShowTripLocationHint|locationAccess|onOpenPermissionDetails/);
  const button = nav.slice(nav.indexOf("{chrome.go &&"), nav.indexOf("{chrome.startTrip &&"));
  assert.match(button, /disabled=\{busy\}/);
  assert.doesNotMatch(button, /locationAccess|shouldShowTripLocationHint|onOpenPermissionDetails/);
  const start = nav.slice(nav.indexOf("{chrome.startTrip &&"), nav.indexOf("{chrome.build &&"));
  assert.match(start, /disabled=\{busy\}/);
  assert.match(nav, /shouldShowTripLocationHint\(locationAccess\)/);
  assert.match(nav, /locationPermissionCopy\(language\)\.hint/);
  assert.match(nav, /onOpenPermissionDetails/);
  assert.match(nav, /locationPermissionCopy\(language\)\.more/);
  assert.doesNotMatch(nav.slice(nav.indexOf("shouldShowTripLocationHint"), nav.indexOf("{chrome.go &&")), /Linking\.openSettings|openSettings/);
});
