import assert from "node:assert/strict";
import test from "node:test";
import { barScale, routeSummary, summaryItemWidths, textWidth } from "../../google-nav-chrome.js";
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
  for (const language of ["ru", "uk", "en", "pl"]) {
    const items = routeSummary(language, { meters: 128400, seconds: 5400 }, now);
    const scale = barScale(393 - 48, summaryItemWidths(items));
    assert.equal(scale, 1, language);
  }
  const narrow = barScale(180, [100, 100, 100]);
  assert.ok(narrow < 1 && narrow > 0.5);
});

test("address search stays off and a coordinate still resolves", () => {
  assert.equal(parseCoordinate("вулиця Хрещатик, 1, Київ"), null);
  const blocked = lookupDestinations("Хрещатик 1 Київ");
  assert.equal(blocked.blocked, "places-autocomplete");
  assert.deepEqual(blocked.results, []);
  const point = lookupDestinations("50,45010, 30,52340");
  assert.equal(point.results.length, 1);
  assert.ok(Math.abs(point.results[0].lat - 50.4501) < 0.00001);
  assert.ok(Math.abs(point.results[0].lng - 30.5234) < 0.00001);
  assert.equal(lookupDestinations("91, 10").results.length, 0);
});
