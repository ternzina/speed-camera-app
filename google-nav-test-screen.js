import React, { useEffect, useRef, useState } from "react";
import { Alert, AppState, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AudioGuidance, CameraPerspective, MapType, NavigationNightMode, NavigationProvider, NavigationSessionStatus,
  NavigationView, RouteStatus, TaskRemovedBehavior, TravelMode, useNavigation,
} from "@googlemaps/react-native-navigation-sdk";
import { subscribeCameraSpeech } from "./camera-speech";
import { cameraBanner, googleAudioMode, googleBackgroundLocationEnabled, navChrome } from "./google-nav-banner";
import { keyboardClearance, routeSummary, suggestionViewport, summaryFit } from "./google-nav-chrome";
import { lookupDestinations } from "./google-nav-search";
import { autocompletePlaces, placeDetailsLocation, PLACES_DEBOUNCE_MS, placesLanguage, reduceSearchSchedule } from "./google-places";
import { readPlacesKey } from "./google-places-key";
import {
  NAV_PANEL, addFavorite, assignSavedSlot, clearSavedSlot, emptySavedPlaces, loadSavedPlaces, removeFavorite,
  savedPlaceCopy, savedPlaceFromSuggestion, savedPlaceRoute, storeSavedPlaces,
} from "./navtest-saved-places";
import { withNavigationWindow } from "./navigation-readiness";
import { nativeVoiceGuidance, traceNavVoice } from "./nav-voice-trace";
import { runVoiceDiagAuto } from "./voice-diag-auto";
import { VoiceDiagPanel } from "./voice-diag-panel";
import SystemSafeArea from "./system-safe-area";

function requestVoiceGuidance(controller, index, reason) {
  const guidance = nativeVoiceGuidance(index);
  traceNavVoice("voice.request", { reason, index: Number(index), guidance });
  const send = controller?.setAudioGuidanceType;
  if (typeof send !== "function") {
    traceNavVoice("voice.missing", { reason, guidance });
    return Promise.resolve(false);
  }
  return Promise.resolve(send.call(controller, index)).then(
    () => {
      traceNavVoice("voice.accepted", { reason, guidance });
      return true;
    },
    (error) => {
      traceNavVoice("voice.rejected", {
        reason,
        guidance,
        error: String(error?.message || error).slice(0, 120),
      });
      return false;
    },
  );
}

const COPY = {
  ru: {
    where: "Куда едем?", build: "Построить маршрут", go: "В путь", endRoute: "Завершить маршрут",
    endTrip: "Завершить поездку", road: "Схема", satellite: "Спутник", hybrid: "Гибрид",
    voice: "Голос", voiceOff: "Без голоса", layers: "Слои карты", locate: "Моё место",
    pick: "Долгое нажатие выбирает точку", routed: "Маршрут построен. Ведение начнётся после «В путь».",
    camera: "Камера", terms: "Нужно принять условия Google Navigation.",
    auth: "Навигация Google не открылась.",
    failed: "Не удалось открыть навигацию Google.", noRoute: "Маршрут не найден.",
    back: "Назад", reroute: "Строится новый маршрут",
    searching: "Ищем адрес…", empty: "Ничего не найдено", searchFailed: "Не удалось найти адрес",
    searchKey: "Поиск адреса сейчас недоступен", point: "Точка", meters: "м", speedUnit: "км/ч",
  },
  uk: {
    where: "Куди їдемо?", build: "Побудувати маршрут", go: "У дорогу", endRoute: "Завершити маршрут",
    endTrip: "Завершити поїздку", road: "Схема", satellite: "Супутник", hybrid: "Гібрид",
    voice: "Голос", voiceOff: "Без голосу", layers: "Шари карти", locate: "Моє місце",
    pick: "Довге натискання вибирає точку", routed: "Маршрут побудовано. Ведення почнеться після «У дорогу».",
    camera: "Камера", terms: "Потрібно прийняти умови Google Navigation.",
    auth: "Навігація Google не відкрилася.", failed: "Не вдалося відкрити навігацію Google.",
    noRoute: "Маршрут не знайдено.", back: "Назад", reroute: "Будується новий маршрут",
    searching: "Шукаємо адресу…", empty: "Нічого не знайдено", searchFailed: "Не вдалося знайти адресу",
    searchKey: "Пошук адреси зараз недоступний", point: "Точка", meters: "м", speedUnit: "км/год",
  },
  en: {
    where: "Where to?", build: "Build route", go: "Start guidance", endRoute: "End route",
    endTrip: "End trip", road: "Road", satellite: "Satellite", hybrid: "Hybrid",
    voice: "Voice", voiceOff: "Voice off", layers: "Map layers", locate: "My location",
    pick: "Long-press the map to pick a point", routed: "Route ready. Guidance starts after the button.",
    camera: "Camera", terms: "Accept the Google Navigation terms.",
    auth: "Google navigation did not open.", failed: "Google navigation failed.",
    noRoute: "No route found.", back: "Back", reroute: "Building a new route",
    searching: "Searching…", empty: "Nothing found", searchFailed: "Address search failed",
    searchKey: "Address search is unavailable", point: "Point", meters: "m", speedUnit: "km/h",
  },
  pl: {
    where: "Dokąd jedziemy?", build: "Wyznacz trasę", go: "W drogę", endRoute: "Zakończ trasę",
    endTrip: "Zakończ przejazd", road: "Mapa", satellite: "Satelita", hybrid: "Hybryda",
    voice: "Głos", voiceOff: "Bez głosu", layers: "Warstwy mapy", locate: "Moja pozycja",
    pick: "Przytrzymaj mapę, aby wybrać punkt", routed: "Trasa gotowa. Prowadzenie zacznie się po przycisku.",
    camera: "Kamera", terms: "Zaakceptuj warunki Google Navigation.",
    auth: "Nawigacja Google nie wystartowała.", failed: "Nawigacja Google nie ruszyła.",
    noRoute: "Nie znaleziono trasy.", back: "Wstecz", reroute: "Wyznaczanie nowej trasy",
    searching: "Szukamy adresu…", empty: "Nic nie znaleziono", searchFailed: "Nie udało się znaleźć adresu",
    searchKey: "Wyszukiwanie adresu jest niedostępne", point: "Punkt", meters: "m", speedUnit: "km/h",
  },
};

const terms = { title: "Google Navigation", companyName: "CamAlert", showOnlyDisclaimer: false };
const MAPS = [
  [MapType.NORMAL, "road"],
  [MapType.SATELLITE, "satellite"],
  [MapType.HYBRID, "hybrid"],
];

export default function GoogleNavTestScreen(props) {
  const controllerRef = useRef(null);
  const diagnosticBridge = useRef({ controllerRef, setGuiding: () => {} });
  const [diagGuiding, setDiagGuiding] = useState(false);
  diagnosticBridge.current.setGuiding = setDiagGuiding;
  const body = (
    <NavigationProvider termsAndConditionsDialogOptions={terms} taskRemovedBehavior={TaskRemovedBehavior.QUIT_SERVICE}>
      <GoogleNavBody {...props} diagnosticBridge={props.diagnostic ? diagnosticBridge : null} />
    </NavigationProvider>
  );
  if (!props.diagnostic) return body;
  return (
    <View style={styles.diagnosticRoot}>
      {body}
      <VoiceDiagPanel
        controllerRef={controllerRef}
        guiding={diagGuiding}
        voiceEnabled={props.voiceEnabled}
        requestVoice={(index, reason) => requestVoiceGuidance(controllerRef.current, index, reason)}
      />
    </View>
  );
}

function GoogleNavBody({
  language, night, coords, camera, cameraType, voiceEnabled, onToggleVoice,
  picking, tripActive, onStartTrip, onStopTrip, onClosePick, handoff, onRouteActive,
  diagnostic = false, diagnosticBridge = null,
}) {
  const copy = COPY[language] || COPY.ru;
  const places = savedPlaceCopy(language);
  const { navigationController: controller, setOnRemainingTimeOrDistanceChanged, setOnReroutingRequestedByOffRoute, setOnTurnByTurn, setOnLocationChanged } = useNavigation();
  const controllerRef = useRef(controller);
  controllerRef.current = controller;
  const alive = useRef(true);
  const ready = useRef(false);
  const guidingRef = useRef(false);
  const autoStarted = useRef(false);
  const cameraSpeakingRef = useRef(false);
  const [point, setPoint] = useState(null);
  const [query, setQuery] = useState("");
  const [routed, setRouted] = useState(false);
  const [guiding, setGuiding] = useState(false);
  useEffect(() => {
    const link = diagnosticBridge?.current;
    if (!link) return;
    link.controllerRef.current = controller;
    link.setGuiding(guiding);
  }, [controller, guiding, diagnosticBridge]);
  const [mapType, setMapType] = useState(MapType.NORMAL);
  const [layersOpen, setLayersOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rerouting, setRerouting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [pads, setPads] = useState({ top: 112, bottom: 148 });
  const [suggestions, setSuggestions] = useState([]);
  const [searchNote, setSearchNote] = useState("");
  const [saved, setSaved] = useState(emptySavedPlaces);
  const [saveSlot, setSaveSlot] = useState(null);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [placesOpen, setPlacesOpen] = useState(false);
  const savedRef = useRef(emptySavedPlaces());
  savedRef.current = saved;
  const navView = useRef(null);
  const searchField = useRef(null);
  const handoffToken = useRef(null);
  const probeRef = useRef(null);
  const schedule = useRef({ text: "", token: null, sendAt: null });
  const suppressQuery = useRef("");
  const palette = night ? DARK : LIGHT;
  const { height: windowHeight } = useWindowDimensions();
  const [contentBottom, setContentBottom] = useState(0);
  const [keyboardTop, setKeyboardTop] = useState(null);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    let live = true;
    loadSavedPlaces(AsyncStorage).then(value => {
      if (live && alive.current) setSaved(value);
    }).catch(() => {
      if (live && alive.current) setSaved(emptySavedPlaces());
    });
    return () => { live = false; };
  }, []);

  function setRoadSnapBackground(enabled) {
    if (!ready.current) return;
    try { controllerRef.current.setBackgroundLocationUpdatesEnabled(!!enabled); } catch (_) {}
  }

  useEffect(() => {
    setRoadSnapBackground(googleBackgroundLocationEnabled({ guiding, tripActive }));
    return () => setRoadSnapBackground(false);
  }, [guiding, tripActive]);

  useEffect(() => {
    const frame = Keyboard.addListener("keyboardWillChangeFrame", event => {
      const top = event?.endCoordinates?.screenY;
      setKeyboardTop(Number.isFinite(top) ? top : null);
    });
    return () => frame.remove();
  }, []);

  function measureProbe() {
    probeRef.current?.measureInWindow((_x, y) => {
      if (!Number.isFinite(y) || y <= 0) return;
      setContentBottom(current => Math.abs(current - y) < 1 ? current : y);
    });
  }

  useEffect(() => {
    if ((guiding && !placesOpen && !saveSlot) || (suppressQuery.current && query === suppressQuery.current)) return undefined;
    const next = reduceSearchSchedule(schedule.current, query, Date.now());
    schedule.current = next;
    const local = lookupDestinations(query);
    if (next.sendAt == null) {
      setSuggestions(local.results);
      setSearchNote("");
      return undefined;
    }
    let cancelled = false;
    const controller = new AbortController();
    const handle = setTimeout(() => {
      setSearchNote(copy.searching);
      autocompletePlaces({
        input: next.text,
        sessionToken: next.token,
        languageCode: placesLanguage(language),
        key: readPlacesKey(),
        fetch: global.fetch.bind(global),
        signal: controller.signal,
      }).then(results => {
        if (cancelled || !alive.current) return;
        setSuggestions(results);
        setSearchNote(results.length ? "" : copy.empty);
      }).catch(error => {
        if (cancelled || !alive.current || error?.name === "AbortError") return;
        setSuggestions([]);
        setSearchNote(error?.code === "missing-key" ? copy.searchKey : copy.searchFailed);
      });
    }, PLACES_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
      controller.abort();
    };
  }, [copy.empty, copy.searchFailed, copy.searchKey, copy.searching, guiding, language, placesOpen, query, saveSlot]);

  useEffect(() => {
    setOnRemainingTimeOrDistanceChanged(value => {
      if (alive.current && value) setProgress(value);
    });
    setOnReroutingRequestedByOffRoute(() => {
      if (alive.current) setRerouting(true);
    });
    return () => {
      setOnRemainingTimeOrDistanceChanged(null);
      setOnReroutingRequestedByOffRoute(null);
    };
  }, [setOnRemainingTimeOrDistanceChanged, setOnReroutingRequestedByOffRoute]);

  useEffect(() => {
    if (!ready.current) return undefined;
    // Google turn prompts follow the iPhone language. SDK 10.13.0 exposes no language setter.
    return subscribeCameraSpeech(cameraSpeaking => {
      cameraSpeakingRef.current = cameraSpeaking;
      const mode = googleAudioMode({ cameraSpeaking, guiding: guidingRef.current, voiceEnabled }) === "alerts-and-guidance"
        ? AudioGuidance.VOICE_ALERTS_AND_GUIDANCE
        : AudioGuidance.SILENT;
      traceNavVoice("warning.speech", { speaking: cameraSpeaking, guiding: guidingRef.current, voiceEnabled });
      requestVoiceGuidance(controllerRef.current, mode, "warning");
    });
  }, [guiding, voiceEnabled]);

  useEffect(() => {
    if (!ready.current) return;
    // A warning must leave guidance silent. Setting the same VOICE value again
    // does not restart the Navigation SDK after the clip took the audio session.
    const mode = googleAudioMode({ cameraSpeaking: cameraSpeakingRef.current, guiding, voiceEnabled }) === "alerts-and-guidance"
      ? AudioGuidance.VOICE_ALERTS_AND_GUIDANCE
      : AudioGuidance.SILENT;
    requestVoiceGuidance(controller, mode, "guiding");
  }, [controller, guiding, voiceEnabled]);

  useEffect(() => {
    if (!diagnostic || autoStarted.current) return undefined;
    autoStarted.current = true;
    let stop = false;
    runVoiceDiagAuto({
      controllerRef,
      requestVoice: (index, reason) => requestVoiceGuidance(controllerRef.current, index, reason),
      setOnTurnByTurn,
      setOnLocationChanged,
      markGuiding: (value) => {
        guidingRef.current = value;
        setGuiding(value);
      },
      ensureSession: async () => {
        if (ready.current) return;
        const foreground = () => alive.current && AppState.currentState === "active";
        const accepted = await controllerRef.current.areTermsAccepted();
        traceNavVoice("auto.terms", { accepted: accepted === true });
        if (accepted !== true) {
          const error = new Error("terms");
          error.code = "terms";
          throw error;
        }
        const status = await withNavigationWindow(() => controllerRef.current.init(), foreground);
        if (status !== NavigationSessionStatus.OK) {
          const error = new Error("session");
          error.code = String(status || "session");
          throw error;
        }
        requestVoiceGuidance(controllerRef.current, AudioGuidance.SILENT, "session");
        ready.current = true;
      },
      cancelled: () => stop || !alive.current,
    });
    return () => { stop = true; };
  }, [diagnostic, setOnTurnByTurn, setOnLocationChanged]);

  async function ensureSession() {
    if (ready.current) return;
    const foreground = () => alive.current && AppState.currentState === "active";
    let accepted = await controllerRef.current.areTermsAccepted();
    if (!accepted) {
      accepted = await withNavigationWindow(() => controllerRef.current.showTermsAndConditionsDialog(), foreground);
    }
    if (!accepted) throw new Error(copy.terms);
    const status = await withNavigationWindow(() => controllerRef.current.init(), foreground);
    if (status !== NavigationSessionStatus.OK) {
      throw new Error(status === NavigationSessionStatus.NOT_AUTHORIZED ? copy.auth : copy.failed);
    }
    requestVoiceGuidance(controllerRef.current, AudioGuidance.SILENT, "session");
    navView.current?.setNavigationUIEnabled?.(true);
    ready.current = true;
  }

  async function run(action) {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await action(); }
    catch (error) {
      if (!alive.current) return;
      const known = error?.code === "missing-key" ? copy.searchKey : error?.code === "places-failed" ? copy.searchFailed : "";
      setError(known || error?.message || copy.failed);
    }
    finally { if (alive.current) setBusy(false); }
  }

  function pickPoint(latLng) {
    if (busy || guiding) return;
    const lat = Number(latLng?.lat);
    const lng = Number(latLng?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setPoint({ lat, lng });
    setQuery(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    setRouted(false);
    setProgress(null);
    setLayersOpen(false);
  }

  function buildRoute(target = point) {
    const dest = target && (Number.isFinite(target.lat) || target.placeId) ? target : point;
    if (!dest) return;
    run(async () => {
      let next = dest;
      if (!Number.isFinite(next.lat)) {
        const located = await placeDetailsLocation({
          placeId: next.placeId,
          sessionToken: schedule.current.token,
          key: readPlacesKey(),
          fetch: global.fetch.bind(global),
        });
        schedule.current = { text: "", token: null, sendAt: null };
        next = { ...next, lat: located.lat, lng: located.lng };
      }
      await ensureSession();
      const foreground = () => alive.current && AppState.currentState === "active";
      const status = await withNavigationWindow(() => controllerRef.current.setDestination(
        { title: next.title || copy.where, position: { lat: next.lat, lng: next.lng } },
        { routingOptions: { travelMode: TravelMode.DRIVING } },
      ), foreground);
      if (status !== RouteStatus.OK) throw new Error(status === RouteStatus.NO_ROUTE_FOUND ? copy.noRoute : copy.failed);
      const remaining = await controllerRef.current.getCurrentTimeAndDistance().catch(() => null);
      if (alive.current) {
        if (remaining) setProgress(remaining);
        setPoint({ lat: next.lat, lng: next.lng });
        setRouted(true);
        setRerouting(false);
        setLayersOpen(false);
        navView.current?.showRouteOverview?.();
      }
    });
  }

  useEffect(() => {
    onRouteActive?.(routed || guiding);
  }, [guiding, onRouteActive, routed]);

  useEffect(() => {
    if (guiding) setPlacesOpen(false);
  }, [guiding]);

  useEffect(() => {
    if (!handoff || handoff.token == null || handoffToken.current === handoff.token) return;
    const lat = Number(handoff.lat);
    const lng = Number(handoff.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    handoffToken.current = handoff.token;
    buildRoute({ lat, lng, title: handoff.title });
  }, [handoff]);

  function dismissSearch() {
    Keyboard.dismiss();
    searchField.current?.blur();
  }

  function chooseResult(result) {
    dismissSearch();
    suppressQuery.current = result.title;
    setQuery(result.title);
    setSuggestions([]);
    setSearchNote("");
    if (saveSlot) {
      rememberChosen(saveSlot, result);
      return;
    }
    buildRoute({ lat: result.lat, lng: result.lng, title: result.title, placeId: result.placeId });
  }

  function startGuidance() {
    run(async () => {
      await ensureSession();
      if (!(await onStartTrip())) return;
      const foreground = () => alive.current && AppState.currentState === "active";
      await withNavigationWindow(() => controllerRef.current.startGuidance(), foreground);
      if (!alive.current) return;
      guidingRef.current = true;
      setGuiding(true);
      setLayersOpen(false);
      traceNavVoice("guidance.start", {
        voiceEnabled,
        cameraSpeaking: cameraSpeakingRef.current,
        appState: AppState.currentState,
      });
      requestVoiceGuidance(controllerRef.current, googleAudioMode({
        cameraSpeaking: cameraSpeakingRef.current,
        guiding: true,
        voiceEnabled,
      }) === "alerts-and-guidance" ? AudioGuidance.VOICE_ALERTS_AND_GUIDANCE : AudioGuidance.SILENT, "guidance");
      navView.current?.setNavigationUIEnabled?.(true);
      navView.current?.setFollowingPerspective?.(CameraPerspective.TILTED);
    });
  }

  async function endRoute() {
    guidingRef.current = false;
    setRoadSnapBackground(false);
    setGuiding(false);
    setRouted(false);
    setPoint(null);
    setQuery("");
    setProgress(null);
    setRerouting(false);
    try {
      await controllerRef.current.stopGuidance();
      await controllerRef.current.clearDestinations();
      requestVoiceGuidance(controllerRef.current, AudioGuidance.SILENT, "end");
      navView.current?.setNavigationUIEnabled?.(false);
      navView.current?.setFollowingPerspective?.(CameraPerspective.TOP_DOWN_NORTH_UP);
    } catch (_) {}
  }

  function showLocation() {
    if (guidingRef.current) navView.current?.setFollowingPerspective?.(CameraPerspective.TILTED);
    else if (routed) navView.current?.showRouteOverview?.();
    else navView.current?.setFollowingPerspective?.(CameraPerspective.TOP_DOWN_NORTH_UP);
  }

  function beginSave(slot) {
    setPlacesOpen(true);
    setSaveSlot(slot);
    setFavoritesOpen(slot === "favorite");
    setQuery("");
    setSuggestions([]);
    setSearchNote("");
    suppressQuery.current = "";
    setTimeout(() => searchField.current?.focus?.(), 50);
  }

  async function persist(next) {
    const safe = await storeSavedPlaces(AsyncStorage, next);
    if (alive.current) setSaved(safe);
    return safe;
  }

  function rememberChosen(slot, result) {
    run(async () => {
      let lat = Number(result?.lat);
      let lng = Number(result?.lng);
      const placeId = typeof result?.placeId === "string" ? result.placeId : "";
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        const located = await placeDetailsLocation({
          placeId,
          sessionToken: schedule.current.token,
          key: readPlacesKey(),
          fetch: global.fetch.bind(global),
        });
        schedule.current = { text: "", token: null, sendAt: null };
        lat = located.lat;
        lng = located.lng;
      }
      const place = savedPlaceFromSuggestion({ ...result, lat, lng, placeId }, null);
      if (!place) throw Object.assign(new Error(places.saveFailed), { code: "save-failed" });
      if (slot === "favorite") {
        const outcome = addFavorite(savedRef.current, place);
        if (!outcome.added) {
          if (outcome.reason === "duplicate") setSearchNote(places.duplicate);
          setSaveSlot(null);
          return;
        }
        await persist(outcome.store);
        setSaveSlot(null);
        return;
      }
      const next = assignSavedSlot(savedRef.current, slot, place);
      if (!next[slot]) throw Object.assign(new Error(places.saveFailed), { code: "save-failed" });
      await persist(next);
      setSaveSlot(null);
    });
  }

  function openSaved(place) {
    const decision = savedPlaceRoute(place, routed || guiding);
    if (decision.action === "ignore") return;
    const go = () => buildRoute(decision.destination);
    if (decision.action === "confirm") {
      Alert.alert(places.replaceTitle, places.replaceBody, [
        { text: places.cancel, style: "cancel" },
        { text: places.replace, onPress: go },
      ]);
      return;
    }
    go();
  }

  function pressSaved(slot) {
    const place = savedRef.current?.[slot];
    if (!place) {
      beginSave(slot);
      return;
    }
    openSaved(place);
  }

  function holdSaved(slot) {
    const place = savedRef.current?.[slot];
    if (!place) return;
    Alert.alert(place.name, place.address || places.change, [
      { text: places.change, onPress: () => beginSave(slot) },
      { text: places.delete, style: "destructive", onPress: () => dropSlot(slot) },
      { text: places.cancel, style: "cancel" },
    ]);
  }

  function dropSlot(slot) {
    run(async () => {
      await persist(clearSavedSlot(savedRef.current, slot));
    });
  }

  function removeSavedFavorite(place) {
    run(async () => {
      await persist(removeFavorite(savedRef.current, place));
    });
  }

  function closePlaces() {
    setPlacesOpen(false);
    setSaveSlot(null);
    setFavoritesOpen(false);
    setSuggestions([]);
    setSearchNote("");
    dismissSearch();
  }

  function remember(edge, event) {
    const height = Math.ceil(event.nativeEvent.layout.height);
    if (height < 1) return;
    setPads(current => current[edge] === height ? current : { ...current, [edge]: height });
  }

  const target = finiteCoord(coords);
  const items = routeSummary(language, routed || guiding ? progress : null);
  const keyboardFrame = keyboardTop == null ? windowHeight : keyboardTop;
  const lift = keyboardClearance({
    contentBottom: contentBottom || windowHeight,
    keyboardTop: keyboardFrame,
  });
  const diagSpace = diagnostic ? 210 : 0;
  const listMax = suggestionViewport({
    windowHeight,
    keyboardHeight: Math.max(0, windowHeight - keyboardFrame),
    topChrome: 148,
    bottomChrome: pads.bottom + 16,
  });
  const chrome = navChrome({ guiding, routed, hasPoint: !!point });
  const banner = cameraBanner(camera, cameraType);

  return (
    <View style={styles.root}>
      <NavigationView
        style={StyleSheet.absoluteFill}
        mapType={mapType}
        mapPadding={{ top: pads.top, right: 16, bottom: pads.bottom + lift + diagSpace, left: 16 }}
        navigationNightMode={night ? NavigationNightMode.FORCE_NIGHT : NavigationNightMode.FORCE_DAY}
        myLocationEnabled
        headerEnabled={chrome.maneuver}
        footerEnabled={false}
        recenterButtonEnabled={false}
        speedometerEnabled={false}
        speedLimitIconEnabled={false}
        onNavigationViewControllerCreated={value => { navView.current = value; }}
        onMapClick={coordinate => {
          dismissSearch();
          pickPoint(coordinate);
        }}
        initialCameraPosition={target ? { target, zoom: 15 } : undefined}
      />
      <SystemSafeArea pointerEvents="box-none" style={styles.overlay}>
        <View pointerEvents="box-none" onLayout={event => remember("top", event)}>
          {chrome.maneuver && <View pointerEvents="none" style={styles.maneuverClearance} />}
          {guiding && !placesOpen && !saveSlot && (
            <Pressable accessibilityRole="button" accessibilityLabel={places.placesButton} onPress={() => setPlacesOpen(true)} style={[styles.placesToggle, { backgroundColor: palette.panel }]}>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.savedLabel, { color: palette.ink }]}>{places.placesButton}</Text>
            </Pressable>
          )}
          {(!guiding || placesOpen || saveSlot) && (
            <View style={[styles.searchCard, { backgroundColor: palette.panel }]}>
              {guiding && (
                <Pressable accessibilityRole="button" accessibilityLabel={places.close} onPress={closePlaces} style={styles.placesClose}>
                  <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.savedLabel, { color: palette.ink }]}>{places.close}</Text>
                </Pressable>
              )}
              <View style={styles.searchRow}>
                <TextInput
                  ref={searchField}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={copy.where}
                  placeholderTextColor={palette.muted}
                  autoCorrect={false}
                  autoCapitalize="words"
                  returnKeyType="search"
                  maxFontSizeMultiplier={1.4}
                  onSubmitEditing={() => { if (suggestions[0]) chooseResult(suggestions[0]); }}
                  style={[styles.searchInput, { color: palette.ink }]}
                />
              </View>
              <SavedPlaceBar
                places={places}
                saved={saved}
                compact={windowHeight < 700}
                open={favoritesOpen}
                saveSlot={saveSlot}
                palette={palette}
                onPress={pressSaved}
                onHold={holdSaved}
                onToggle={() => setFavoritesOpen(open => !open)}
                onAdd={() => beginSave("favorite")}
                onGo={openSaved}
                onRemove={removeSavedFavorite}
                onCancelSave={() => setSaveSlot(null)}
              />
              {suggestions.length > 0 && (
                <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="none" style={[styles.results, { maxHeight: listMax }]}>
                  {suggestions.map(result => (
                    <Pressable key={result.id} accessibilityRole="button" onPress={() => chooseResult(result)} style={styles.result}>
                      <Text numberOfLines={1} maxFontSizeMultiplier={1.4} style={[styles.resultTitle, { color: palette.ink }]}>{result.title}</Text>
                      <Text numberOfLines={2} maxFontSizeMultiplier={1.4} style={[styles.resultAddress, { color: palette.muted }]}>{result.address || copy.point}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              {!!searchNote && <Text numberOfLines={2} maxFontSizeMultiplier={1.4} style={[styles.searchOff, { color: palette.muted }]}>{searchNote}</Text>}
            </View>
          )}
          {banner && (
            <View style={styles.camera}>
              {banner.type && <Text numberOfLines={2} maxFontSizeMultiplier={1.4} style={styles.cameraType}>{banner.type}</Text>}
              {banner.distance != null && <Text numberOfLines={1} maxFontSizeMultiplier={1.4} style={styles.cameraDistance}>{banner.distance} {copy.meters}</Text>}
              {banner.limit != null && <Text numberOfLines={1} maxFontSizeMultiplier={1.4} style={styles.cameraDistance}>{banner.limit} {copy.speedUnit}</Text>}
            </View>
          )}
          {!!error && <Text accessibilityRole="alert" numberOfLines={3} maxFontSizeMultiplier={1.4} style={styles.error}>{error}</Text>}
        </View>
        <View pointerEvents="box-none" style={[styles.bottom, { marginBottom: 8 + lift + diagSpace }]} onLayout={event => remember("bottom", event)}>
          {chrome.routeBar && (
            <RouteBar items={items} palette={palette} />
          )}
          {chrome.go && (
            <Pressable accessibilityRole="button" disabled={busy} onPress={startGuidance} style={[styles.go, busy && styles.dim]}>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.4} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.goText}>{copy.go}</Text>
            </Pressable>
          )}
          {chrome.build && (
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => buildRoute()} style={[styles.go, busy && styles.dim]}>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.4} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.goText}>{copy.build}</Text>
            </Pressable>
          )}
          <MapTools
            copy={copy}
            palette={palette}
            voiceEnabled={voiceEnabled}
            onToggleVoice={onToggleVoice}
            layersOpen={layersOpen}
            setLayersOpen={setLayersOpen}
            mapType={mapType}
            setMapType={setMapType}
            onLocate={showLocation}
            onEnd={chrome.endRoute ? endRoute : null}
          />
          {picking && !tripActive && !guiding && (
            <Pressable accessibilityRole="button" onPress={onClosePick} style={styles.secondary}>
              <Text numberOfLines={1} style={[styles.secondaryText, { color: palette.ink }]}>{copy.back}</Text>
            </Pressable>
          )}
          {tripActive && (
            <Pressable accessibilityRole="button" onPress={() => { setRoadSnapBackground(false); onStopTrip(); }} style={styles.endTrip}>
              <Text numberOfLines={1} maxFontSizeMultiplier={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.secondaryText, { color: palette.ink }]}>{copy.endTrip}</Text>
            </Pressable>
          )}
        </View>
        <View ref={probeRef} pointerEvents="none" onLayout={measureProbe} style={styles.probe} />
      </SystemSafeArea>
    </View>
  );
}

function MapTools({ copy, palette, voiceEnabled, onToggleVoice, layersOpen, setLayersOpen, mapType, setMapType, onLocate, onEnd }) {
  return (
    <View style={styles.tools}>
      {layersOpen && (
        <View style={[styles.menu, { backgroundColor: palette.menu }]}>
          {MAPS.map(([type, key]) => (
            <Pressable key={key} accessibilityRole="button" onPress={() => { setMapType(type); setLayersOpen(false); }} style={styles.menuRow}>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.4} style={[styles.menuText, { color: mapType === type ? "#1260E8" : palette.ink }]}>{copy[key]}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.toolRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.layers} onPress={() => setLayersOpen(open => !open)} style={[styles.speaker, { backgroundColor: layersOpen ? "#1260E8" : palette.button }]}>
          <Text maxFontSizeMultiplier={1.4} style={[styles.layerGlyph, { color: layersOpen ? "#FFFFFF" : palette.ink }]}>▦</Text>
        </Pressable>
        {onToggleVoice && (
          <Pressable accessibilityRole="button" accessibilityLabel={voiceEnabled ? copy.voice : copy.voiceOff} onPress={onToggleVoice} style={[styles.speaker, { backgroundColor: palette.button }]}>
            <Text maxFontSizeMultiplier={1.4} style={styles.speakerGlyph}>{voiceEnabled ? "🔊" : "🔇"}</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel={copy.locate} onPress={onLocate} style={[styles.speaker, { backgroundColor: palette.button }]}>
          <Text maxFontSizeMultiplier={1.4} style={[styles.layerGlyph, { color: palette.ink }]}>⌖</Text>
        </Pressable>
        {onEnd && (
          <Pressable accessibilityRole="button" accessibilityLabel={copy.endRoute} onPress={onEnd} style={[styles.speaker, { backgroundColor: palette.button }]}>
            <Text maxFontSizeMultiplier={1.4} style={[styles.layerGlyph, { color: palette.danger }]}>×</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function RouteBar({ items, palette }) {
  const { width } = useWindowDimensions();
  const fit = summaryFit(items, Math.max(160, width - 32));
  return (
    <View style={[styles.summary, { backgroundColor: palette.panel }]}>
      {items.map((item, index) => (
        <View key={item.caption} style={styles.summaryItem}>
          {index > 0 && <View style={[styles.divider, { backgroundColor: palette.line }]} />}
          <View style={[styles.summaryCopy, { width: fit.widths[index] }]}>
            <Text numberOfLines={1} maxFontSizeMultiplier={1} style={[styles.summaryValue, { color: palette.ink, fontSize: fit.valueSize }]}>{item.value}</Text>
            <Text numberOfLines={1} maxFontSizeMultiplier={1} style={[styles.summaryCaption, { color: palette.muted, fontSize: fit.captionSize }]}>{item.caption}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function finiteCoord(coords) {
  const lat = Number(coords?.latitude);
  const lng = Number(coords?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function SavedPlaceBar({ places, saved, compact, open, saveSlot, palette, onPress, onHold, onToggle, onAdd, onGo, onRemove, onCancelSave }) {
  const slots = [
    ["home", places.home],
    ["work", places.work],
    ["favorites", places.favorites],
  ];
  const prompt = saveSlot === "home" ? places.saveHome : saveSlot === "work" ? places.saveWork : saveSlot === "favorite" ? places.saveFavorite : "";
  const favorites = Array.isArray(saved?.favorites) ? saved.favorites : [];
  return (
    <View style={styles.savedBlock}>
      <View style={styles.savedRow}>
        {slots.map(([slot, label]) => {
          const stored = slot === "favorites" ? null : saved?.[slot];
          return (
            <Pressable
              key={slot}
              accessibilityRole="button"
              accessibilityLabel={slot === "favorites" && open ? places.close : label}
              onPress={() => slot === "favorites" ? onToggle() : onPress(slot)}
              onLongPress={() => { if (slot !== "favorites") onHold(slot); }}
              style={[styles.savedButton, compact && styles.savedButtonCompact, { backgroundColor: palette.button }]}
            >
              <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.savedLabel, { color: palette.ink }]}>{stored?.name || label}</Text>
            </Pressable>
          );
        })}
      </View>
      {!!prompt && (
        <View style={styles.savedPrompt}>
          <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.savedHint, { color: palette.muted }]}>{prompt}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={places.cancel} onPress={onCancelSave}>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.savedHint, { color: palette.ink }]}>{places.cancel}</Text>
          </Pressable>
        </View>
      )}
      {open && (
        <View style={[styles.savedList, compact ? styles.savedListCompact : null]}>
          <Pressable accessibilityRole="button" accessibilityLabel={places.add} onPress={onAdd} style={styles.savedAdd}>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.savedLabel, { color: palette.ink }]}>{places.add}</Text>
          </Pressable>
          {!favorites.length && <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={[styles.savedHint, { color: palette.muted }]}>{places.empty}</Text>}
          <ScrollView keyboardShouldPersistTaps="handled" style={compact ? styles.savedScrollCompact : styles.savedScroll}>
            {favorites.map(place => (
              <View key={place.placeId || `${place.name}:${place.latitude}:${place.longitude}`} style={styles.savedItem}>
                <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.savedLabel, { color: palette.ink }]}>{place.name}</Text>
                {!!place.address && <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.savedHint, { color: palette.muted }]}>{place.address}</Text>}
                <View style={styles.savedActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel={places.go} onPress={() => onGo(place)}>
                    <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.savedGo}>{places.go}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={places.delete} onPress={() => onRemove(place)}>
                    <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.savedHint, { color: palette.danger }]}>{places.delete}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const LIGHT = { panel: "rgba(255,255,255,0.96)", ink: "#10263B", muted: "#4E6278", button: "#E7EEF6", menu: "#FFFFFF", line: "#D5E0EC", danger: "#9A3412" };
const DARK = { panel: "rgba(16,38,59,0.94)", ink: "#F5F8FB", muted: "#CAD7E7", button: "#1C334C", menu: "#16304A", line: "#355272", danger: "#FFB4A8" };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0B1829" },
  diagnosticRoot: { flex: 1 },
  overlay: { flex: 1, justifyContent: "space-between" },
  searchCard: { marginHorizontal: NAV_PANEL.horizontalInset, marginTop: NAV_PANEL.cardMarginTop, borderRadius: 16, paddingHorizontal: NAV_PANEL.cardPaddingHorizontal, paddingVertical: NAV_PANEL.cardPaddingVertical, gap: NAV_PANEL.cardGap },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, minHeight: NAV_PANEL.searchMinHeight, fontSize: 16, fontWeight: "700", paddingVertical: 0 },
  placesToggle: { marginHorizontal: NAV_PANEL.horizontalInset, marginTop: NAV_PANEL.cardMarginTop, minHeight: NAV_PANEL.guidanceButtonHeight, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  placesClose: { minHeight: NAV_PANEL.guidanceButtonHeight, alignItems: "flex-end", justifyContent: "center" },
  speaker: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  speakerOn: { backgroundColor: "#1260E8" },
  speakerGlyph: { fontSize: 16 },
  layerGlyph: { fontSize: 18, fontWeight: "700" },
  menu: { alignSelf: "flex-end", width: 168, borderRadius: 12, overflow: "hidden" },
  menuRow: { minHeight: 40, justifyContent: "center", paddingHorizontal: 12 },
  menuText: { fontSize: 15, fontWeight: "700" },
  result: { minHeight: 40, justifyContent: "center" },
  resultTitle: { fontSize: 16, fontWeight: "700" },
  resultAddress: { fontSize: 13, fontWeight: "600" },
  searchOff: { fontSize: 13, fontWeight: "600" },
  results: { flexGrow: 0 },
  probe: { position: "absolute", left: 0, right: 0, bottom: 0, height: 0 },
  tools: { alignItems: "flex-end", alignSelf: "stretch", gap: 6 },
  toolRow: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "nowrap", gap: 8 },
  toolsDock: { alignItems: "flex-end" },
  maneuverClearance: { height: NAV_PANEL.maneuverClearance },
  camera: { alignSelf: "flex-start", maxWidth: "78%", flexDirection: "row", flexWrap: "wrap", gap: 8, backgroundColor: "#8E2A22", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, marginHorizontal: 12, marginTop: 6 },
  cameraDistance: { color: "#FFFFFF", fontSize: 18, fontWeight: "900", flexShrink: 0 },
  cameraType: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", flexShrink: 0 },
  note: { color: "#F5B64C", fontWeight: "700", marginHorizontal: 12, marginTop: 6 },
  error: { color: "#9A3412", backgroundColor: "#FFE8D6", borderRadius: 12, overflow: "hidden", fontWeight: "700", marginHorizontal: 12, marginTop: 6, paddingHorizontal: 10, paddingVertical: 8 },
  bottom: { marginHorizontal: 12, marginBottom: 8, gap: 8 },
  summary: { alignSelf: "center", maxWidth: "100%", flexDirection: "row", flexWrap: "nowrap", alignItems: "stretch", borderRadius: 16, paddingVertical: 6, paddingHorizontal: 2 },
  summaryItem: { flexDirection: "row", flexGrow: 0, flexShrink: 0, alignItems: "center" },
  divider: { width: 1, alignSelf: "stretch", marginVertical: 2 },
  summaryCopy: { alignItems: "center", justifyContent: "center" },
  summaryValue: { fontSize: 18, fontWeight: "800" },
  summaryCaption: { fontSize: 11, fontWeight: "600", marginTop: 1 },
  go: { minHeight: 52, borderRadius: 16, backgroundColor: "#1260E8", alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  goText: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  dim: { opacity: 0.45 },
  end: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  endText: { color: "#9A3412", fontSize: 16, fontWeight: "800" },
  endTrip: { minHeight: 44, marginTop: 6, marginBottom: 16, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  secondary: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontSize: 16, fontWeight: "700" },
  savedBlock: { gap: 4 },
  savedRow: { flexDirection: "row", flexWrap: "nowrap", gap: 6 },
  savedButton: { flex: 1, minHeight: NAV_PANEL.buttonMinHeight, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  savedButtonCompact: { minHeight: 26 },
  savedLabel: { fontSize: 12, fontWeight: "800" },
  savedHint: { fontSize: 12, fontWeight: "600", flexShrink: 1 },
  savedPrompt: { flexDirection: "row", flexWrap: "nowrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  savedList: { maxHeight: 168, gap: 2 },
  savedListCompact: { maxHeight: 96 },
  savedScroll: { maxHeight: 132 },
  savedScrollCompact: { maxHeight: 64 },
  savedAdd: { minHeight: 30, justifyContent: "center" },
  savedItem: { gap: 1, paddingVertical: 2 },
  savedActions: { flexDirection: "row", flexWrap: "nowrap", alignItems: "center", gap: 12 },
  savedGo: { color: "#1260E8", fontSize: 13, fontWeight: "800" },
});
