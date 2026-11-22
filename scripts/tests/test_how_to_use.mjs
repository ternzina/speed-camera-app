import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { howToUseCopy } from "../../how-to-use.js";

const app = readFileSync(new URL("../../App.js", import.meta.url), "utf8");

test("how to use covers the real trip, voice, and permission steps in every language", () => {
  for (const language of ["ru", "uk", "en", "pl"]) {
    const copy = howToUseCopy(language);
    assert.equal(copy.sections.length, 6);
    const text = copy.sections.flatMap(section => [section.title, ...section.paragraphs]).join("\n");
    assert.match(text, /250/);
    assert.doesNotMatch(text, /8 км|8 km|8 км\/год|8 км\/ч/);
    assert.doesNotMatch(text, /все разрешения обязательны|all permissions are required/i);
  }
  const ru = howToUseCopy("ru").sections.map(section => section.paragraphs.join(" ")).join("\n");
  assert.match(ru, /В путь/);
  assert.match(ru, /Начать поездку/);
  assert.match(ru, /без движения/);
  assert.match(ru, /При использовании/);
  assert.match(ru, /не нужны/);
  assert.match(ru, /Фоновый режим/);
  assert.match(ru, /Всегда/);
  assert.match(app, /HowToUsePage/);
  assert.match(app, /howToUseCopy\(settings\.language\)\.title/);
  const guidance = readFileSync(new URL("../../google-nav-test-screen.js", import.meta.url), "utf8");
  const go = guidance.slice(guidance.indexOf("function startGuidance"), guidance.indexOf("async function endRoute"));
  assert.doesNotMatch(go, /MIN_MOVING_SPEED/);
});
