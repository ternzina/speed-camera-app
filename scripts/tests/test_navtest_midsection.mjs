import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { midsectionRecognition, recordedSectionGeometry, stepNavtestSection } from "../../poland-engine.js";
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

function memory() {
  const values = new Map();
  return {
    async getItem(key) { return values.has(key) ? values.get(key) : null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
}

function hear() {
  const heard = [];
  return { heard, speak: async phrases => { heard.push(...phrases); return true; } };
}

test("two recorded endpoints are not road geometry", () => {
  const root = new URL("../../", import.meta.url);
  for (const name of ["cameras-pl.json", "master-db/generated/cameras-pl.json"]) {
    const feed = JSON.parse(fs.readFileSync(new URL(name, root), "utf8"));
    assert.ok(feed.average_speed_sections.length > 0);
    for (const section of feed.average_speed_sections) {
      assert.equal(recordedSectionGeometry(section), null);
      assert.equal(midsectionRecognition(section), "silent");
      assert.ok(section.start && section.end);
      assert.equal(section.polyline, undefined);
      assert.equal(section.geometry, undefined);
      assert.equal(section.road_geometry, undefined);
    }
  }
  const drawn = {
    ...stretch.average_speed_sections[0],
    polyline: [
      { latitude: 52, longitude: 21 },
      { latitude: 52.009, longitude: 21 },
      { latitude: 52.018, longitude: 21 },
    ],
  };
  assert.equal(recordedSectionGeometry(drawn).length, 3);
  const middle = stepNavtestSection(null, {
    feed: { average_speed_sections: [drawn] },
    latitude: 52.009, longitude: 21, heading: 0, now: 0, timestamp: 0, language: "ru",
  });
  assert.equal(middle.say.length, 0);
  assert.equal(middle.state.sectionId, null);
  assert.equal(middle.state.pace, null);
});

test("a trip that reaches the recorded start still warns once", async () => {
  const { heard, speak } = hear();
  const store = createNavtestSectionStore(memory());
  const first = await store.apply({
    feed: stretch, latitude: 51.999, longitude: 21, heading: 0, now: 0, timestamp: 0, language: "en", accuracy: 12, speak,
  });
  assert.equal(first.state.sectionId, "s1");
  assert.equal(first.state.pace.startedAt, 0);
  assert.equal(heard.length, 1);
  assert.match(heard[0], /Average speed control starts now/);
  await store.apply({
    feed: stretch, latitude: 52.00015, longitude: 21, heading: 0, now: 20000, timestamp: 20000, language: "en", accuracy: 12, speak,
  });
  assert.equal(heard.length, 1);
});

test("a trip that starts in the middle stays silent and has no full average", async () => {
  const { heard, speak } = hear();
  const store = createNavtestSectionStore(memory());
  const first = await store.apply({
    feed: stretch, latitude: 52.009, longitude: 21, heading: 0, now: 0, timestamp: 0, language: "ru", accuracy: 8, speak,
  });
  const second = await store.apply({
    feed: stretch, latitude: 52.0098, longitude: 21, heading: 0, now: 10000, timestamp: 10000, language: "ru", accuracy: 8, speak,
  });
  assert.equal(heard.length, 0);
  assert.equal(first.state.sectionId, null);
  assert.equal(second.state.sectionId, null);
  assert.equal(second.state.pace, null);
  assert.equal(second.pace, null);
});

test("a trip that starts after the end stays silent", async () => {
  const { heard, speak } = hear();
  const store = createNavtestSectionStore(memory());
  for (const heading of [0, 180]) {
    const result = await store.apply({
      feed: stretch, latitude: 52.02, longitude: 21, heading, now: 0, timestamp: 0, language: "ru", accuracy: 10, speak,
    });
    assert.equal(result.say.length, 0);
    assert.equal(result.state.sectionId, null);
  }
  assert.equal(heard.length, 0);
});

test("the opposite direction and a parallel road stay silent", async () => {
  const { heard, speak } = hear();
  const store = createNavtestSectionStore(memory());
  const opposite = await store.apply({
    feed: stretch, latitude: 52.001, longitude: 21, heading: 180, now: 0, timestamp: 0, language: "ru", accuracy: 10, speak,
  });
  const parallel = await store.apply({
    feed: stretch, latitude: 52.009, longitude: 21.003, heading: 0, now: 10000, timestamp: 10000, language: "ru", accuracy: 10, speak,
  });
  assert.equal(opposite.say.length, 0);
  assert.equal(opposite.state.sectionId, null);
  assert.equal(parallel.say.length, 0);
  assert.equal(parallel.state.sectionId, null);
  assert.equal(heard.length, 0);
});

test("a poor GPS fix does not open a section or invent an average", async () => {
  const { heard, speak } = hear();
  const store = createNavtestSectionStore(memory());
  const poor = await store.apply({
    feed: stretch, latitude: 52, longitude: 21, heading: 0, now: 0, timestamp: 0, language: "en", accuracy: 400, speak,
  });
  assert.equal(poor.say.length, 0);
  assert.equal(poor.state.sectionId, null);
  assert.equal(poor.state.pace, null);
  assert.equal(heard.length, 0);
  const recovered = await store.apply({
    feed: stretch, latitude: 52, longitude: 21, heading: 0, now: 5000, timestamp: 5000, language: "en", accuracy: 15, speak,
  });
  assert.equal(recovered.state.sectionId, "s1");
  assert.equal(heard.length, 1);
});

test("lock and unlock in the middle do not start or repeat a section", async () => {
  const storage = memory();
  const { heard, speak } = hear();
  const locked = createNavtestSectionStore(storage);
  await locked.apply({
    feed: stretch, latitude: 52.009, longitude: 21, heading: 0, now: 0, timestamp: 0, language: "ru", accuracy: 9, speak,
  });
  const unlocked = createNavtestSectionStore(storage);
  const again = await unlocked.apply({
    feed: stretch, latitude: 52.0094, longitude: 21, heading: 0, now: 8000, timestamp: 8000, language: "ru", accuracy: 9, speak,
  });
  assert.equal(heard.length, 0);
  assert.equal(again.state.sectionId, null);
  assert.equal(await storage.getItem(NAVTEST_SECTION_KEY), null);
});

test("skipped fixes in the middle add no distance and no phrase", async () => {
  const { heard, speak } = hear();
  const store = createNavtestSectionStore(memory());
  await store.apply({
    feed: stretch, latitude: 52.009, longitude: 21, heading: 0, now: 0, timestamp: 0, language: "ru", accuracy: 10, speak,
  });
  const jumped = await store.apply({
    feed: stretch, latitude: 52.014, longitude: 21, heading: 0, now: 4000, timestamp: 4000, language: "ru", accuracy: 10, speak,
  });
  assert.equal(jumped.state.sectionId, null);
  assert.equal(jumped.state.pace, null);
  assert.equal(heard.length, 0);
});

test("ending the trip in an unobserved middle leaves no calculation", async () => {
  const storage = memory();
  const { heard, speak } = hear();
  const store = createNavtestSectionStore(storage);
  await store.apply({
    feed: stretch, latitude: 52.009, longitude: 21, heading: 0, now: 0, timestamp: 0, language: "ru", accuracy: 10, speak,
  });
  await store.reset();
  assert.equal(await storage.getItem(NAVTEST_SECTION_KEY), null);
  assert.equal(heard.length, 0);
});
