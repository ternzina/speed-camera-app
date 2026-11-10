import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { averageSectionSpeech, stepNavtestSection } from "../../poland-engine.js";
import { createNavtestSectionStore, NAVTEST_SECTION_KEY } from "../../navtest-section.js";

const stretch = {
  average_speed_sections: [{
    id: "s1",
    length_km: 2,
    speed_limit: 50,
    start: { latitude: 52, longitude: 21 },
    end: { latitude: 52.018, longitude: 21 },
  }],
};
const noLimit = {
  average_speed_sections: [{
    id: "plain",
    length_km: 17.4,
    speed_limit: null,
    start: { latitude: 52.205177, longitude: 21.510838 },
    end: { latitude: 52.201443, longitude: 21.757902 },
  }],
};

function memory() {
  const values = new Map();
  return {
    async getItem(key) { return values.has(key) ? values.get(key) : null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
}

test("entry is recorded once and the average comes from accepted fixes", async () => {
  const heard = [];
  const store = createNavtestSectionStore(memory());
  const speak = async phrases => { heard.push(...phrases); return true; };
  const first = await store.apply({
    feed: stretch, latitude: 52, longitude: 21, heading: 0, now: 0, timestamp: 0, language: "en", speak,
  });
  assert.equal(first.state.sectionId, "s1");
  assert.equal(first.state.pace.distance, 0);
  assert.equal(heard.length, 1);
  assert.match(heard[0], /Average speed control starts now/);
  const second = await store.apply({
    feed: stretch, latitude: 52.0004, longitude: 21, heading: 0, now: 10000, timestamp: 10000, language: "en", speak,
  });
  assert.equal(second.state.sectionId, "s1");
  assert.equal(second.state.pace.startedAt, 0);
  assert.ok(second.state.pace.distance > 20);
  assert.equal(second.say.length, 0);
  assert.equal(heard.length, 1);
});

test("an average over the stored limit is spoken once", async () => {
  const heard = [];
  const store = createNavtestSectionStore(memory());
  const speak = async phrases => { heard.push(...phrases); return true; };
  await store.apply({ feed: stretch, latitude: 52, longitude: 21, heading: 0, now: 0, timestamp: 0, language: "en", speak });
  const over = await store.apply({
    feed: stretch, latitude: 52.0013, longitude: 21, heading: 0, now: 10000, timestamp: 10000, language: "en", speak,
  });
  assert.ok(over.state.pace.averageKmh > 50);
  assert.equal(heard.filter(phrase => phrase.includes("kilometers per hour")).length, 1);
  await store.apply({
    feed: stretch, latitude: 52.0026, longitude: 21, heading: 0, now: 20000, timestamp: 20000, language: "en", speak,
  });
  assert.equal(heard.filter(phrase => phrase.includes("kilometers per hour")).length, 1);
});

test("a section without a numeric limit keeps the start warning and does not speak a limit", async () => {
  const heard = [];
  const open = {
    average_speed_sections: [{
      id: "plain",
      length_km: 2,
      speed_limit: null,
      start: { latitude: 52, longitude: 21 },
      end: { latitude: 52.018, longitude: 21 },
    }],
  };
  const store = createNavtestSectionStore(memory());
  const speak = async phrases => { heard.push(...phrases); return true; };
  await store.apply({ feed: open, latitude: 52, longitude: 21, heading: 0, now: 0, timestamp: 0, language: "en", speak });
  assert.equal(heard.length, 1);
  assert.match(heard[0], /Average speed control starts now/);
  assert.doesNotMatch(heard[0], /limit/i);
  await store.apply({
    feed: open, latitude: 52.0013, longitude: 21, heading: 0, now: 10000, timestamp: 10000, language: "en", speak,
  });
  assert.equal(heard.length, 1);
  assert.equal(heard.some(phrase => /kilometers per hour|Limit \d|Speed limit/i.test(phrase)), false);
  assert.equal(open.average_speed_sections[0].speed_limit, null);
  assert.equal(averageSectionSpeech({ state: "over", averageKmh: 90, section: open.average_speed_sections[0] }, "en"), "");
});

test("a missing limit does not invent an over-speed phrase", async () => {
  const heard = [];
  const store = createNavtestSectionStore(memory());
  const speak = async phrases => { heard.push(...phrases); return true; };
  await store.apply({ feed: noLimit, latitude: 52.205177, longitude: 21.510838, heading: 90, now: 0, timestamp: 0, speak });
  await store.apply({ feed: noLimit, latitude: 52.2063, longitude: 21.510838, heading: 90, now: 10000, timestamp: 10000, speak });
  assert.equal(heard.some(phrase => phrase.includes("kilometers per hour")), false);
});

test("a jumped fix adds no distance and does not announce an average", async () => {
  const heard = [];
  const store = createNavtestSectionStore(memory());
  const speak = async phrases => { heard.push(...phrases); return true; };
  const started = await store.apply({
    feed: stretch, latitude: 52, longitude: 21, heading: 0, now: 0, timestamp: 0, speak,
  });
  const jumped = await store.apply({
    feed: stretch, latitude: 52.01, longitude: 21, heading: 0, now: 5000, timestamp: 5000, speak,
  });
  assert.equal(jumped.state.sectionId, "s1");
  assert.equal(jumped.state.pace.distance, started.state.pace.distance);
  assert.equal(jumped.state.pace.averageKmh, null);
  assert.equal(jumped.state.pace.reliable, false);
  assert.equal(heard.length, 1);
  const stale = await store.apply({
    feed: stretch, latitude: 52.0102, longitude: 21, heading: 0, now: 80000, timestamp: 0, speak,
  });
  assert.equal(stale.state.pace.distance, started.state.pace.distance);
});

test("the section end is spoken once and then the calculation stops", async () => {
  let state = null;
  state = stepNavtestSection(state, {
    feed: stretch, latitude: 52, longitude: 21, heading: 0, now: 0, timestamp: 0, language: "en",
  }).state;
  const ended = stepNavtestSection(state, {
    feed: stretch, latitude: 52.018, longitude: 21, heading: 0, now: 60000, timestamp: 60000, language: "en",
  });
  assert.equal(ended.event.state, "ending");
  assert.match(ended.say[0], /ended/);
  assert.equal(ended.state.sectionId, null);
  assert.equal(ended.state.pace, null);
  const again = stepNavtestSection(ended.state, {
    feed: stretch, latitude: 52.018, longitude: 21, heading: 0, now: 61000, timestamp: 61000, language: "en",
  });
  assert.equal(again.say.length, 0);
  assert.equal(again.state.sectionId, null);
});

test("lock and unlock keep the same section and do not repeat the entry warning", async () => {
  const storage = memory();
  const before = createNavtestSectionStore(storage);
  const speak = async () => true;
  await before.apply({ feed: stretch, latitude: 52, longitude: 21, heading: 0, now: 0, timestamp: 0, language: "en", speak });
  const after = createNavtestSectionStore(storage);
  const heard = [];
  const unlocked = await after.apply({
    feed: stretch, latitude: 52.0004, longitude: 21, heading: 0, now: 10000, timestamp: 10000, language: "en",
    speak: async phrases => { heard.push(...phrases); return true; },
  });
  assert.equal(unlocked.state.sectionId, "s1");
  assert.equal(unlocked.state.pace.startedAt, 0);
  assert.equal(heard.length, 0);
  assert.ok(await storage.getItem(NAVTEST_SECTION_KEY));
});

test("ending the trip releases the stored section", async () => {
  const storage = memory();
  const store = createNavtestSectionStore(storage);
  await store.apply({
    feed: stretch, latitude: 52, longitude: 21, heading: 0, now: 0, timestamp: 0,
    speak: async () => true,
  });
  await store.reset();
  assert.equal(await storage.getItem(NAVTEST_SECTION_KEY), null);
  const heard = [];
  const next = createNavtestSectionStore(storage);
  await next.apply({
    feed: stretch, latitude: 52, longitude: 21, heading: 0, now: 0, timestamp: 0,
    speak: async phrases => { heard.push(...phrases); return true; },
  });
  assert.equal(heard.length, 1);
});

test("the navtest background task feeds the same calculator without a second GPS session", () => {
  const app = fs.readFileSync(new URL("../../App.js", import.meta.url), "utf8");
  const background = app.slice(app.indexOf("async function processBackgroundLocation"), app.indexOf("function storedCountryCodes"));
  assert.match(background, /AppState\.currentState === "active" && foregroundTripRunning/);
  const gate = background.indexOf("const sectionFix = isGoogleNavTestApp()");
  const speedReturn = background.indexOf("speedKmh < MIN_MOVING_SPEED_KMH");
  assert.ok(gate > 0 && gate < speedReturn);
  assert.match(background, /navtestSectionStore\(\)\.apply\(sectionFix\)/);
  assert.doesNotMatch(background, /startLocationUpdatesAsync|setBackgroundLocationUpdatesEnabled/);
  const tracking = app.slice(app.indexOf("async function startTracking"), app.indexOf("function stopTracking"));
  assert.match(tracking, /if \(AppState\.currentState !== "active"\) return/);
  assert.match(tracking, /isGoogleNavTestApp\(\)\) \{\s*const outcome = await navtestSectionStore\(\)\.apply/);
  assert.match(tracking, /detectAverageSpeedSection\(\s*activeCountryFeedRef\.current/);
  const stopping = app.slice(app.indexOf("function stopTracking"), app.indexOf("const backgroundBusy"));
  assert.match(stopping, /stopBackground\(\)/);
  assert.match(stopping, /navtestSectionStore\(\)\.reset\(\)/);
  assert.match(app, /isGoogleNavTestApp\(\) && \(skipRepeatedCameraSpeech|isGoogleNavTestApp\(\) && skipRepeatedCameraSpeech|skipSharedNavtestSpeech/);
});
