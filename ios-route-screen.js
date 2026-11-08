import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Polyline } from "react-native-maps";
import * as Location from "expo-location";
import SystemSafeArea from "./system-safe-area";
import { calculateRoutes, searchPlaces } from "./ios-mapkit-directions";
import { formatDistance, formatDuration, packRoute, regionForCoordinates } from "./route-guidance";

const COPY = {
  ru: {
    title: "Маршрут в CamAlert",
    back: "Назад",
    placeholder: "Адрес или место",
    search: "Найти",
    searching: "Ищем адрес в Apple Maps…",
    routing: "Строим маршруты Apple…",
    empty: "Ничего не найдено. Уточните адрес.",
    emptyQuery: "Введите адрес.",
    noGps: "Нет координат телефона. Включите геолокацию и повторите.",
    noRoute: "Apple не вернула автомобильный маршрут.",
    unavailable: "Этот модуль MapKit не подключён к сборке.",
    failed: "Запрос к Apple Maps не выполнен.",
    choose: "Выберите точку. Список ниже — ответ MKLocalSearch, без подставных адресов.",
    alternatives: "Варианты Apple",
    guide: "Вести в CamAlert",
    apple: "Открыть в Apple Maps",
    google: "Открыть в Google Maps",
    eta: "Оценка Apple",
  },
  uk: {
    title: "Маршрут у CamAlert",
    back: "Назад",
    placeholder: "Адреса або місце",
    search: "Знайти",
    searching: "Шукаємо адресу в Apple Maps…",
    routing: "Будуємо маршрути Apple…",
    empty: "Нічого не знайдено. Уточніть адресу.",
    emptyQuery: "Введіть адресу.",
    noGps: "Немає координат телефона. Увімкніть геолокацію і повторіть.",
    noRoute: "Apple не повернула автомобільний маршрут.",
    unavailable: "Цей модуль MapKit не підключено до збірки.",
    failed: "Запит до Apple Maps не виконано.",
    choose: "Оберіть точку. Список нижче — відповідь MKLocalSearch.",
    alternatives: "Варіанти Apple",
    guide: "Вести в CamAlert",
    apple: "Відкрити в Apple Maps",
    google: "Відкрити в Google Maps",
    eta: "Оцінка Apple",
  },
  en: {
    title: "Route in CamAlert",
    back: "Back",
    placeholder: "Address or place",
    search: "Search",
    searching: "Searching Apple Maps…",
    routing: "Asking Apple for routes…",
    empty: "No results. Try a more precise address.",
    emptyQuery: "Enter an address.",
    noGps: "This phone has no coordinate yet. Turn location on and try again.",
    noRoute: "Apple did not return a driving route.",
    unavailable: "This build does not include the MapKit module.",
    failed: "The Apple Maps request failed.",
    choose: "Pick a place. The list is the MKLocalSearch response.",
    alternatives: "Apple routes",
    guide: "Guide in CamAlert",
    apple: "Open in Apple Maps",
    google: "Open in Google Maps",
    eta: "Apple estimate",
  },
  pl: {
    title: "Trasa w CamAlert",
    back: "Wstecz",
    placeholder: "Adres lub miejsce",
    search: "Szukaj",
    searching: "Szukamy adresu w Apple Maps…",
    routing: "Wyznaczamy trasy Apple…",
    empty: "Brak wyników. Doprecyzuj adres.",
    emptyQuery: "Wpisz adres.",
    noGps: "Telefon nie ma jeszcze współrzędnych. Włącz lokalizację i spróbuj ponownie.",
    noRoute: "Apple nie zwróciło trasy samochodowej.",
    unavailable: "Ta kompilacja nie zawiera modułu MapKit.",
    failed: "Zapytanie do Apple Maps nie powiodło się.",
    choose: "Wybierz punkt. Lista pochodzi z MKLocalSearch.",
    alternatives: "Warianty Apple",
    guide: "Prowadź w CamAlert",
    apple: "Otwórz w Apple Maps",
    google: "Otwórz w Google Maps",
    eta: "Szacunek Apple",
  },
};

function copyFor(language) {
  return COPY[language] || COPY.ru;
}

function failureText(error, copy) {
  const code = error?.code || error?.message;
  if (code === "mapkit-unavailable") return copy.unavailable;
  if (code === "EmptyQuery") return copy.emptyQuery;
  if (code === "missing-endpoint" || code === "InvalidCoordinate") return copy.noGps;
  if (code === "no-route") return copy.noRoute;
  if (typeof error?.message === "string" && error.message) return error.message;
  return copy.failed;
}

function placeLabel(place) {
  if (place.title && place.subtitle) return `${place.title} · ${place.subtitle}`;
  if (place.title || place.subtitle) return place.title || place.subtitle;
  return `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`;
}

export default function IosRouteScreen({ language, night, initialQuery, coords, onClose, onStartGuidance, onOpenApple, onOpenGoogle }) {
  const copy = copyFor(language);
  const [query, setQuery] = useState(initialQuery || "");
  const [places, setPlaces] = useState([]);
  const [destination, setDestination] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const bg = night ? "#0B1829" : "#F7FBFF";
  const fg = night ? "#F7FBFF" : "#102A4D";
  const muted = night ? "#CAD7E7" : "#526A80";
  const route = routes[selected] || null;
  const mapPoints = route?.polyline || (destination ? [destination] : coords ? [coords] : []);
  const region = regionForCoordinates(mapPoints);

  async function origin() {
    if (coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)) return coords;
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const next = { latitude: position?.coords?.latitude, longitude: position?.coords?.longitude };
    if (!Number.isFinite(next.latitude) || !Number.isFinite(next.longitude)) throw new Error("missing-endpoint");
    return next;
  }

  async function runSearch() {
    setBusy("search");
    setError("");
    setRoutes([]);
    setDestination(null);
    try {
      const found = await searchPlaces(query, coords);
      setPlaces(found);
      if (!found.length) setError(copy.empty);
    } catch (searchError) {
      setPlaces([]);
      setError(failureText(searchError, copy));
    } finally {
      setBusy("");
    }
  }

  async function choosePlace(place) {
    setBusy("route");
    setError("");
    setDestination(place);
    setPlaces([]);
    try {
      const from = await origin();
      const found = await calculateRoutes(from, place);
      setRoutes(found);
      setSelected(0);
    } catch (routeError) {
      setRoutes([]);
      setError(failureText(routeError, copy));
    } finally {
      setBusy("");
    }
  }

  async function start() {
    if (!route || !destination || busy) return;
    setBusy("start");
    setError("");
    try {
      const packed = packRoute(destination, placeLabel(destination), route);
      const started = await onStartGuidance(packed);
      if (started === false) setError(copy.noGps);
    } catch (startError) {
      setError(failureText(startError, copy));
    } finally {
      setBusy("");
    }
  }

  return (
    <SystemSafeArea style={[styles.root, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={onClose} style={styles.back}>
          <Text style={[styles.backMark, { color: fg }]}>‹</Text>
          <Text style={[styles.backText, { color: fg }]}>{copy.back}</Text>
        </Pressable>
        <Text numberOfLines={1} style={[styles.title, { color: fg }]}>{copy.title}</Text>
      </View>
      <View style={styles.row}>
        <TextInput
          accessibilityLabel={copy.placeholder}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={runSearch}
          placeholder={copy.placeholder}
          placeholderTextColor={muted}
          autoCorrect={false}
          style={[styles.input, { color: fg, borderColor: muted }]}
        />
        <Pressable accessibilityRole="button" disabled={!!busy} onPress={runSearch} style={[styles.button, busy && styles.dimmed]}>
          <Text style={styles.buttonText}>{copy.search}</Text>
        </Pressable>
      </View>
      <Text style={[styles.note, { color: muted }]}>{copy.choose}</Text>
      {!!busy && <View style={styles.busy}><ActivityIndicator color="#1260E8" /><Text style={[styles.note, { color: muted }]}>{busy === "search" ? copy.searching : copy.routing}</Text></View>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!!places.length && (
        <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
          {places.map((place, index) => (
            <Pressable accessibilityRole="button" key={`${place.latitude}-${place.longitude}-${index}`} onPress={() => choosePlace(place)} style={styles.result}>
              <Text style={{ color: fg }}>{placeLabel(place)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {region && (
        <MapView style={styles.map} initialRegion={region} key={`${region.latitude.toFixed(3)}-${region.longitude.toFixed(3)}-${routes.length}`} toolbarEnabled={false}>
          {routes.map((item, index) => (
            <Polyline key={`${item.name}-${index}`} coordinates={item.polyline} strokeColor={index === selected ? "#1260E8" : "#8FA3B8"} strokeWidth={index === selected ? 6 : 3} />
          ))}
        </MapView>
      )}
      {!!routes.length && <Text style={[styles.note, { color: fg }]}>{copy.alternatives}</Text>}
      {!!routes.length && (
        <ScrollView style={styles.results}>
          {routes.map((item, index) => {
            const distance = formatDistance(language, item.distance);
            const eta = formatDuration(language, item.expectedTravelTime);
            return (
              <Pressable accessibilityRole="button" accessibilityState={{ selected: index === selected }} key={`${item.expectedTravelTime}-${index}`} onPress={() => setSelected(index)} style={[styles.result, index === selected && styles.selected]}>
                <Text style={{ color: fg, fontWeight: "700" }}>{item.name || `${index + 1}`}</Text>
                <Text style={{ color: muted }}>{distance} · {copy.eta}: {eta}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <View style={styles.actions}>
        {route && <Pressable accessibilityRole="button" disabled={!!busy} onPress={start} style={[styles.button, styles.wide, busy && styles.dimmed]}><Text style={styles.buttonText}>{copy.guide}</Text></Pressable>}
        {destination && <Pressable accessibilityRole="button" onPress={() => onOpenApple(destination)} style={styles.secondary}><Text style={styles.secondaryText}>{copy.apple}</Text></Pressable>}
        {destination && <Pressable accessibilityRole="button" onPress={() => onOpenGoogle(destination)} style={styles.secondary}><Text style={styles.secondaryText}>{copy.google}</Text></Pressable>}
      </View>
    </SystemSafeArea>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, minHeight: 48 },
  back: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingRight: 8 },
  backMark: { fontSize: 28, marginRight: 4 },
  backText: { fontSize: 17, fontWeight: "700" },
  title: { flex: 1, fontSize: 19, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8, paddingHorizontal: 12 },
  input: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 12, padding: 12 },
  button: { backgroundColor: "#1260E8", borderRadius: 14, minHeight: 48, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  wide: { alignSelf: "stretch" },
  buttonText: { color: "white", fontWeight: "700", fontSize: 16 },
  dimmed: { opacity: 0.45 },
  note: { fontSize: 13, paddingHorizontal: 16, paddingVertical: 6 },
  error: { color: "#9A3700", fontSize: 14, paddingHorizontal: 16, paddingBottom: 6 },
  busy: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16 },
  results: { maxHeight: 150 },
  result: { paddingHorizontal: 16, paddingVertical: 12 },
  selected: { backgroundColor: "rgba(18,96,232,0.12)" },
  map: { flex: 1, minHeight: 160 },
  actions: { padding: 12, gap: 8 },
  secondary: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#1260E8", fontWeight: "700", fontSize: 16 },
});
