// Places API (New) for the navtest app. One Autocomplete session, then Place
// Details Essentials with only the location field. No legacy Places and no
// Geocoding. The place name comes from the suggestion, not from a Pro field.

import { parseCoordinate } from "./google-nav-search.js";

export const PLACES_DEBOUNCE_MS = 400;
export const PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
export const PLACE_DETAILS_FIELD_MASK = "location";
export const AUTOCOMPLETE_FIELD_MASK = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text.text",
  "suggestions.placePrediction.structuredFormat.mainText.text",
  "suggestions.placePrediction.structuredFormat.secondaryText.text",
].join(",");
export const NAVTEST_BUNDLE = "com.21wek.camera.navtest";

export function createSessionToken() {
  const bytes = new Uint8Array(16);
  const crypto = globalThis.crypto;
  if (crypto?.getRandomValues) crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function placesLanguage(language) {
  if (language === "uk" || language === "en" || language === "pl" || language === "ru") return language;
  return "ru";
}

export function reduceSearchSchedule(state, query, now, delayMs = PLACES_DEBOUNCE_MS) {
  const text = String(query || "").trim();
  if (parseCoordinate(text) || text.length < 2) return { text, token: null, sendAt: null };
  return {
    text,
    token: state?.token || createSessionToken(),
    sendAt: now + delayMs,
  };
}

function placesError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function placesHeaders(key, fieldMask) {
  return {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": key,
    "X-Goog-FieldMask": fieldMask,
    "X-Ios-Bundle-Identifier": NAVTEST_BUNDLE,
  };
}

export function parseAutocompleteSuggestions(payload) {
  const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
  const results = [];
  for (const item of suggestions) {
    const place = item?.placePrediction;
    const placeId = typeof place?.placeId === "string" ? place.placeId : "";
    const title = place?.structuredFormat?.mainText?.text || place?.text?.text || "";
    if (!placeId || !title) continue;
    results.push({
      id: placeId,
      placeId,
      title,
      address: place?.structuredFormat?.secondaryText?.text || "",
    });
  }
  return results.slice(0, 5);
}

export function parsePlaceLocation(payload) {
  const lat = Number(payload?.location?.latitude);
  const lng = Number(payload?.location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export async function autocompletePlaces({ input, sessionToken, languageCode, key, fetch, signal }) {
  if (!key) throw placesError("missing-key");
  if (!sessionToken) throw placesError("places-failed");
  const response = await fetch(PLACES_AUTOCOMPLETE_URL, {
    method: "POST",
    headers: placesHeaders(key, AUTOCOMPLETE_FIELD_MASK),
    body: JSON.stringify({
      input,
      sessionToken,
      languageCode: placesLanguage(languageCode),
    }),
    signal,
  });
  if (!response.ok) throw placesError("places-failed");
  return parseAutocompleteSuggestions(await response.json());
}

export async function placeDetailsLocation({ placeId, sessionToken, key, fetch, signal }) {
  if (!key) throw placesError("missing-key");
  if (!placeId || !sessionToken) throw placesError("places-failed");
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: placesHeaders(key, PLACE_DETAILS_FIELD_MASK),
    signal,
  });
  if (!response.ok) throw placesError("places-failed");
  const point = parsePlaceLocation(await response.json());
  if (!point) throw placesError("places-failed");
  return point;
}
