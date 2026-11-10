import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import SystemSafeArea from "./system-safe-area";
import { calculateRoutes, searchPlaces } from "./ios-mapkit-directions";
import { formatDistance, formatDuration, packRoute, regionForCoordinates } from "./route-guidance";
import {
  canBuildRoute,
  centerPick,
  finitePoint,
  formatCoordinates,
  movedEnough,
  openingRegion,
  placeNameFromGeocode,
} from "./route-map-pick";

const COPY = {
  ru: {
    title: "Маршрут в CamAlert",
    back: "Назад",
    locate: "Моё местоположение",
    placeholder: "Адрес или место",
    search: "Найти",
    find: "Найти адрес",
    hideSearch: "Скрыть поиск",
    searching: "Ищем адрес в Apple Maps…",
    routing: "Строим маршруты Apple…",
    empty: "Ничего не найдено. Уточните адрес.",
    emptyQuery: "Введите адрес.",
    noGps: "Нет координат телефона. Включите геолокацию и повторите.",
    noRoute: "Apple не вернула автомобильный маршрут.",
    unavailable: "Этот модуль MapKit не подключён к сборке.",
    failed: "Запрос к Apple Maps не выполнен.",
    hint: "Сдвиньте карту или нажмите на неё. Точка — центр карты.",
    picked: "Точка",
    noAddress: "Адрес не найден. Маршрут можно построить по координатам.",
    build: "Построить маршрут",
    cancel: "Отменить точку",
    alternatives: "Варианты Apple",
    guide: "В путь",
    apple: "Открыть в Apple Maps",
    google: "Открыть в Google Maps",
    eta: "Оценка Apple",
  },
  uk: {
    title: "Маршрут у CamAlert",
    back: "Назад",
    locate: "Моє місцезнаходження",
    placeholder: "Адреса або місце",
    search: "Знайти",
    find: "Знайти адресу",
    hideSearch: "Сховати пошук",
    searching: "Шукаємо адресу в Apple Maps…",
    routing: "Будуємо маршрути Apple…",
    empty: "Нічого не знайдено. Уточніть адресу.",
    emptyQuery: "Введіть адресу.",
    noGps: "Немає координат телефона. Увімкніть геолокацію і повторіть.",
    noRoute: "Apple не повернула автомобільний маршрут.",
    unavailable: "Цей модуль MapKit не підключено до збірки.",
    failed: "Запит до Apple Maps не виконано.",
    hint: "Зсуньте карту або торкніться її. Точка — центр карти.",
    picked: "Точка",
    noAddress: "Адресу не знайдено. Маршрут можна побудувати за координатами.",
    build: "Побудувати маршрут",
    cancel: "Скасувати точку",
    alternatives: "Варіанти Apple",
    guide: "У дорогу",
    apple: "Відкрити в Apple Maps",
    google: "Відкрити в Google Maps",
    eta: "Оцінка Apple",
  },
  en: {
    title: "Route in CamAlert",
    back: "Back",
    locate: "My location",
    placeholder: "Address or place",
    search: "Search",
    find: "Find an address",
    hideSearch: "Hide search",
    searching: "Searching Apple Maps…",
    routing: "Asking Apple for routes…",
    empty: "No results. Try a more precise address.",
    emptyQuery: "Enter an address.",
    noGps: "This phone has no coordinate yet. Turn location on and try again.",
    noRoute: "Apple did not return a driving route.",
    unavailable: "This build does not include the MapKit module.",
    failed: "The Apple Maps request failed.",
    hint: "Move the map or tap it. The point is the map center.",
    picked: "Point",
    noAddress: "No address found. A route can still be built from the coordinates.",
    build: "Build route",
    cancel: "Cancel point",
    alternatives: "Apple routes",
    guide: "Start guidance",
    apple: "Open in Apple Maps",
    google: "Open in Google Maps",
    eta: "Apple estimate",
  },
  pl: {
    title: "Trasa w CamAlert",
    back: "Wstecz",
    locate: "Moja lokalizacja",
    placeholder: "Adres lub miejsce",
    search: "Szukaj",
    find: "Znajdź adres",
    hideSearch: "Ukryj wyszukiwanie",
    searching: "Szukamy adresu w Apple Maps…",
    routing: "Wyznaczamy trasy Apple…",
    empty: "Brak wyników. Doprecyzuj adres.",
    emptyQuery: "Wpisz adres.",
    noGps: "Telefon nie ma jeszcze współrzędnych. Włącz lokalizację i spróbuj ponownie.",
    noRoute: "Apple nie zwróciło trasy samochodowej.",
    unavailable: "Ta kompilacja nie zawiera modułu MapKit.",
    failed: "Zapytanie do Apple Maps nie powiodło się.",
    hint: "Przesuń mapę albo stuknij ją. Punkt to środek mapy.",
    picked: "Punkt",
    noAddress: "Nie znaleziono adresu. Trasę można wyznaczyć ze współrzędnych.",
    build: "Wyznacz trasę",
    cancel: "Anuluj punkt",
    alternatives: "Warianty Apple",
    guide: "W drogę",
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
  return formatCoordinates(place);
}

export default function IosRouteScreen({ language, night, initialQuery, coords, onClose, onStartGuidance, onOpenApple, onOpenGoogle }) {
  const copy = copyFor(language);
  const mapRef = useRef(null);
  const opened = openingRegion(coords);
  const userMoved = useRef(false);
  const openedOnFix = useRef(opened.followsUser);
  const routeLock = useRef(false);
  const geocodeToken = useRef(0);
  const lastPick = useRef(null);
  const followedFix = useRef(opened.followsUser);
  const [query, setQuery] = useState(initialQuery || "");
  const [searchOpen, setSearchOpen] = useState(false);
  const [places, setPlaces] = useState([]);
  const [destination, setDestination] = useState(null);
  const [placeName, setPlaceName] = useState("");
  const [routes, setRoutes] = useState([]);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState("");
  const [userFix, setUserFix] = useState(opened.followsUser ? { latitude: Number(coords.latitude), longitude: Number(coords.longitude) } : null);
  const bg = night ? "#0B1829" : "#F7FBFF";
  const fg = night ? "#F7FBFF" : "#102A4D";
  const muted = night ? "#CAD7E7" : "#526A80";
  const card = night ? "#10263B" : "#FFFFFF";
  const route = routes[selected] || null;
  const picking = !route;

  useEffect(() => {
    if (!finitePoint(coords) || followedFix.current || userMoved.current) return;
    followedFix.current = true;
    openedOnFix.current = true;
    const point = { latitude: Number(coords.latitude), longitude: Number(coords.longitude) };
    setUserFix(point);
    mapRef.current?.animateToRegion({ ...point, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 250);
  }, [coords]);

  async function describe(point, knownName) {
    const token = geocodeToken.current + 1;
    geocodeToken.current = token;
    if (knownName) {
      setGeocoding(false);
      setPlaceName(knownName);
      return;
    }
    setPlaceName("");
    setGeocoding(true);
    try {
      const rows = await Location.reverseGeocodeAsync({ latitude: point.latitude, longitude: point.longitude });
      if (token !== geocodeToken.current) return;
      setPlaceName(placeNameFromGeocode(rows?.[0]));
    } catch {
      if (token !== geocodeToken.current) return;
      setPlaceName("");
    } finally {
      if (token === geocodeToken.current) setGeocoding(false);
    }
  }

  function commitPick(point, knownName) {
    if (!finitePoint(point)) return;
    const next = { latitude: Number(point.latitude), longitude: Number(point.longitude) };
    if (!movedEnough(lastPick.current, next)) return;
    lastPick.current = next;
    setDestination(knownName ? { ...next, title: knownName } : next);
    setRoutes([]);
    setSelected(0);
    routeLock.current = false;
    describe(next, knownName);
  }

  function onRegionChangeComplete(region) {
    const point = centerPick(region, {
      userMoved: userMoved.current,
      openedOnFix: openedOnFix.current,
      routeLocked: routeLock.current,
    });
    if (!point) return;
    if (openedOnFix.current) openedOnFix.current = false;
    commitPick(point);
  }

  function beginPickGesture() {
    userMoved.current = true;
    openedOnFix.current = false;
    if (routeLock.current) {
      routeLock.current = false;
      setRoutes([]);
    }
  }

  function onMapPress(event) {
    const point = event?.nativeEvent?.coordinate;
    if (!finitePoint(point)) return;
    beginPickGesture();
    mapRef.current?.animateToRegion({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 250);
  }

  async function origin() {
    if (finitePoint(userFix)) return userFix;
    if (finitePoint(coords)) return { latitude: Number(coords.latitude), longitude: Number(coords.longitude) };
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const next = { latitude: position?.coords?.latitude, longitude: position?.coords?.longitude };
    if (!finitePoint(next)) throw new Error("missing-endpoint");
    setUserFix(next);
    return next;
  }

  async function goToMe() {
    setError("");
    try {
      const point = await origin();
      userMoved.current = true;
      routeLock.current = false;
      setRoutes([]);
      mapRef.current?.animateToRegion({ ...point, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 300);
    } catch (locateError) {
      setError(failureText(locateError, copy));
    }
  }

  function cancelPick() {
    geocodeToken.current += 1;
    lastPick.current = null;
    userMoved.current = false;
    openedOnFix.current = false;
    routeLock.current = false;
    setGeocoding(false);
    setDestination(null);
    setPlaceName("");
    setRoutes([]);
    setSelected(0);
    setPlaces([]);
    setError("");
  }

  async function runSearch() {
    setBusy("search");
    setError("");
    try {
      const bias = finitePoint(userFix) ? userFix : finitePoint(coords) ? coords : destination;
      const found = await searchPlaces(query, bias);
      setPlaces(found);
      if (!found.length) setError(copy.empty);
    } catch (searchError) {
      setPlaces([]);
      setError(failureText(searchError, copy));
    } finally {
      setBusy("");
    }
  }

  function choosePlace(place) {
    if (!finitePoint(place)) return;
    setPlaces([]);
    setSearchOpen(false);
    userMoved.current = true;
    routeLock.current = false;
    const label = placeLabel(place);
    lastPick.current = null;
    commitPick(place, label);
    mapRef.current?.animateToRegion({
      latitude: Number(place.latitude),
      longitude: Number(place.longitude),
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 300);
  }

  async function buildRoute() {
    if (!canBuildRoute(destination) || busy) return;
    setBusy("route");
    setError("");
    try {
      const from = await origin();
      const found = await calculateRoutes(from, destination);
      routeLock.current = true;
      setRoutes(found);
      setSelected(0);
      const region = regionForCoordinates(found[0]?.polyline);
      if (region) mapRef.current?.animateToRegion(region, 350);
    } catch (routeError) {
      setRoutes([]);
      routeLock.current = false;
      setError(failureText(routeError, copy));
    } finally {
      setBusy("");
    }
  }

  function chooseRoute(index) {
    setSelected(index);
    const region = regionForCoordinates(routes[index]?.polyline);
    if (region) {
      routeLock.current = true;
      mapRef.current?.animateToRegion(region, 300);
    }
  }

  async function start() {
    if (!route || !canBuildRoute(destination) || busy) return;
    setBusy("start");
    setError("");
    try {
      const label = placeName || (destination.title ? placeLabel(destination) : formatCoordinates(destination));
      const packed = packRoute(destination, label, route);
      const started = await onStartGuidance(packed);
      if (started === false) setError(copy.noGps);
    } catch (startError) {
      setError(failureText(startError, copy));
    } finally {
      setBusy("");
    }
  }

  const coordinateLabel = formatCoordinates(destination);

  return (
    <SystemSafeArea style={[styles.root, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={onClose} style={styles.back}>
            <Text style={[styles.backMark, { color: fg }]}>‹</Text>
            <Text style={[styles.backText, { color: fg }]}>{copy.back}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.locate} onPress={goToMe} style={styles.locate}>
            <Text style={styles.locateText}>{copy.locate}</Text>
          </Pressable>
        </View>
        <Text style={[styles.title, { color: fg }]}>{copy.title}</Text>
      </View>
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={opened.region}
          rotateEnabled
          pitchEnabled={false}
          scrollEnabled
          zoomEnabled
          toolbarEnabled={false}
          showsUserLocation={false}
          onPanDrag={beginPickGesture}
          onPress={onMapPress}
          onRegionChangeComplete={onRegionChangeComplete}
        >
          {routes.map((item, index) => (
            <Polyline key={`${item.name}-${index}`} coordinates={item.polyline} strokeColor={index === selected ? "#1260E8" : "#8FA3B8"} strokeWidth={index === selected ? 6 : 3} />
          ))}
          {finitePoint(userFix) && (
            <Marker coordinate={userFix} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={styles.userDot} />
            </Marker>
          )}
          {!picking && finitePoint(destination) && (
            <Marker coordinate={destination} tracksViewChanges={false} />
          )}
        </MapView>
        {picking && (
          <View pointerEvents="none" style={styles.pinLayer}>
            <View style={styles.pin}>
              <View style={styles.pinHead} />
              <View style={styles.pinStem} />
            </View>
          </View>
        )}
      </View>
      <View style={[styles.card, { backgroundColor: card }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.cardContent} bounces={false}>
          <Text style={[styles.note, { color: destination ? fg : muted }]}>
            {destination ? `${copy.picked}: ${coordinateLabel}` : copy.hint}
          </Text>
          {!!destination && !!placeName && <Text style={[styles.note, { color: muted }]}>{placeName}</Text>}
          {!!destination && !placeName && !busy && !geocoding && <Text style={[styles.note, { color: muted }]}>{copy.noAddress}</Text>}
          {!!busy && (
            <View style={styles.busy}>
              <ActivityIndicator color="#1260E8" />
              <Text style={[styles.note, { color: muted }]}>{busy === "search" ? copy.searching : copy.routing}</Text>
            </View>
          )}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Pressable accessibilityRole="button" disabled={!canBuildRoute(destination) || !!busy} onPress={buildRoute} style={[styles.button, (!canBuildRoute(destination) || busy) && styles.dimmed]}>
            <Text style={styles.buttonText}>{copy.build}</Text>
          </Pressable>
          {!!destination && (
            <Pressable accessibilityRole="button" onPress={cancelPick} style={styles.secondary}>
              <Text style={styles.secondaryText}>{copy.cancel}</Text>
            </Pressable>
          )}
          {!!routes.length && <Text style={[styles.note, { color: fg }]}>{copy.alternatives}</Text>}
          {routes.map((item, index) => {
            const distance = formatDistance(language, item.distance);
            const eta = formatDuration(language, item.expectedTravelTime);
            return (
              <Pressable accessibilityRole="button" accessibilityState={{ selected: index === selected }} key={`${item.expectedTravelTime}-${index}`} onPress={() => chooseRoute(index)} style={[styles.result, index === selected && styles.selected]}>
                <Text style={{ color: fg, fontWeight: "700" }}>{item.name || `${index + 1}`}</Text>
                <Text style={{ color: muted }}>{distance} · {copy.eta}: {eta}</Text>
              </Pressable>
            );
          })}
          {route && (
            <Pressable accessibilityRole="button" disabled={!!busy} onPress={start} style={[styles.button, styles.goButton, busy && styles.dimmed]}>
              <Text style={styles.goButtonText}>{copy.guide}</Text>
            </Pressable>
          )}
          {!!destination && (
            <Pressable accessibilityRole="button" onPress={() => onOpenApple(destination)} style={styles.secondary}>
              <Text style={styles.secondaryText}>{copy.apple}</Text>
            </Pressable>
          )}
          {!!destination && (
            <Pressable accessibilityRole="button" onPress={() => onOpenGoogle(destination)} style={styles.secondary}>
              <Text style={styles.secondaryText}>{copy.google}</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" onPress={() => setSearchOpen((open) => !open)} style={styles.secondary}>
            <Text style={styles.secondaryText}>{searchOpen ? copy.hideSearch : copy.find}</Text>
          </Pressable>
          {searchOpen && (
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
              <Pressable accessibilityRole="button" disabled={!!busy} onPress={runSearch} style={[styles.button, styles.searchButton, busy && styles.dimmed]}>
                <Text style={styles.buttonText}>{copy.search}</Text>
              </Pressable>
            </View>
          )}
          {!!places.length && places.map((place, index) => (
            <Pressable accessibilityRole="button" key={`${place.latitude}-${place.longitude}-${index}`} onPress={() => choosePlace(place)} style={styles.result}>
              <Text style={{ color: fg }}>{placeLabel(place)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </SystemSafeArea>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 12, paddingBottom: 6 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  back: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingRight: 8 },
  backMark: { fontSize: 28, marginRight: 4 },
  backText: { fontSize: 17, fontWeight: "700" },
  locate: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8, flexShrink: 1 },
  locateText: { color: "#1260E8", fontSize: 15, fontWeight: "700", textAlign: "right" },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "800" },
  mapWrap: { flex: 1, minHeight: 220 },
  pinLayer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  pin: { alignItems: "center", transform: [{ translateY: -16 }] },
  pinHead: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#1260E8", borderWidth: 3, borderColor: "#FFFFFF" },
  pinStem: { width: 3, height: 14, backgroundColor: "#1260E8" },
  userDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#1FB849", borderWidth: 2, borderColor: "#FFFFFF" },
  card: { maxHeight: "46%", borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  cardContent: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, gap: 6 },
  row: { flexDirection: "row", gap: 8 },
  input: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 12, padding: 12 },
  button: { backgroundColor: "#1260E8", borderRadius: 14, minHeight: 48, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  searchButton: { alignSelf: "stretch" },
  buttonText: { color: "white", fontWeight: "700", fontSize: 16 },
  goButton: { minHeight: 64, borderRadius: 18 },
  goButtonText: { color: "white", fontWeight: "900", fontSize: 22 },
  dimmed: { opacity: 0.45 },
  note: { fontSize: 14, lineHeight: 19 },
  error: { color: "#9A3700", fontSize: 14 },
  busy: { flexDirection: "row", alignItems: "center", gap: 8 },
  result: { paddingVertical: 8 },
  selected: { backgroundColor: "rgba(18,96,232,0.12)", borderRadius: 10, paddingHorizontal: 8 },
  secondary: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#1260E8", fontWeight: "700", fontSize: 16 },
});
