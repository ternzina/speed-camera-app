import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  AUTOCOMPLETE_FIELD_MASK, autocompletePlaces, createSessionToken, NAVTEST_BUNDLE,
  NEARBY_FIELD_MASK, parseAutocompleteSuggestions, parsePlaceLocation, PLACE_DETAILS_FIELD_MASK,
  placeDetailsLocation, PLACES_DEBOUNCE_MS, reduceSearchSchedule,
} from "../../google-places.js";

test("typing keeps one session token and waits before a request", () => {
  let state = { text: "", token: null, sendAt: null };
  state = reduceSearchSchedule(state, "Х", 1000);
  assert.equal(state.sendAt, null);
  assert.equal(state.token, null);
  state = reduceSearchSchedule(state, "Хр", 1100);
  const token = state.token;
  assert.equal(state.sendAt, 1100 + PLACES_DEBOUNCE_MS);
  state = reduceSearchSchedule(state, "Хрещатик 22", 1200);
  assert.equal(state.token, token);
  assert.equal(state.sendAt, 1200 + PLACES_DEBOUNCE_MS);
  state = reduceSearchSchedule(state, "Х", 1300);
  assert.equal(state.token, null);
  const again = reduceSearchSchedule(state, "Київ", 1400);
  assert.notEqual(again.token, token);
  assert.match(createSessionToken(), /^[0-9a-f-]{36}$/);
});

test("autocomplete and place details use a session and the essentials location field", async () => {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    if (String(url).includes(":autocomplete")) {
      return {
        ok: true,
        json: async () => ({
          suggestions: [
            { queryPrediction: { text: { text: "Хрещатик" } } },
            {
              placePrediction: {
                placeId: "place-street",
                text: { text: "вулиця Хрещатик, 22, Київ" },
                structuredFormat: {
                  mainText: { text: "вулиця Хрещатик, 22" },
                  secondaryText: { text: "Київ, Україна" },
                },
              },
            },
            {
              placePrediction: {
                placeId: "place-org",
                text: { text: "Національний музей історії України, Київ" },
                structuredFormat: {
                  mainText: { text: "Національний музей історії України" },
                  secondaryText: { text: "вулиця Володимирська, 2, Київ" },
                },
              },
            },
          ],
        }),
      };
    }
    return { ok: true, json: async () => ({ location: { latitude: 50.458, longitude: 30.518 } }) };
  };
  const suggestions = await autocompletePlaces({
    input: "Хрещатик 22",
    sessionToken: "session-1",
    languageCode: "uk",
    key: "test-key",
    fetch,
  });
  assert.equal(suggestions.length, 2);
  assert.equal(suggestions[0].title, "вулиця Хрещатик, 22");
  assert.equal(suggestions[0].address, "Київ, Україна");
  assert.equal(suggestions[1].title, "Національний музей історії України");
  const point = await placeDetailsLocation({
    placeId: suggestions[0].placeId,
    sessionToken: "session-1",
    key: "test-key",
    fetch,
  });
  assert.deepEqual(point, { lat: 50.458, lng: 30.518 });
  const autocomplete = calls[0];
  const details = calls[1];
  assert.equal(autocomplete.url, "https://places.googleapis.com/v1/places:autocomplete");
  assert.equal(autocomplete.options.headers["X-Goog-FieldMask"], AUTOCOMPLETE_FIELD_MASK);
  assert.equal(autocomplete.options.headers["X-Goog-Api-Key"], "test-key");
  assert.equal(autocomplete.options.headers["X-Ios-Bundle-Identifier"], NAVTEST_BUNDLE);
  assert.deepEqual(JSON.parse(autocomplete.options.body), {
    input: "Хрещатик 22",
    sessionToken: "session-1",
    languageCode: "uk",
  });
  assert.equal(details.options.method, "GET");
  assert.equal(details.options.headers["X-Goog-FieldMask"], "location");
  assert.equal(PLACE_DETAILS_FIELD_MASK, "location");
  assert.match(details.url, /sessionToken=session-1/);
  assert.equal(details.url.includes("displayName"), false);
  assert.equal(AUTOCOMPLETE_FIELD_MASK.includes("displayName"), false);
  assert.equal(NEARBY_FIELD_MASK.includes("places.displayName"), true);
  const source = fs.readFileSync(new URL("../../google-places.js", import.meta.url), "utf8");
  assert.equal(source.includes("MKDirections"), false);
  assert.equal(source.includes("GOOGLE_MAPS_ANDROID_API_KEY"), false);
  assert.equal(source.includes("AIza"), false);
});

test("a missing key does not call the network", async () => {
  let called = false;
  await assert.rejects(
    () => autocompletePlaces({ input: "Київ", sessionToken: "session-2", languageCode: "ru", key: "", fetch: () => { called = true; } }),
    error => error.code === "missing-key",
  );
  assert.equal(called, false);
  assert.equal(parsePlaceLocation({ location: { latitude: 91, longitude: 0 } }), null);
  assert.deepEqual(parseAutocompleteSuggestions({ suggestions: [] }), []);
});
