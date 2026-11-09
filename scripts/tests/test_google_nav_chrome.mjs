import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {
  IPHONE_15_HEIGHT, IPHONE_15_WIDTH, IPHONE_SE_WIDTH, NAV_DEVICE_HEIGHT, NAV_DEVICE_WIDTH,
  barScale, formatTransit, keyboardClearance, routeSummary, suggestionViewport, summaryFit, textWidth,
} from "../../google-nav-chrome.js";
import { lookupDestinations, parseCoordinate } from "../../google-nav-search.js";

test("the route summary shows distance, transit time, and arrival", () => {
  const now = Date.UTC(2026, 10, 9, 15, 8, 0);
  const row = routeSummary("ru", { meters: 95400, seconds: 6240 }, now);
  assert.deepEqual(row.map(item => item.caption), ["Расстояние", "В пути", "Прибытие"]);
  assert.equal(row[0].value, "95,4 км");
  assert.equal(row[1].value, "1 ч 44 мин");
  assert.match(row[2].value, /^\d{2}:\d{2}$/);
  assert.equal(row[2].value.includes("примерно"), false);
  assert.equal(routeSummary("ru", { meters: 7300, seconds: 600 }, now)[0].value, "7,3 км");
  assert.equal(formatTransit("ru", 600), "10 мин");
  assert.equal(formatTransit("uk", 6240), "1 год 44 хв");
  assert.equal(formatTransit("en", 6240), "1 h 44 min");
  assert.equal(formatTransit("pl", 6240), "1 godz. 44 min");
  assert.deepEqual(routeSummary("uk", null).map(item => item.caption), ["Відстань", "В дорозі", "Прибуття"]);
  assert.deepEqual(routeSummary("en", null).map(item => item.caption), ["Distance", "Driving", "Arrival"]);
  assert.deepEqual(routeSummary("pl", null).map(item => item.caption), ["Dystans", "W trasie", "Przyjazd"]);
  for (const item of row) {
    assert.equal(item.value.includes("\n"), false);
    assert.equal(item.value.includes("…"), false);
    assert.equal(item.caption.includes("…"), false);
  }
  const wide = ["Швидкість і червоне світло", "Контроль червоного світла", "Завершити поїздку"];
  for (const label of wide) assert.ok(textWidth(label, 16) < 393 - 48, label);
});

test("iPhone widths fit the three figures without ellipsis", () => {
  const now = Date.UTC(2026, 10, 9, 15, 8, 0);
  const trips = [
    { meters: 95400, seconds: 6240 },
    { meters: 128400, seconds: 5400 },
    { meters: 7300, seconds: 600 },
  ];
  for (const width of [IPHONE_SE_WIDTH, IPHONE_15_WIDTH, NAV_DEVICE_WIDTH]) {
    for (const language of ["ru", "uk", "en", "pl"]) {
      for (const trip of trips) {
        const items = routeSummary(language, trip, now);
        const fit = summaryFit(items, width - 32);
        assert.equal(fit.fits, true, `${language} ${width} ${trip.meters}`);
        assert.equal(items.length, 3);
        assert.ok(fit.valueSize >= 13 && fit.valueSize <= 18);
        items.forEach((item, index) => {
          assert.ok(fit.widths[index] >= textWidth(item.value, fit.valueSize), item.value);
          assert.ok(fit.widths[index] >= textWidth(item.caption, fit.captionSize), item.caption);
        });
      }
    }
  }
  const narrow = barScale(180, [100, 100]);
  assert.ok(narrow < 1 && narrow > 0.5);
});

test("an open keyboard leaves the route controls clear", () => {
  const keyboardHeight = 336;
  const screens = [
    { width: IPHONE_15_WIDTH, height: IPHONE_15_HEIGHT, safeBottom: 34 },
    { width: NAV_DEVICE_WIDTH, height: NAV_DEVICE_HEIGHT, safeBottom: 34 },
  ];
  for (const screen of screens) {
    const keyboardTop = screen.height - keyboardHeight;
    const contentBottom = screen.height - screen.safeBottom;
    const lift = keyboardClearance({ contentBottom, keyboardTop });
    assert.equal(screen.height - screen.safeBottom - lift, keyboardTop, screen.width);
    assert.equal(keyboardClearance({ contentBottom, keyboardTop: screen.height }), 0);
    const viewport = suggestionViewport({
      windowHeight: screen.height,
      keyboardHeight,
      topChrome: 148,
      bottomChrome: 220,
    });
    assert.ok(viewport > 0 && viewport <= 280, `${screen.width} ${viewport}`);
    const items = routeSummary("ru", { meters: 95400, seconds: 6240 });
    assert.equal(summaryFit(items, screen.width - 32).fits, true);
  }
  assert.equal(suggestionViewport({ windowHeight: 0, keyboardHeight: 336 }), 0);
});

test("the stock maneuver panel stays because the SDK has no compact setting", () => {
  const screen = fs.readFileSync(new URL("../../google-nav-test-screen.js", import.meta.url), "utf8");
  const bar = screen.slice(screen.indexOf("function RouteBar"), screen.indexOf("function finiteCoord"));
  assert.match(bar, /summaryFit\(/);
  assert.match(bar, /maxFontSizeMultiplier=\{1\}/);
  assert.doesNotMatch(bar, /transform: \[\{ scale/);
  assert.match(screen, /headerEnabled=\{chrome\.maneuver\}/);
  assert.match(screen, /styles\.endTrip/);
  assert.doesNotMatch(screen, /navigationHeaderNextStepFont|headerNextStepTextSize|setHeaderHeight/);
  const styling = fs.readFileSync(new URL("../../node_modules/@googlemaps/react-native-navigation-sdk/src/navigation/navigationView/stylingOptions.ts", import.meta.url), "utf8");
  const ios = styling.slice(styling.indexOf("export interface iOSStylingOptions"), styling.length);
  assert.doesNotMatch(ios, /Font|TextSize|headerHeight|compact/);
});

test("end trip sits below the tool row and camera warnings stay", () => {
  const screen = fs.readFileSync(new URL("../../google-nav-test-screen.js", import.meta.url), "utf8");
  const stack = screen.slice(screen.indexOf("<MapTools"), screen.indexOf("function MapTools"));
  assert.ok(stack.indexOf("styles.endTrip") > stack.indexOf("<MapTools"));
  assert.match(screen, /endTrip: "Завершить поездку"/);
  assert.match(screen, /endTrip: \{ minHeight: 44, marginTop: 6, marginBottom: 16/);
  assert.match(screen, /bottom: \{ marginHorizontal: 12, marginBottom: 8, gap: 8 \}/);
  const endStyle = screen.slice(screen.indexOf("endTrip: {"), screen.indexOf("secondary:"));
  assert.doesNotMatch(endStyle, /position: "absolute"|top:|bottom: -/);
  const app = fs.readFileSync(new URL("../../App.js", import.meta.url), "utf8");
  assert.match(app, /function speakWarning/);
  assert.match(app, /isGoogleNavTestApp\(\) && skipRepeatedCameraSpeech/);
  assert.match(screen, /subscribeCameraSpeech/);
});

test("a typed coordinate still resolves without a network call", () => {
  assert.equal(parseCoordinate("вулиця Хрещатик, 1, Київ"), null);
  assert.deepEqual(lookupDestinations("Хрещатик 1 Київ").results, []);
  const point = lookupDestinations("50,45010, 30,52340");
  assert.equal(point.results.length, 1);
  assert.ok(Math.abs(point.results[0].lat - 50.4501) < 0.00001);
  assert.ok(Math.abs(point.results[0].lng - 30.5234) < 0.00001);
  assert.equal(lookupDestinations("91, 10").results.length, 0);
});
