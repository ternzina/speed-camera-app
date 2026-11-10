export const SAVED_PLACES_KEY = "camalert_navtest_saved_places_v1";

const COPY = {
  ru: {
    home: "Дом", work: "Работа", favorites: "Избранное",
    saveHome: "Адрес дома", saveWork: "Адрес работы", saveFavorite: "Адрес места",
    change: "Изменить", delete: "Удалить", cancel: "Отмена", close: "Закрыть",
    replaceTitle: "Заменить маршрут?", replaceBody: "Сейчас уже построен маршрут. Заменить его?", replace: "Заменить",
    go: "Поехать", add: "Добавить", favorite: "В избранное",
    empty: "Избранных мест пока нет", duplicate: "Это место уже в избранном",
    saveFailed: "Не удалось сохранить адрес",
  },
  uk: {
    home: "Дім", work: "Робота", favorites: "Обране",
    saveHome: "Адреса дому", saveWork: "Адреса роботи", saveFavorite: "Адреса місця",
    change: "Змінити", delete: "Видалити", cancel: "Скасувати", close: "Закрити",
    replaceTitle: "Замінити маршрут?", replaceBody: "Маршрут уже побудовано. Замінити його?", replace: "Замінити",
    go: "Поїхати", add: "Додати", favorite: "До обраного",
    empty: "Обраних місць поки немає", duplicate: "Це місце вже в обраному",
    saveFailed: "Не вдалося зберегти адресу",
  },
  en: {
    home: "Home", work: "Work", favorites: "Favorites",
    saveHome: "Home address", saveWork: "Work address", saveFavorite: "Place address",
    change: "Change", delete: "Delete", cancel: "Cancel", close: "Close",
    replaceTitle: "Replace the route?", replaceBody: "A route is already built. Replace it?", replace: "Replace",
    go: "Go", add: "Add", favorite: "Add to favorites",
    empty: "No favorite places yet", duplicate: "This place is already a favorite",
    saveFailed: "The address could not be saved",
  },
  pl: {
    home: "Dom", work: "Praca", favorites: "Ulubione",
    saveHome: "Adres domu", saveWork: "Adres pracy", saveFavorite: "Adres miejsca",
    change: "Zmień", delete: "Usuń", cancel: "Anuluj", close: "Zamknij",
    replaceTitle: "Zastąpić trasę?", replaceBody: "Trasa jest już zbudowana. Zastąpić ją?", replace: "Zastąp",
    go: "Jedź", add: "Dodaj", favorite: "Do ulubionych",
    empty: "Nie ma jeszcze ulubionych miejsc", duplicate: "To miejsce jest już w ulubionych",
    saveFailed: "Nie udało się zapisać adresu",
  },
};

export function savedPlaceCopy(language) {
  return COPY[language] || COPY.ru;
}

export function emptySavedPlaces() {
  return { home: null, work: null, favorites: [] };
}

export function normalizeSavedPlace(place) {
  if (!place || typeof place !== "object") return null;
  const name = typeof place.name === "string" ? place.name.trim() : "";
  const latitude = Number(place.latitude ?? place.lat);
  const longitude = Number(place.longitude ?? place.lng);
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const address = typeof place.address === "string" ? place.address.trim() : "";
  const rawId = typeof place.placeId === "string" ? place.placeId : typeof place.id === "string" ? place.id : "";
  const placeId = rawId.trim();
  return { name, address, latitude, longitude, placeId };
}

export function parseSavedPlaces(raw) {
  let data = raw;
  if (typeof raw === "string") {
    try { data = JSON.parse(raw); }
    catch { return emptySavedPlaces(); }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return emptySavedPlaces();
  const favorites = Array.isArray(data.favorites) ? data.favorites.map(normalizeSavedPlace).filter(Boolean) : [];
  return {
    home: normalizeSavedPlace(data.home),
    work: normalizeSavedPlace(data.work),
    favorites,
  };
}

export function savedPlaceFromSuggestion(result, located) {
  return normalizeSavedPlace({
    name: result?.title || result?.name,
    address: result?.address,
    latitude: result?.lat ?? result?.latitude ?? located?.lat,
    longitude: result?.lng ?? result?.longitude ?? located?.lng,
    placeId: result?.placeId || "",
  });
}

export function savedPlaceFromNearby(place) {
  return normalizeSavedPlace({
    name: place?.name,
    address: place?.address,
    latitude: place?.latitude,
    longitude: place?.longitude,
    placeId: place?.id || place?.placeId || "",
  });
}

export function assignSavedSlot(store, slot, place) {
  const base = parseSavedPlaces(store);
  if (slot !== "home" && slot !== "work") return base;
  const clean = normalizeSavedPlace(place);
  if (!clean) return base;
  return { home: base.home, work: base.work, favorites: base.favorites, [slot]: clean };
}

export function clearSavedSlot(store, slot) {
  const base = parseSavedPlaces(store);
  if (slot !== "home" && slot !== "work") return base;
  return { home: base.home, work: base.work, favorites: base.favorites, [slot]: null };
}

export function addFavorite(store, place) {
  const base = parseSavedPlaces(store);
  const clean = normalizeSavedPlace(place);
  if (!clean) return { store: base, added: false, reason: "invalid" };
  if (isDuplicateFavorite(base.favorites, clean)) return { store: base, added: false, reason: "duplicate" };
  return { store: { ...base, favorites: base.favorites.concat(clean) }, added: true };
}

export function removeFavorite(store, place) {
  const base = parseSavedPlaces(store);
  const placeId = typeof place?.placeId === "string" ? place.placeId.trim() : "";
  const spot = normalizeSavedPlace(place);
  const favorites = base.favorites.filter(item => {
    if (placeId && item.placeId === placeId) return false;
    if (!placeId && spot && sameSpot(item, spot)) return false;
    return true;
  });
  return { ...base, favorites };
}

export function savedPlaceRoute(place, routeActive) {
  const clean = normalizeSavedPlace(place);
  if (!clean) return { action: "ignore" };
  const destination = { lat: clean.latitude, lng: clean.longitude, title: clean.name };
  if (clean.placeId) destination.placeId = clean.placeId;
  return { action: routeActive ? "confirm" : "open", destination };
}

export async function loadSavedPlaces(storage) {
  try {
    return parseSavedPlaces(await storage.getItem(SAVED_PLACES_KEY));
  } catch {
    return emptySavedPlaces();
  }
}

export async function storeSavedPlaces(storage, value) {
  const safe = parseSavedPlaces(value);
  await storage.setItem(SAVED_PLACES_KEY, JSON.stringify(safe));
  return safe;
}

function sameSpot(a, b) {
  return a.name === b.name && a.latitude === b.latitude && a.longitude === b.longitude;
}

function isDuplicateFavorite(favorites, place) {
  if (place.placeId && favorites.some(item => item.placeId === place.placeId)) return true;
  if (!place.placeId && favorites.some(item => sameSpot(item, place))) return true;
  return false;
}
