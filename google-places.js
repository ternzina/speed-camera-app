// Places API (New) for the navtest app. Autocomplete uses a session, then Place
// Details Essentials with only the location field. Nearby Search is the same
// API's searchNearby method. No legacy Places and no Geocoding.

import { parseCoordinate } from "./google-nav-search.js";

export const PLACES_DEBOUNCE_MS = 400;
export const PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
export const PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
export const PLACE_DETAILS_FIELD_MASK = "location";
export const NEARBY_FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location";
export const NEARBY_MAX_RESULTS = 10;
export const NEARBY_RADIUS_M = 5000;
export const NEARBY_TIMEOUT_MS = 12000;
export const AUTOCOMPLETE_FIELD_MASK = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text.text",
  "suggestions.placePrediction.structuredFormat.mainText.text",
  "suggestions.placePrediction.structuredFormat.secondaryText.text",
].join(",");
export const NAVTEST_BUNDLE = "com.21wek.camera.navtest";

export const NEARBY_CATEGORIES = [
  { id: "gas", types: ["gas_station"] },
  { id: "parking", types: ["parking"] },
  { id: "food", types: ["cafe", "restaurant"] },
  { id: "repair", types: ["car_repair", "tire_shop"] },
  { id: "hospital", types: ["hospital"] },
  { id: "pharmacy", types: ["pharmacy"] },
  { id: "cameras" },
];

export const NEARBY_COPY = {
  ru: {
    title: "Рядом", gas: "АЗС", parking: "Парковка", food: "Кафе и рестораны",
    repair: "Ремонт и шиномонтаж", hospital: "Больница", pharmacy: "Аптека",
    cameras: "Камеры рядом",
    go: "Поехать", loading: "Ищем места…", empty: "Рядом ничего не найдено",
    error: "Нет сети. Поиск не выполнен", timeout: "Поиск не ответил. Проверьте сеть и повторите", denied: "Нет доступа к геолокации",
    settings: "Открыть настройки", retry: "Повторить",
    replaceTitle: "Заменить маршрут?", replaceBody: "Сейчас уже построен маршрут. Заменить его на это место?",
    replace: "Заменить", cancel: "Отмена", meters: "м", km: "км",
  },
  uk: {
    title: "Поруч", gas: "АЗС", parking: "Парковка", food: "Кафе і ресторани",
    repair: "Ремонт і шиномонтаж", hospital: "Лікарня", pharmacy: "Аптека",
    cameras: "Камери поруч",
    go: "Поїхати", loading: "Шукаємо місця…", empty: "Поруч нічого не знайдено",
    error: "Немає мережі. Пошук не виконано", timeout: "Пошук не відповів. Перевірте мережу та повторіть", denied: "Немає доступу до геолокації",
    settings: "Відкрити налаштування", retry: "Повторити",
    replaceTitle: "Замінити маршрут?", replaceBody: "Зараз уже побудовано маршрут. Замінити його на це місце?",
    replace: "Замінити", cancel: "Скасувати", meters: "м", km: "км",
  },
  en: {
    title: "Nearby", gas: "Gas station", parking: "Parking", food: "Cafes and restaurants",
    repair: "Car repair and tire service", hospital: "Hospital", pharmacy: "Pharmacy",
    cameras: "Nearby cameras",
    go: "Go", loading: "Searching nearby…", empty: "Nothing nearby",
    error: "No network. The search did not run", timeout: "The search did not answer. Check the network and try again", denied: "Location permission is denied",
    settings: "Open settings", retry: "Try again",
    replaceTitle: "Replace the route?", replaceBody: "A route is already active. Replace it with this place?",
    replace: "Replace", cancel: "Cancel", meters: "m", km: "km",
  },
  pl: {
    title: "W pobliżu", gas: "Stacja paliw", parking: "Parking", food: "Kawiarnie i restauracje",
    repair: "Naprawa i wulkanizacja", hospital: "Szpital", pharmacy: "Apteka",
    cameras: "Kamery w pobliżu",
    go: "Jedź", loading: "Szukamy miejsc…", empty: "W pobliżu nic nie znaleziono",
    error: "Brak sieci. Wyszukiwanie nie zostało wykonane", timeout: "Wyszukiwanie nie odpowiedziało. Sprawdź sieć i spróbuj ponownie", denied: "Brak dostępu do lokalizacji",
    settings: "Otwórz ustawienia", retry: "Powtórz",
    replaceTitle: "Zastąpić trasę?", replaceBody: "Trasa jest już wyznaczona. Zastąpić ją tym miejscem?",
    replace: "Zastąp", cancel: "Anuluj", meters: "m", km: "km",
  },
};

export function nearbyCopy(language) {
  return NEARBY_COPY[placesLanguage(language)] || NEARBY_COPY.ru;
}

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

function nearbyDistance(fromLat, fromLng, toLat, toLng) {
  const rad = Math.PI / 180;
  const dLat = (toLat - fromLat) * rad;
  const dLng = (toLng - fromLng) * rad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(fromLat * rad) * Math.cos(toLat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function formatNearbyDistance(meters, language) {
  if (!Number.isFinite(meters) || meters < 0) return "";
  const copy = nearbyCopy(language);
  if (meters >= 1000) return `${Math.round(meters / 100) / 10} ${copy.km}`;
  return `${Math.round(meters)} ${copy.meters}`;
}

export function parseNearbyPlaces(payload, origin) {
  const places = Array.isArray(payload?.places) ? payload.places : [];
  const fromLat = Number(origin?.latitude);
  const fromLng = Number(origin?.longitude);
  const originOk = Number.isFinite(fromLat) && Number.isFinite(fromLng);
  const results = [];
  for (const place of places) {
    const name = typeof place?.displayName?.text === "string" ? place.displayName.text.trim() : "";
    const lat = Number(place?.location?.latitude);
    const lng = Number(place?.location?.longitude);
    const id = typeof place?.id === "string" ? place.id : "";
    if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const address = typeof place.formattedAddress === "string" ? place.formattedAddress : "";
    results.push({
      id,
      name,
      address,
      latitude: lat,
      longitude: lng,
      distance: originOk ? nearbyDistance(fromLat, fromLng, lat, lng) : null,
    });
  }
  return results.slice(0, NEARBY_MAX_RESULTS);
}

export function nearbyCategory(categoryId) {
  return NEARBY_CATEGORIES.find(item => item.id === categoryId) || null;
}

export function nearbyFix(permission, coords) {
  if (permission === "denied") return { ok: false, reason: "denied" };
  if (permission !== "granted") return { ok: false, reason: "waiting" };
  const latitude = Number(coords?.latitude);
  const longitude = Number(coords?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { ok: false, reason: "waiting" };
  return { ok: true, latitude, longitude };
}

export function nearbySearchStep(permission, coords) {
  const fix = nearbyFix(permission, coords);
  if (fix.ok) return { step: "search", origin: fix };
  if (fix.reason === "denied") return { step: "denied" };
  return { step: "locate" };
}

export function deadline(work, timeoutMs, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener?.("abort", onAbort);
      fn(value);
    };
    const onAbort = () => finish(reject, placesError("aborted"));
    const timer = setTimeout(() => finish(reject, placesError("timeout")), timeoutMs);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener?.("abort", onAbort, { once: true });
    Promise.resolve()
      .then(work)
      .then(value => finish(resolve, value), error => finish(reject, error));
  });
}

export async function nearbyPlaces({ categoryId, latitude, longitude, languageCode, key, fetch, signal }) {
  if (!key) throw placesError("missing-key");
  const category = nearbyCategory(categoryId);
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!category?.types?.length || !Number.isFinite(lat) || !Number.isFinite(lng)) throw placesError("places-failed");
  const response = await fetch(PLACES_NEARBY_URL, {
    method: "POST",
    headers: placesHeaders(key, NEARBY_FIELD_MASK),
    body: JSON.stringify({
      includedTypes: category.types,
      maxResultCount: NEARBY_MAX_RESULTS,
      rankPreference: "DISTANCE",
      languageCode: placesLanguage(languageCode),
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius: NEARBY_RADIUS_M },
      },
    }),
    signal,
  });
  if (!response.ok) throw placesError("places-failed");
  return parseNearbyPlaces(await response.json(), { latitude: lat, longitude: lng });
}

export async function runNearbySearch({
  categoryId, permission, coords, languageCode, key, fetch, signal, locate, timeoutMs = NEARBY_TIMEOUT_MS,
}) {
  const step = nearbySearchStep(permission, coords);
  if (step.step === "denied") return { status: "denied", places: [] };
  let origin = step.origin || null;
  if (!origin) {
    const located = await deadline(() => locate({ signal }), timeoutMs, signal);
    if (located?.permission === "denied") return { status: "denied", places: [] };
    const fix = nearbyFix("granted", located);
    if (!fix.ok) throw placesError("timeout");
    origin = fix;
  }
  const places = await deadline(() => nearbyPlaces({
    categoryId,
    latitude: origin.latitude,
    longitude: origin.longitude,
    languageCode,
    key,
    fetch,
    signal,
  }), timeoutMs, signal);
  return { status: places.length ? "ready" : "empty", places };
}

export function createNearbyController() {
  let generation = 0;
  let abort = null;
  return {
    async search(args) {
      const mine = ++generation;
      abort?.abort();
      const controller = new AbortController();
      abort = controller;
      try {
        const result = await runNearbySearch({ ...args, signal: controller.signal });
        if (mine !== generation) return { status: "stale", places: [] };
        return result;
      } catch (error) {
        if (mine !== generation || error?.code === "aborted") return { status: "stale", places: [] };
        return { status: error?.code === "timeout" ? "timeout" : "error", places: [] };
      }
    },
    stop() {
      generation += 1;
      abort?.abort();
    },
  };
}

export function nearbyHandoff(place, routeActive) {
  const latitude = Number(place?.latitude);
  const longitude = Number(place?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { action: "ignore" };
  return {
    action: routeActive ? "confirm" : "open",
    destination: {
      lat: latitude,
      lng: longitude,
      title: typeof place?.name === "string" ? place.name : "",
    },
  };
}
