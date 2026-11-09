import assert from "node:assert/strict";
import test from "node:test";
import {
  IPHONE_15_HEIGHT, IPHONE_15_WIDTH, NAV_DEVICE_HEIGHT, NAV_DEVICE_WIDTH,
  barScale, keyboardClearance, routeSummary, suggestionViewport, summaryItemWidths, textWidth,
} from "../../google-nav-chrome.js";
import { lookupDestinations, parseCoordinate } from "../../google-nav-search.js";

test("the route summary is one row of distance, duration, and clock", () => {
  const now = Date.UTC(2026, 10, 9, 10, 2, 0);
  const row = routeSummary("ru", { meters: 7300, seconds: 600 }, now);
  assert.deepEqual(row.map(item => item.caption), ["Осталось", "Время", "Прибытие"]);
  assert.equal(row[0].value, "7,3 км");
  assert.equal(row[1].value, "10 мин");
  assert.match(row[2].value, /^\d{2}:\d{2}$/);
  assert.equal(row[2].value.includes("примерно"), false);
  for (const item of row) {
    assert.equal(item.value.includes("\n"), false);
    assert.equal(item.caption.includes(item.value), false);
  }
  const uk = routeSummary("uk", { meters: 7300, seconds: 600 }, now);
  assert.equal(uk[0].value, "7,3 км");
  assert.equal(uk[0].caption, "Залишилось");
  const wide = ["Швидкість і червоне світло", "Контроль червоного світла", "Завершити поїздку"];
  for (const label of wide) assert.ok(textWidth(label, 16) < 393 - 48, label);
});

test("iPhone 15 width keeps the summary on one line", () => {
  const now = Date.UTC(2026, 10, 9, 10, 2, 0);
  for (const width of [IPHONE_15_WIDTH, NAV_DEVICE_WIDTH]) {
    for (const language of ["ru", "uk", "en", "pl"]) {
      const items = routeSummary(language, { meters: 128400, seconds: 5400 }, now);
      const scale = barScale(width - 48, summaryItemWidths(items));
      assert.equal(scale, 1, `${language} ${width}`);
    }
  }
  const narrow = barScale(180, [100, 100, 100]);
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
    const items = routeSummary("ru", { meters: 7300, seconds: 600 });
    assert.equal(barScale(screen.width - 48, summaryItemWidths(items)), 1);
  }
  assert.equal(suggestionViewport({ windowHeight: 0, keyboardHeight: 336 }), 0);
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
