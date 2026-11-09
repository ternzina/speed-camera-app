import React, { useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import {
  AudioGuidance, MapType, NavigationNightMode, NavigationProvider, NavigationSessionStatus,
  NavigationView, RouteStatus, TaskRemovedBehavior, TravelMode, useNavigation,
} from "@googlemaps/react-native-navigation-sdk";
import { subscribeCameraSpeech } from "./camera-speech";
import { formatArrivalTime, formatDistance, formatDuration } from "./route-guidance";
import { withNavigationWindow } from "./navigation-readiness";
import SystemSafeArea from "./system-safe-area";

const COPY = {
  ru: {
    where: "Куда едем?", build: "Построить маршрут", go: "В путь", endRoute: "Завершить маршрут",
    endTrip: "Завершить поездку", road: "Схема", satellite: "Спутник", hybrid: "Гибрид",
    voice: "Голос", voiceOff: "Без голоса", arrival: "Прибытие", left: "Осталось", time: "Время",
    pick: "Нажмите точку на карте", routed: "Маршрут построен. Ведение начнётся после «В путь».",
    camera: "Камера", terms: "Нужно принять условия Google Navigation.",
    auth: "Ключ iOS не принят Navigation SDK. Проверьте GOOGLE_MAPS_IOS_API_KEY в сборке.",
    failed: "Не удалось открыть навигацию Google.", noRoute: "Маршрут не найден.",
    back: "Назад", reroute: "Строится новый маршрут",
  },
  uk: {
    where: "Куди їдемо?", build: "Побудувати маршрут", go: "У дорогу", endRoute: "Завершити маршрут",
    endTrip: "Завершити поїздку", road: "Схема", satellite: "Супутник", hybrid: "Гібрид",
    voice: "Голос", voiceOff: "Без голосу", arrival: "Прибуття", left: "Залишилось", time: "Час",
    pick: "Натисніть точку на карті", routed: "Маршрут побудовано. Ведення почнеться після «У дорогу».",
    camera: "Камера", terms: "Потрібно прийняти умови Google Navigation.",
    auth: "Ключ iOS не прийнято Navigation SDK.", failed: "Не вдалося відкрити навігацію Google.",
    noRoute: "Маршрут не знайдено.", back: "Назад", reroute: "Будується новий маршрут",
  },
  en: {
    where: "Where to?", build: "Build route", go: "Start guidance", endRoute: "End route",
    endTrip: "End trip", road: "Road", satellite: "Satellite", hybrid: "Hybrid",
    voice: "Voice", voiceOff: "Voice off", arrival: "Arrival", left: "Left", time: "Time",
    pick: "Tap a point on the map", routed: "Route ready. Guidance starts after the button.",
    camera: "Camera", terms: "Accept the Google Navigation terms.",
    auth: "The iOS key was not accepted by the Navigation SDK.", failed: "Google navigation failed.",
    noRoute: "No route found.", back: "Back", reroute: "Building a new route",
  },
  pl: {
    where: "Dokąd jedziemy?", build: "Wyznacz trasę", go: "W drogę", endRoute: "Zakończ trasę",
    endTrip: "Zakończ przejazd", road: "Mapa", satellite: "Satelita", hybrid: "Hybryda",
    voice: "Głos", voiceOff: "Bez głosu", arrival: "Przyjazd", left: "Zostało", time: "Czas",
    pick: "Dotknij punktu na mapie", routed: "Trasa gotowa. Prowadzenie zacznie się po przycisku.",
    camera: "Kamera", terms: "Zaakceptuj warunki Google Navigation.",
    auth: "Klucz iOS nie został przyjęty przez Navigation SDK.", failed: "Nawigacja Google nie ruszyła.",
    noRoute: "Nie znaleziono trasy.", back: "Wstecz", reroute: "Wyznaczanie nowej trasy",
  },
};

const terms = { title: "Google Navigation", companyName: "CamAlert", showOnlyDisclaimer: false };

export default function GoogleNavTestScreen(props) {
  return (
    <NavigationProvider termsAndConditionsDialogOptions={terms} taskRemovedBehavior={TaskRemovedBehavior.QUIT_SERVICE}>
      <GoogleNavBody {...props} />
    </NavigationProvider>
  );
}

function GoogleNavBody({
  language, night, coords, camera, cameraType, voiceEnabled, onToggleVoice,
  picking, tripActive, onStartTrip, onStopTrip, onClosePick,
}) {
  const copy = COPY[language] || COPY.ru;
  const { navigationController: controller, setOnRemainingTimeOrDistanceChanged, setOnReroutingRequestedByOffRoute } = useNavigation();
  const controllerRef = useRef(controller);
  controllerRef.current = controller;
  const alive = useRef(true);
  const ready = useRef(false);
  const guidingRef = useRef(false);
  const [point, setPoint] = useState(null);
  const [routed, setRouted] = useState(false);
  const [guiding, setGuiding] = useState(false);
  const [mapType, setMapType] = useState(MapType.NORMAL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rerouting, setRerouting] = useState(false);
  const [progress, setProgress] = useState(null);
  const navView = useRef(null);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

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
    return subscribeCameraSpeech(cameraSpeaking => {
      const mode = guidingRef.current && voiceEnabled && !cameraSpeaking
        ? AudioGuidance.VOICE_ALERTS_AND_GUIDANCE
        : AudioGuidance.SILENT;
      Promise.resolve(controllerRef.current.setAudioGuidanceType(mode)).catch(() => {});
    });
  }, [guiding, voiceEnabled]);

  useEffect(() => {
    if (!ready.current) return;
    const mode = guiding && voiceEnabled ? AudioGuidance.VOICE_ALERTS_AND_GUIDANCE : AudioGuidance.SILENT;
    Promise.resolve(controller.setAudioGuidanceType(mode)).catch(() => {});
  }, [controller, guiding, voiceEnabled]);

  async function ensureSession() {
    if (ready.current) return;
    const foreground = () => alive.current && AppState.currentState === "active";
    const accepted = await withNavigationWindow(() => controllerRef.current.showTermsAndConditionsDialog(), foreground);
    if (!accepted) throw new Error(copy.terms);
    const status = await withNavigationWindow(() => controllerRef.current.init(), foreground);
    if (status !== NavigationSessionStatus.OK) {
      throw new Error(status === NavigationSessionStatus.NOT_AUTHORIZED ? copy.auth : copy.failed);
    }
    controllerRef.current.setAudioGuidanceType(AudioGuidance.SILENT);
    ready.current = true;
  }

  async function run(action) {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await action(); }
    catch (error) { if (alive.current) setError(error?.message || copy.failed); }
    finally { if (alive.current) setBusy(false); }
  }

  function buildRoute() {
    if (!point) return;
    run(async () => {
      await ensureSession();
      const foreground = () => alive.current && AppState.currentState === "active";
      const status = await withNavigationWindow(() => controllerRef.current.setDestination(
        { title: copy.where, position: { lat: point.lat, lng: point.lng } },
        { routingOptions: { travelMode: TravelMode.DRIVING } },
      ), foreground);
      if (status !== RouteStatus.OK) throw new Error(status === RouteStatus.NO_ROUTE_FOUND ? copy.noRoute : copy.failed);
      const remaining = await controllerRef.current.getCurrentTimeAndDistance().catch(() => null);
      if (alive.current) {
        if (remaining) setProgress(remaining);
        setRouted(true);
        setRerouting(false);
        navView.current?.showRouteOverview?.();
      }
    });
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
      controllerRef.current.setAudioGuidanceType(voiceEnabled ? AudioGuidance.VOICE_ALERTS_AND_GUIDANCE : AudioGuidance.SILENT);
      navView.current?.setNavigationUIEnabled?.(true);
    });
  }

  async function endRoute() {
    guidingRef.current = false;
    setGuiding(false);
    setRouted(false);
    setPoint(null);
    setProgress(null);
    setRerouting(false);
    try {
      await controllerRef.current.stopGuidance();
      await controllerRef.current.clearDestinations();
      controllerRef.current.setAudioGuidanceType(AudioGuidance.SILENT);
    } catch (_) {}
  }

  const target = finiteCoord(coords);
  const remainingLabel = progress ? formatDistance(language, progress.meters) : "—";
  const timeLabel = progress ? formatDuration(language, progress.seconds) : "—";
  const arrivalLabel = progress ? formatArrivalTime(language, progress.seconds) : "—";

  return (
    <View style={styles.root}>
      <NavigationView
        style={StyleSheet.absoluteFill}
        mapType={mapType}
        navigationNightMode={night ? NavigationNightMode.FORCE_NIGHT : NavigationNightMode.FORCE_DAY}
        myLocationEnabled
        headerEnabled={guiding}
        footerEnabled={false}
        speedometerEnabled={false}
        speedLimitIconEnabled={false}
        onNavigationViewControllerCreated={value => { navView.current = value; }}
        onMapClick={latLng => {
          if (busy || guiding || !picking) return;
          setPoint(latLng);
          setRouted(false);
          setProgress(null);
        }}
        initialCameraPosition={target ? { target, zoom: 15 } : undefined}
      />
      <SystemSafeArea pointerEvents="box-none" style={styles.overlay}>
        <View pointerEvents="box-none" style={styles.top}>
          {picking && !guiding && (
            <View style={styles.card}>
              <Text style={styles.title}>{routed ? copy.routed : point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : copy.pick}</Text>
            </View>
          )}
          {!!camera && (
            <View style={styles.camera}>
              <Text style={styles.cameraDistance}>{Math.round(camera.distance)} м</Text>
              <Text style={styles.cameraType}>{cameraType || copy.camera}</Text>
            </View>
          )}
          {rerouting && <Text style={styles.note}>{copy.reroute}</Text>}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        </View>
        <View pointerEvents="box-none" style={styles.side}>
          {[
            [MapType.NORMAL, copy.road],
            [MapType.SATELLITE, copy.satellite],
            [MapType.HYBRID, copy.hybrid],
          ].map(([type, label]) => (
            <Pressable key={label} accessibilityRole="button" onPress={() => setMapType(type)} style={[styles.sideButton, mapType === type && styles.sideOn]}>
              <Text style={styles.sideText}>{label}</Text>
            </Pressable>
          ))}
          {onToggleVoice && (
            <Pressable accessibilityRole="button" onPress={onToggleVoice} style={styles.sideButton}>
              <Text style={styles.sideText}>{voiceEnabled ? copy.voice : copy.voiceOff}</Text>
            </Pressable>
          )}
        </View>
        <View pointerEvents="box-none" style={styles.bottom}>
          {(routed || guiding) && (
            <View style={styles.bar}>
              <Stat value={arrivalLabel} label={copy.arrival} />
              <Stat value={remainingLabel} label={copy.left} />
              <Stat value={timeLabel} label={copy.time} />
              <Pressable accessibilityRole="button" onPress={endRoute} style={styles.end}><Text style={styles.endText}>{copy.endRoute}</Text></Pressable>
            </View>
          )}
          <View style={styles.actions}>
            {picking && !routed && (
              <Pressable accessibilityRole="button" disabled={!point || busy} onPress={buildRoute} style={[styles.go, (!point || busy) && styles.dim]}>
                <Text style={styles.goText}>{copy.build}</Text>
              </Pressable>
            )}
            {routed && !guiding && (
              <Pressable accessibilityRole="button" disabled={busy} onPress={startGuidance} style={[styles.go, busy && styles.dim]}>
                <Text style={styles.goText}>{copy.go}</Text>
              </Pressable>
            )}
            {picking && !tripActive && !guiding && (
              <Pressable accessibilityRole="button" onPress={onClosePick} style={styles.secondary}><Text style={styles.secondaryText}>{copy.back}</Text></Pressable>
            )}
            {tripActive && (
              <Pressable accessibilityRole="button" onPress={onStopTrip} style={styles.secondary}><Text style={styles.secondaryText}>{copy.endTrip}</Text></Pressable>
            )}
          </View>
        </View>
      </SystemSafeArea>
    </View>
  );
}

function Stat({ value, label }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function finiteCoord(coords) {
  const lat = Number(coords?.latitude);
  const lng = Number(coords?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0B1829" },
  overlay: { flex: 1, paddingTop: 8 },
  top: { marginHorizontal: 12, gap: 8 },
  card: { backgroundColor: "rgba(16,38,59,0.92)", borderRadius: 16, padding: 12 },
  title: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  camera: { alignSelf: "flex-start", flexDirection: "row", gap: 8, backgroundColor: "#8E2A22", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  cameraDistance: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  cameraType: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  note: { color: "#F5B64C", fontWeight: "700" },
  error: { color: "#FFBD85", fontWeight: "700" },
  side: { position: "absolute", right: 12, top: "32%", gap: 8 },
  sideButton: { backgroundColor: "rgba(16,38,59,0.92)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  sideOn: { backgroundColor: "#1260E8" },
  sideText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  bottom: { marginTop: "auto", marginHorizontal: 12, marginBottom: 10, gap: 8 },
  bar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(16,38,59,0.92)", borderRadius: 16, padding: 10 },
  stat: { flex: 1 },
  statValue: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  statLabel: { color: "#CAD7E7", fontSize: 11, fontWeight: "700" },
  end: { backgroundColor: "#5C2430", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  endText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  actions: { gap: 8 },
  go: { minHeight: 64, borderRadius: 18, backgroundColor: "#1260E8", alignItems: "center", justifyContent: "center" },
  goText: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  dim: { opacity: 0.45 },
  secondary: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
