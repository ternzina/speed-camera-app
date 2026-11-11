import assert from "node:assert/strict";
import test from "node:test";
import { cameraAlertCopy } from "../../camera-alert-copy.js";

function uk(distance, limit, speed = 40) {
  return cameraAlertCopy("uk", { distance, speed_limit: limit }, speed, true);
}

test("the Ukrainian screen warning keeps the abbreviations", () => {
  const under = uk(400, 50, 40);
  const over = uk(180, 50, 70);
  assert.equal(under.title, "Камера через 400 м");
  assert.equal(under.body, "Обмеження 50 км/год.");
  assert.equal(over.body, "Знизьте швидкість до 50 км/год.");
  assert.equal(uk(700, null).body, "Камера попереду.");
});

test("spoken Ukrainian uses full units and the number's case", () => {
  assert.equal(uk(400, 50, 40).speech, "Камера через 400 метрів. Обмеження 50 кілометрів на годину.");
  assert.equal(uk(180, 50, 70).speech, "Камера через 180 метрів. Знизьте швидкість до 50 кілометрів на годину.");
  assert.equal(uk(700, null).speech, "Камера через 700 метрів. Камера попереду.");
  assert.equal(uk(1, 1, 0).speech, "Камера через 1 метр. Обмеження 1 кілометра на годину.");
  assert.equal(uk(2, 2, 0).speech, "Камера через 2 метри. Обмеження 2 кілометрів на годину.");
  assert.equal(uk(4, 22, 0).speech, "Камера через 4 метри. Обмеження 22 кілометрів на годину.");
  assert.equal(uk(5, 5, 0).speech, "Камера через 5 метрів. Обмеження 5 кілометрів на годину.");
  assert.equal(uk(11, 11, 0).speech, "Камера через 11 метрів. Обмеження 11 кілометрів на годину.");
  assert.equal(uk(14, 14, 0).speech, "Камера через 14 метрів. Обмеження 14 кілометрів на годину.");
  assert.equal(uk(21, 21, 0).speech, "Камера через 21 метр. Обмеження 21 кілометра на годину.");
  assert.equal(uk(22, 111, 0).speech, "Камера через 22 метри. Обмеження 111 кілометрів на годину.");
  for (const phrase of [uk(400, 50).speech, uk(180, 50, 70).speech, uk(1, 21).speech]) {
    assert.equal(phrase.includes("км/год"), false);
    assert.equal(phrase.includes(" м."), false);
    assert.equal(phrase.includes(" м "), false);
  }
});

test("other languages still speak their own abbreviations", () => {
  assert.equal(cameraAlertCopy("ru", { distance: 250, speed_limit: 90 }, 78).speech, "Камера через 250 м. Ограничение 90 км/ч.");
  assert.equal(cameraAlertCopy("en", { distance: 250, speed_limit: 90 }, 100).speech, "Camera in 250 m. Slow down to 90 km/h.");
  assert.equal(cameraAlertCopy("pl", { distance: 250, speed_limit: 90 }, 40).speech, "Kamera za 250 m. Ograniczenie 90 km/h.");
});
