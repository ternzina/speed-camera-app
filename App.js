
import React, { useEffect, useMemo, useRef, useState, useContext, createContext } from "react";
import {
  View, Text, StyleSheet, Pressable, Alert, ScrollView,
  Modal, TextInput, Switch, Vibration, Linking, Image, ImageBackground, ActivityIndicator,
  Animated, Platform, AppState, NativeModules, useWindowDimensions, useColorScheme
} from "react-native";
import * as Location from "expo-location";
import * as Speech from "./camera-speech";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapView, { Marker, Circle, Polyline } from "react-native-maps";
import { StatusBar } from "expo-status-bar";
import data from "./cameras.json";
import plData from "./cameras-pl.json";
import { nearestPolandPoint, detectAverageSpeedSection, averageSectionSpeech, measureSectionProgress, advanceSectionPace } from "./poland-engine";
import { cameraPoints, countryFeed, loadCameraCache, saveCameraCache } from "./camera-data";
import { COUNTRY_NAMES, countryFlag } from "./countries";
import { refreshCountryDelivery } from "./camera-delivery";
import { catalogTimestamps, shouldShowBackgroundGuide, describeLocationAccess, formatCatalogDate, backgroundGuideCopy, backgroundAccessMessage, backgroundFailureCopy } from "./catalog-status";
import { distanceBetweenMeters } from "./road-cameras";
import { isSpeedOverLimit } from "./drive-alert-logic";
import { buildNavigatorLinks } from "./navigator-links";
import WelcomeScreen from "./onboarding";
import GoogleNavigationScreen from "./google-navigation";
import { withNavigationWindow } from "./navigation-readiness";
import { cameraAlertCopy } from "./camera-alert-copy";
import { navigationCopy } from "./google-navigation-copy";
import SystemSafeArea from "./system-safe-area";

import { uiCopy, cameraKind, cameraGlyph, directionLabel, SpeedState, SectionState, FilterChip } from "./drive-ui";
import { clusterFocusRegion, clusterMapPoints, markerPixelSize } from "./map-camera-markers";
import { nextDriveCameraCommand } from "./drive-map-follow";
import { MapCameraPin, MapMarkerLegend } from "./map-camera-pin";
import { cameraAlertDecision, cameraWarningsEnabled, mergeStoredSettings } from "./camera-warning-gate";
import { searchLegalNotices, statusLabel } from "./legal-notices";
import IosRouteScreen from "./ios-route-screen";
import { calculateRoutes } from "./ios-mapkit-directions";
import {
  ROUTE_CORRIDOR_METERS, narrowCamerasToRoute, guidanceState, guidanceZoom,
  approximateRouteProgress, planNavAnnouncement, shouldRequestReroute,
  formatDistance, formatArrivalTime,
} from "./route-guidance";

// Temporary local diagnostic for a locked trip screen. It does not setState.
// Not for TestFlight or the App Store.
const tripDiag = { counts: {}, open: null, lines: [] };
function traceTrip(name, phase) {
  const now = Date.now();
  if (phase === "enter" || phase === "render") tripDiag.counts[name] = (tripDiag.counts[name] || 0) + 1;
  if (phase === "enter") tripDiag.open = { name, at: now };
  if (phase === "exit" && tripDiag.open?.name === name) {
    const ms = now - tripDiag.open.at;
    tripDiag.open = null;
    if (ms >= 40) {
      const line = `${name} ${ms}ms`;
      tripDiag.lines.push(line);
      if (tripDiag.lines.length > 8) tripDiag.lines.shift();
      console.log("[trip-diag] " + line);
    }
  }
  const n = tripDiag.counts[name] || 0;
  const every = name === "map" || name === "endTrip" || name === "error" || name === "gps" || name === "startTracking";
  if (phase === "error" || (phase !== "exit" && (every || n === 1 || n % 10 === 0))) {
    const line = phase === "error" ? `${name} error` : `${name} #${n}`;
    tripDiag.lines.push(line);
    if (tripDiag.lines.length > 8) tripDiag.lines.shift();
    console.log("[trip-diag] " + line);
  }
}
if (global.ErrorUtils && !global.__tripDiagHooked) {
  global.__tripDiagHooked = true;
  const previousHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    const message = error && (error.message || String(error));
    tripDiag.lines.push(`error ${message || ""}`);
    if (tripDiag.lines.length > 8) tripDiag.lines.shift();
    console.log("[trip-diag] error", isFatal ? "fatal" : "nonfatal", message);
    if (previousHandler) previousHandler(error, isFatal);
  });
}

function usePadLayout() {
  const { width, height } = useWindowDimensions();
  const pad = Platform.OS === "ios" && Platform.isPad && width >= 700;
  return { pad, width, height, landscape: width > height };
}

const BACKGROUND_LOCATION_TASK = "camera-background-location-v060";
const BACKGROUND_SESSION_KEY = "camalert_background_session_v1";
const BACKGROUND_LAST_ALERT_KEY = "camalert_background_last_alert_v1";
const BACKGROUND_GUIDE_KEY = "camalert_background_guide_postponed_v1";
let foregroundTripRunning = false;
const MIN_MOVING_SPEED_KMH = 8;
const CAMERA_ALERT_OVERLAY_MS = 4200;
const FORWARD_ANGLE_DEGREES = 45;
const HISTORY_KEY = "camera_history_v060";
const SETTINGS_KEY = "camera_settings_v060";
const REPORTS_KEY = "camera_reports_v060";
const HIDDEN_KEY = "camera_hidden_v060";
const ONBOARDING_KEY = "camalert_onboarding_v1";


const REPORT_API_URL = "https://camera.21wek.com/api/report.php";
const REMOTE_CACHE_KEY = "camera_remote_cache_v081";

const URLS = {
  home: "https://camera.21wek.com/",
  privacy: "https://camera.21wek.com/privacy.html",
  support: "https://camera.21wek.com/support.html",
  safety: "https://camera.21wek.com/safety.html",
  sources: "https://camera.21wek.com/sources.html",
  terms: "https://camera.21wek.com/terms.html",
  reportHelp: "https://camera.21wek.com/report-camera.html",
};

const I18N = {
  ru: {
    title: "Камеры на дорогах", start: "Начать поездку", stop: "Остановить",
    nearest: "Ближайшая камера", ahead: "Камера впереди по ходу движения",
    waitMove: "Ждёт движения", speed: "Текущая скорость",
    direction: "Направление", background: "Фоновый режим", on: "Включён", off: "Выключен",
    enable: "Включить", disable: "Выключить", map: "Карта", nearby: "Рядом",
    settings: "Настройки", history: "История", report: "Сообщить о камере",
    removed: "Камеры больше нет", limit: "Ограничение",
    aheadWarn: "Впереди камера", gpsWorks: "GPS работает", gpsWait: "GPS ждёт",
    saved: "Сохранено", cancel: "Отмена", send: "Сохранить сообщение",
    reportTitle: "Новая камера", removedTitle: "Камеры больше нет",
    note: "Сообщения пока сохраняются на телефоне. Сервер синхронизации подключим отдельно.",
    about: "О приложении", privacy: "Политика конфиденциальности", safety: "Безопасность",
    sources: "Источники данных", support: "Поддержка", terms: "Условия использования",
    reportHelp: "Как сообщить о камере", website: "Сайт приложения", coverage: "Покрытие", dataUpdate: "Обновление базы", lastUpdate: "Последнее обновление", databaseVersion: "Версия базы", lastCheck: "Последняя проверка обновлений", updateNow: "Обновить сейчас", updated: "База обновлена", databaseCurrent: "Новых данных нет. Версия базы не изменилась.", reportSent: "Сообщение отправлено на проверку", reportFailed: "Не удалось отправить, сохранено на телефоне", country: "Страна", ukraine: "Украина", poland: "Польша", languageLabel: "Язык", voiceLabel: "Голос", vibrationLabel: "Вибрация", smartDistanceLabel: "Умная дистанция по скорости", distancesLabel: "Дистанции предупреждения", band1: "До 60 км/ч", band2: "60–89 км/ч", band3: "90–119 км/ч", band4: "120+ км/ч"
  },
  uk: {
    title: "Камери на дорогах", start: "Почати поїздку", stop: "Зупинити",
    nearest: "Найближча камера", ahead: "Камера попереду за напрямком руху",
    waitMove: "Очікує руху", speed: "Поточна швидкість",
    direction: "Напрямок", background: "Фоновий режим", on: "Увімкнено", off: "Вимкнено",
    enable: "Увімкнути", disable: "Вимкнути", map: "Карта", nearby: "Поруч",
    settings: "Налаштування", history: "Історія", report: "Повідомити про камеру",
    removed: "Камери більше немає", limit: "Обмеження",
    aheadWarn: "Попереду камера", gpsWorks: "GPS працює", gpsWait: "GPS очікує",
    saved: "Збережено", cancel: "Скасувати", send: "Зберегти повідомлення",
    reportTitle: "Нова камера", removedTitle: "Камери більше немає",
    note: "Повідомлення поки зберігаються на телефоні. Сервер синхронізації підключимо окремо.",
    about: "Про застосунок", privacy: "Політика конфіденційності", safety: "Безпека",
    sources: "Джерела даних", support: "Підтримка", terms: "Умови використання",
    reportHelp: "Як повідомити про камеру", website: "Сайт застосунку", coverage: "Покриття", dataUpdate: "Оновлення бази", lastUpdate: "Останнє оновлення", databaseVersion: "Версія бази", lastCheck: "Остання перевірка оновлень", updateNow: "Оновити зараз", updated: "Базу оновлено", databaseCurrent: "Нових даних немає. Версія бази не змінилася.", reportSent: "Повідомлення надіслано на перевірку", reportFailed: "Не вдалося надіслати, збережено на телефоні", country: "Країна", ukraine: "Україна", poland: "Польща", languageLabel: "Мова", voiceLabel: "Голос", vibrationLabel: "Вібрація", smartDistanceLabel: "Розумна дистанція за швидкістю", distancesLabel: "Дистанції попередження", band1: "До 60 км/год", band2: "60–89 км/год", band3: "90–119 км/год", band4: "120+ км/год"
  },
  en: {
    title: "Road Cameras", start: "Start trip", stop: "Stop",
    nearest: "Nearest camera", ahead: "Camera ahead",
    waitMove: "Waiting for movement", speed: "Current speed",
    direction: "Direction", background: "Background mode", on: "On", off: "Off",
    enable: "Enable", disable: "Disable", map: "Map", nearby: "Nearby",
    settings: "Settings", history: "History", report: "Report camera",
    removed: "Camera is gone", limit: "Speed limit",
    aheadWarn: "Camera ahead", gpsWorks: "GPS active", gpsWait: "GPS waiting",
    saved: "Saved", cancel: "Cancel", send: "Save report",
    reportTitle: "New camera", removedTitle: "Camera is gone",
    note: "Reports are stored on this phone for now. Server sync will be connected separately.",
    about: "About", privacy: "Privacy Policy", safety: "Safety",
    sources: "Data sources", support: "Support", terms: "Terms of Use",
    reportHelp: "How to report a camera", website: "App website", coverage: "Coverage", dataUpdate: "Database update", lastUpdate: "Last update", databaseVersion: "Database version", lastCheck: "Last update check", updateNow: "Update now", updated: "Database updated", databaseCurrent: "No new data. The database version is unchanged.", reportSent: "Report sent for review", reportFailed: "Could not send; saved on this phone", country: "Country", ukraine: "Ukraine", poland: "Poland", languageLabel: "Language", voiceLabel: "Voice", vibrationLabel: "Vibration", smartDistanceLabel: "Smart distance by speed", distancesLabel: "Alert distances", band1: "Up to 60 km/h", band2: "60–89 km/h", band3: "90–119 km/h", band4: "120+ km/h"
  },
  pl: {
    title: "Kamery drogowe",
    drive: "Jazda", map: "Mapa", nearby: "W pobliżu",
    history: "Historia", settings: "Ustawienia",
    start: "Rozpocznij jazdę", stop: "Zatrzymaj",
    nearest: "Najbliższy fotoradar",
    ahead: "Fotoradar przed Tobą",
    waitMove: "Czeka na ruch",
    speed: "Aktualna prędkość",
    direction: "Kierunek",
    gpsWorks: "GPS działa", gpsWait: "GPS czeka",
    background: "Tryb w tle",
    on: "Włączony", off: "Wyłączony",
    enable: "Włącz", disable: "Wyłącz",
    limit: "Ograniczenie",
    aheadWarn: "Fotoradar przed Tobą",
    report: "Zgłoś fotoradar",
    removed: "Fotoradaru już nie ma",
    saved: "Zapisano", cancel: "Anuluj",
    send: "Zapisz zgłoszenie",
    reportTitle: "Nowy fotoradar",
    removedTitle: "Fotoradaru już nie ma",
    localOnly: "Zgłoszenie zapisano na tym telefonie.",
    noHistory: "Brak ostrzeżeń.",
    about: "O aplikacji",
    privacy: "Polityka prywatności",
    safety: "Bezpieczeństwo",
    sources: "Źródła danych",
    support: "Pomoc",
    terms: "Warunki korzystania",
    reportHelp: "Jak zgłosić fotoradar",
    website: "Strona aplikacji", coverage: "Zasięg", dataUpdate: "Aktualizacja bazy", lastUpdate: "Ostatnia aktualizacja", databaseVersion: "Wersja bazy", lastCheck: "Ostatnie sprawdzenie aktualizacji", updateNow: "Aktualizuj teraz", updated: "Baza zaktualizowana", databaseCurrent: "Brak nowych danych. Wersja bazy bez zmian.", reportSent: "Zgłoszenie wysłano do weryfikacji", reportFailed: "Nie udało się wysłać; zapisano na telefonie",
    country: "Kraj", languageLabel: "Język", voiceLabel: "Głos", vibrationLabel: "Wibracje", smartDistanceLabel: "Inteligentna odległość według prędkości", distancesLabel: "Odległości ostrzegania", band1: "Do 60 km/h", band2: "60–89 km/h", band3: "90–119 km/h", band4: "120+ km/h",
    ukraine: "Ukraina",
    poland: "Polska"
  },
};

const DEFAULT_SETTINGS = {
  language: "ru",
  country: "ua",
  driveTheme: "auto",
  voice: true,
  vibration: true,
  smartDistance: true,
  cameraWarnings: true,
  cityDistance: 600,
  roadDistance: 900,
  highwayDistance: 1200,
  fastDistance: 1500,

};

const WARNING_UI = {
  ru: {
    switchLabel: "Предупреждения о камерах",
    off: "Предупреждения о камерах выключены",
    offMap: "Карта без камер. Спидометр и дистанции предупреждения не меняются.",
    laws: "Правила по странам",
    lawsSearch: "Поиск страны",
    lawsBack: "Назад",
    source: "Официальный источник",
    sourceMissing: "Официальный источник в материалах проверки не записан",
    checkedOn: "Дата проверки",
    checkedOnMissing: "Дата проверки в материалах не записана",
    lawsNote: "Раздел только сообщает о местных ограничениях. Он не включает и не выключает предупреждения.",
  },
  uk: {
    switchLabel: "Попередження про камери",
    off: "Попередження про камери вимкнені",
    offMap: "Карта без камер. Спідометр і дистанції попередження не змінюються.",
    laws: "Правила за країнами",
    lawsSearch: "Пошук країни",
    lawsBack: "Назад",
    source: "Офіційне джерело",
    sourceMissing: "Офіційне джерело в матеріалах перевірки не записане",
    checkedOn: "Дата перевірки",
    checkedOnMissing: "Дата перевірки в матеріалах не записана",
    lawsNote: "Розділ лише повідомляє про місцеві обмеження. Він не вмикає і не вимикає попередження.",
  },
  en: {
    switchLabel: "Camera warnings",
    off: "Camera warnings are off",
    offMap: "The map has no cameras. The speedometer and alert distances stay as they are.",
    laws: "Rules by country",
    lawsSearch: "Search countries",
    lawsBack: "Back",
    source: "Official source",
    sourceMissing: "The check did not record an official source",
    checkedOn: "Check date",
    checkedOnMissing: "The check date was not recorded",
    lawsNote: "This section only describes local restrictions. It does not turn warnings on or off.",
  },
  pl: {
    switchLabel: "Ostrzeżenia o kamerach",
    off: "Ostrzeżenia o kamerach są wyłączone",
    offMap: "Mapa bez kamer. Prędkościomierz i odległości ostrzeżeń pozostają bez zmian.",
    laws: "Zasady według krajów",
    lawsSearch: "Szukaj kraju",
    lawsBack: "Wstecz",
    source: "Oficjalne źródło",
    sourceMissing: "Materiały sprawdzenia nie zawierają oficjalnego źródła",
    checkedOn: "Data sprawdzenia",
    checkedOnMissing: "Data sprawdzenia nie została zapisana",
    lawsNote: "Ta sekcja tylko opisuje lokalne ograniczenia. Nie włącza i nie wyłącza ostrzeżeń.",
  },
};

let bgSettings = DEFAULT_SETTINGS;
let bgHiddenIds = new Set();
let bgLastAlert = { id: null, at: 0, distance: Infinity };
let bgCameraFeeds = {};

const toRad = v => (v * Math.PI) / 180;
const toDeg = v => (v * 180) / Math.PI;
const norm = a => ((a % 360) + 360) % 360;

function angleDiff(a, b) {
  const d = Math.abs(norm(a) - norm(b));
  return d > 180 ? 360 - d : d;
}
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function bearingDegrees(lat1, lon1, lat2, lon2) {
  const p1 = toRad(lat1), p2 = toRad(lat2);
  const l1 = toRad(lon1), l2 = toRad(lon2);
  const y = Math.sin(l2-l1) * Math.cos(p2);
  const x = Math.cos(p1)*Math.sin(p2) - Math.sin(p1)*Math.cos(p2)*Math.cos(l2-l1);
  return norm(toDeg(Math.atan2(y, x)));
}
function alertDistanceForSpeed(speedKmh, settings) {
  if (!settings.smartDistance) return settings.roadDistance;
  if (speedKmh < 60) return settings.cityDistance;
  if (speedKmh < 90) return settings.roadDistance;
  if (speedKmh < 120) return settings.highwayDistance;
  return settings.fastDistance;
}
function visibleCameras() {
  return cameraPoints(countryFeed(bgCameraFeeds, bgSettings.country, data, plData))
    .filter(c => !bgHiddenIds.has(String(c.id)));
}
function countryCameraCount(code, feeds, coverage) {
  if (feeds?.[code] && !feeds[code]._removed) return cameraPoints(feeds[code]).length;
  const entry = coverage.find(item => item.country_code === code);
  if (Number.isInteger(entry?.record_count)) return entry.record_count;
  if (Number.isInteger(entry?.total)) return entry.total;
  if (code === "UA") return cameraPoints(data).length;
  if (code === "PL") return cameraPoints(plData).length;
  return null;
}
function countryDisplayName(code, language) {
  const names = {
    ru:{UA:"Украина",PL:"Польша"},uk:{UA:"Україна",PL:"Польща"},
    en:{UA:"Ukraine",PL:"Poland"},pl:{UA:"Ukraina",PL:"Polska"},
  };
  return names[language]?.[code] || COUNTRY_NAMES[code] || code;
}
function findNearestAny(latitude, longitude, max = Infinity) {
  let best = null, bestDistance = Infinity;
  for (const cam of visibleCameras()) {
    const d = distanceMeters(latitude, longitude, cam.latitude, cam.longitude);
    if (d < bestDistance && d <= max) { bestDistance = d; best = cam; }
  }
  return best ? { ...best, distance: Math.round(bestDistance) } : null;
}
function findNearestAhead(latitude, longitude, movementHeading, maxDistance = 5000) {
  if (movementHeading == null) return null;
  let best = null, bestDistance = Infinity;
  for (const cam of visibleCameras()) {
    const d = distanceMeters(latitude, longitude, cam.latitude, cam.longitude);
    if (d > maxDistance) continue;
    if (cam.direction != null && /^\d+(\.\d+)?$/.test(String(cam.direction)) && angleDiff(movementHeading,Number(cam.direction))>60) continue;
    const camBearing = bearingDegrees(latitude, longitude, cam.latitude, cam.longitude);
    if (angleDiff(movementHeading, camBearing) <= FORWARD_ANGLE_DEGREES && d < bestDistance) {
      bestDistance = d;
      best = { ...cam, distance: Math.round(d) };
    }
  }
  return best;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

let backgroundQueue = Promise.resolve();
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, payload => {
  backgroundQueue = backgroundQueue.catch(() => {}).then(() => processBackgroundLocation(payload));
  return backgroundQueue;
});
async function processBackgroundLocation({ data: taskData, error }) {
  if (error || !taskData?.locations?.length) return;
  if (AppState.currentState === "active" && foregroundTripRunning) return;
  const session = JSON.parse(await AsyncStorage.getItem(BACKGROUND_SESSION_KEY) || "null");
  if (!session?.enabled) return;
  try {
    const sraw = await AsyncStorage.getItem(SETTINGS_KEY);
    bgSettings = {...mergeStoredSettings(DEFAULT_SETTINGS, sraw ? JSON.parse(sraw) : null), country:session.country};
    bgLastAlert = JSON.parse(await AsyncStorage.getItem(BACKGROUND_LAST_ALERT_KEY) || "null") || {id:null,at:0,distance:Infinity};
    const hraw = await AsyncStorage.getItem(HIDDEN_KEY);
    bgHiddenIds = new Set(hraw ? JSON.parse(hraw).map(String) : []);
    const cache = await loadCameraCache(AsyncStorage,REMOTE_CACHE_KEY);
    if (cache) {
      bgCameraFeeds = cache.feeds || {UA:cache.ua,PL:cache.pl};
    }
  } catch { return; }
  if (!cameraWarningsEnabled(bgSettings)) return;

  const pos = taskData.locations[taskData.locations.length - 1];
  if (!Number.isFinite(pos.timestamp) || Date.now()-pos.timestamp > 60000) return;
  const { latitude, longitude, speed: rawSpeed, heading: rawHeading } = pos.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
  const speedKmh = typeof rawSpeed === "number" && rawSpeed >= 0 ? Math.round(rawSpeed * 3.6) : 0;
  const heading = typeof rawHeading === "number" && rawHeading >= 0 ? norm(rawHeading) : null;
  if (speedKmh < MIN_MOVING_SPEED_KMH || heading == null) return;

  const threshold = alertDistanceForSpeed(speedKmh, bgSettings);
  const feed = countryFeed(bgCameraFeeds, session.country, data, plData);
  const cam = session.country === "UA"
    ? findNearestAhead(latitude, longitude, heading, Math.max(5000, threshold + 1000))
    : nearestPolandPoint(feed, latitude, longitude, heading, Math.max(5000, threshold + 1000));
  if (!cam || cam.distance > threshold) return;

  const now = Date.now();
  if (bgLastAlert.country === session.country && bgLastAlert.id === cam.id && now - bgLastAlert.at < 45000 && bgLastAlert.distance - cam.distance < 250) return;
  bgLastAlert = { id: cam.id, at: now, distance: cam.distance, country: session.country };

  const message = cameraAlertCopy(bgSettings.language, cam, speedKmh);
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        sound: bgSettings.voice ? "default" : false,
      },
      trigger: Platform.OS === "android" ? {channelId:`camera-alerts-${bgSettings.voice ? "sound" : "silent"}-${bgSettings.vibration ? "vibrate" : "still"}`} : null,
    });
  } catch {
    // Notification delivery and spoken warnings are independent channels.
  }
  const speechEvent = {...bgLastAlert,country:session.country,
    speechStatus:bgSettings.voice ? "pending" : "disabled"};
  const saveSpeechStatus = async status => {
    speechEvent.speechStatus = status;
    speechEvent.speechUpdatedAt = Date.now();
    await AsyncStorage.setItem(BACKGROUND_LAST_ALERT_KEY,JSON.stringify(speechEvent));
  };
  await saveSpeechStatus(speechEvent.speechStatus);
  // Keep the notification as a fallback. Await completion before returning the
  // location task on either platform; never interrupt current CamAlert speech.
  if (bgSettings.voice) {
    try {
      const current = JSON.parse(await AsyncStorage.getItem(BACKGROUND_SESSION_KEY) || "null");
      if (!current?.enabled || current.country !== session.country) {
        await saveSpeechStatus("session-ended");
      } else if (await Speech.isSpeakingAsync()) {
        await saveSpeechStatus("already-speaking");
      } else {
        await saveSpeechStatus("requested");
        const outcome = await Speech.speakAndWait(message.speech, { language: message.locale, rate: 0.95 });
        await saveSpeechStatus(outcome);
      }
    } catch {
      // A recorded camera event alone is not evidence of audible speech.
      await saveSpeechStatus("error").catch(() => {});
    }
  }
}

// Empty tombstones keep deleted bundled databases from reappearing after restart.
function storedCountryCodes(feeds) {
  return [...new Set(["UA", "PL", ...Object.keys(feeds)])].filter(code => {
    const feed = feeds[code];
    if (feed?._removed) return false;
    return !!feed || code === "UA" || code === "PL";
  });
}

const ThemeContext = createContext(false);
const NIGHT_MAP_STYLE = [
  {elementType:"geometry",stylers:[{color:"#0B1829"}]},
  {elementType:"labels.text.fill",stylers:[{color:"#CAD7E7"}]},
  {elementType:"labels.text.stroke",stylers:[{color:"#0B1829"}]},
  {featureType:"water",elementType:"geometry",stylers:[{color:"#06111F"}]},
  {featureType:"road",elementType:"geometry",stylers:[{color:"#29435A"}]},
  {featureType:"road.highway",elementType:"geometry",stylers:[{color:"#416078"}]},
  {featureType:"poi",elementType:"geometry",stylers:[{color:"#152A36"}]},
];
function themedStyles(base, night, overrides) {
  if (!night) return base;
  const result={...base};
  for (const [name,value] of Object.entries(overrides)) result[name]=[base[name],value];
  return result;
}
function appThemeStyles(night) {
  const overrides={safe:{backgroundColor:"#0B1829"},nav:{backgroundColor:"#172A40"},navActive:{backgroundColor:"#29435A"},button:{backgroundColor:"#1260E8"},smallButton:{backgroundColor:"#1260E8"},driveThemeOptionActive:{backgroundColor:"#1260E8",borderColor:"#23D3EF"}};
  for(const key of ["card","stat","backgroundCard","action","testButton","listItem","settingsCard","modalCard","dataCard","coverageCard"]) overrides[key]={backgroundColor:"#172A40",borderColor:"#29435A"};
  for(const key of ["stepBtn","lang","driveThemeOption"]) overrides[key]={backgroundColor:"#29435A",borderColor:"#416078"};
  for(const key of ["navLabel","title","subtitle","label","distance","place","region","limitText","small","value","empty","statValue","heading","unit","backgroundTitle","backgroundText","actionText","testButtonText","listTitle","listSub","listDistance","sectionTitle","settingLabel","stepValue","aboutLabel","chev","modalTitle","modalText","typeLabel","dataLabel","dataValue","coverageLine","note","driveThemeOptionText"]) overrides[key]={...overrides[key],color:"#CAD7E7"};
  overrides.langActive={backgroundColor:"#1260E8"};
  overrides.input={color:"#FFFFFF",borderColor:"#416078"};
  overrides.settingRow={borderBottomColor:"#29435A"};overrides.aboutRow={borderBottomColor:"#29435A"};
  return themedStyles(baseAppStyles,night,overrides);
}
function homeThemeStyles(night) {
  const overrides={heroShade:{backgroundColor:"rgba(9,30,47,0.32)"}};
  for(const key of ["brandMark","settingsButton","statusCard","navigatorCard","navigatorIconBox","countryCard"]) overrides[key]={backgroundColor:"#172A40",borderColor:"#29435A"};
  for(const key of ["brandCam","settingsGlyph","statusIcon","databaseIcon","statusTitle","title","sectionTitle","countryName","countryChevron"]) overrides[key]={color:"#FFFFFF"};
  for(const key of ["statusValue","subtitle","navigatorLabel","navNote","countryMeta","countryUpdate"]) overrides[key]={color:"#CAD7E7"};
  overrides.whereButton={backgroundColor:"#10263B",borderColor:"#7EB6FF"};
  overrides.whereButtonText={color:"#D6E6FF"};
  return themedStyles(baseHomeStyles,night,overrides);
}

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const t = I18N[settings.language] || I18N.ru;
  const systemTheme = useColorScheme();
  const isNight = settings.driveTheme === "auto" ? systemTheme === "dark" : settings.driveTheme !== "day";
  const resolvedTheme = isNight ? "night" : "day";
  const ui = uiCopy(settings.language);
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const [nearbyType,setNearbyType]=useState("all");
  const [nearbyLimit,setNearbyLimit]=useState("all");
  const s = useMemo(() => appThemeStyles(isNight),[isNight]);
  const homeStyles = useMemo(() => homeThemeStyles(isNight),[isNight]);
  const countriesStyles = themedStyles(baseCountriesStyles,isNight,{segment:{backgroundColor:"#29435A"},segmentText:{color:"#CAD7E7"}});
  const [onboardingState, setOnboardingState] = useState("loading");
  const [onboardingPage, setOnboardingPage] = useState(0);
  const [lawsOpen, setLawsOpen] = useState(false);
  const [lawsQuery, setLawsQuery] = useState("");

  const [coords, setCoords] = useState(null);
  const [nearbyPosition, setNearbyPosition] = useState(null);
  const [nearbyStatus, setNearbyStatus] = useState("idle");
  const [nearbyRefresh, setNearbyRefresh] = useState(0);
  const [nearest, setNearest] = useState(null);
  const [ahead, setAhead] = useState(null);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [speedAvailable, setSpeedAvailable] = useState(false);
  const [heading, setHeading] = useState(null);
  const [gpsFixReceived, setGpsFixReceived] = useState(false);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState("unknown");
  const [averageSectionUi, setAverageSectionUi] = useState(null);
  const averageSectionUiRef = useRef(null);
  const averageSectionEndTimer = useRef(null);
  const [cameraAlertPresentation, setCameraAlertPresentation] = useState(null);
  const cameraAlertDismissTimer = useRef(null);
  const polandVisualAlertCameraId = useRef(null);
  const plSectionIdRef = useRef(null);
  const sectionPaceRef = useRef(null);
  const plLastSectionState = useRef(null);
  const [active, setActive] = useState(false);
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);
  const [history, setHistory] = useState([]);
  const [hiddenIds, setHiddenIds] = useState([]);
  const [reports, setReports] = useState([]);
  const [remoteFeeds,setRemoteFeeds]=useState({});
  const [countryCoverage,setCountryCoverage]=useState([]);
  const [offlineCountryCodes,setOfflineCountryCodes]=useState(["UA","PL"]);
  const databaseBusy = useRef(false);
  const databaseReady = useRef(false);
  const [countryLoading,setCountryLoading]=useState(null);
  const [databaseErrors,setDatabaseErrors]=useState({});
  const [countrySearch,setCountrySearch]=useState("");
  const [countryScreenTab,setCountryScreenTab]=useState("countries");
  const remoteFeedsRef=useRef({});
  const countryVersionsRef=useRef({});
  const selectedCountry=String(settings.country||"ua").toUpperCase();
  const activeUAData=countryFeed(remoteFeeds,"UA",data,plData);
  const activePLData=countryFeed(remoteFeeds,selectedCountry==="UA"?"PL":selectedCountry,data,plData);
  const activeCountryFeedRef=useRef(activePLData);
  activeCountryFeedRef.current=activePLData;
  const [coverage,setCoverage]=useState(null);
  const [publishedAt,setPublishedAt]=useState(null);
  const [checkedAt,setCheckedAt]=useState(null);
  const [backgroundGuide,setBackgroundGuide]=useState(false);
  const [guideReturned,setGuideReturned]=useState(false);
  const [backgroundAccess,setBackgroundAccess]=useState("missing");
  const [tab, setTab] = useState("drive");
  const [modal, setModal] = useState(null);
  const [alertPreviewMode, setAlertPreviewMode] = useState("expanded");
  const [navigatorDestination, setNavigatorDestination] = useState("");
  const [googleNavigationOpen, setGoogleNavigationOpen] = useState(false);
  const [iosRouteOpen, setIosRouteOpen] = useState(false);
  const [routeGuidance, setRouteGuidance] = useState(null);
  const [maneuver, setManeuver] = useState(null);
  const cameraSpeakingRef = useRef(false);
  const navSpokenRef = useRef({});
  const navPendingRef = useRef(null);
  const rerouteHistoryRef = useRef([]);
  const rerouteBusyRef = useRef(false);
  const navInFlightRef = useRef(null);
  const emitNavRef = useRef(() => {});
  // A camera warning calls Speech.stop() and then speaks. Nav does not call stop,
  // and a phrase cut off by that stop stays unannounced so it can wait.
  emitNavRef.current = (plan) => {
    if (!plan?.speak || navSpokenRef.current[plan.key]) return;
    if (cameraSpeakingRef.current || navInFlightRef.current) {
      navPendingRef.current = plan;
      return;
    }
    navPendingRef.current = null;
    navInFlightRef.current = plan.key;
    Speech.speak(plan.phrase, {
      language: plan.locale,
      rate: 0.95,
      onDone: () => {
        navSpokenRef.current = { ...navSpokenRef.current, [plan.key]: true };
        if (navInFlightRef.current === plan.key) navInFlightRef.current = null;
        const waiting = navPendingRef.current;
        if (waiting && !cameraSpeakingRef.current) {
          navPendingRef.current = null;
          emitNavRef.current(waiting);
        }
      },
      onStopped: () => {
        if (navInFlightRef.current === plan.key) navInFlightRef.current = null;
        if (cameraSpeakingRef.current) navPendingRef.current = plan;
      },
      onError: () => {
        if (navInFlightRef.current === plan.key) navInFlightRef.current = null;
      },
    });
  };
  useEffect(() => {
    return Speech.subscribeCameraSpeech((speaking) => {
      cameraSpeakingRef.current = speaking;
      if (!speaking && navPendingRef.current) emitNavRef.current(navPendingRef.current);
    });
  }, []);
  useEffect(() => {
    navSpokenRef.current = {};
    navPendingRef.current = null;
    rerouteHistoryRef.current = [];
  }, [routeGuidance?.builtAt]);
  useEffect(() => {
    if (!active || !routeGuidance || !coords) {
      setManeuver(null);
      return;
    }
    const speedMps = speedAvailable ? speedKmh / 3.6 : 0;
    const snapshot = guidanceState(coords, routeGuidance);
    const progress = approximateRouteProgress(coords, routeGuidance);
    if (!snapshot && !progress) {
      setManeuver(null);
      return;
    }
    setManeuver({
      ...(snapshot || {}),
      remainingMeters: progress ? progress.remainingMeters : null,
      etaSeconds: progress ? progress.etaSeconds : null,
    });
    if (snapshot) {
      const decision = shouldRequestReroute({
        at: Date.now(),
        offRouteMeters: snapshot.offRouteMeters,
        speedMps,
        history: rerouteHistoryRef.current,
      });
      if (!decision.ok) rerouteHistoryRef.current = decision.history;
      else if (!rerouteBusyRef.current) {
        rerouteBusyRef.current = true;
        rerouteHistoryRef.current = decision.history;
        const destination = routeGuidance.destination;
        const title = routeGuidance.title;
        calculateRoutes(coords, destination).then((routes) => {
          const next = routes && routes[0];
          if (!next) return;
          const packed = {
            builtAt: Date.now(),
            destination,
            title,
            name: next.name,
            distance: next.distance,
            expectedTravelTime: next.expectedTravelTime,
            polyline: next.polyline,
            steps: next.steps,
          };
          setRouteGuidance(packed);
        }).catch(() => {}).finally(() => { rerouteBusyRef.current = false; });
      }
      emitNavRef.current(planNavAnnouncement({
        stepIndex: snapshot.stepIndex,
        distanceMeters: snapshot.distanceMeters,
        speedMps,
        spoken: navSpokenRef.current,
        instruction: snapshot.instruction,
        language: settings.language,
      }));
    }
  }, [active, routeGuidance, coords, speedKmh, speedAvailable, settings.language]);
  const routeMapCameras = useMemo(() => {
    const line = routeGuidance?.polyline;
    if (!Array.isArray(line) || line.length < 2) return [];
    return narrowCamerasToRoute(visibleCameras(), line, ROUTE_CORRIDOR_METERS).filter((camera) => (
      Number.isFinite(Number(camera.latitude)) && Number.isFinite(Number(camera.longitude))
    ));
  }, [routeGuidance?.builtAt, routeGuidance?.polyline]);
  const [reportNote, setReportNote] = useState("");
  useEffect(()=>{
    if(active && (!speedAvailable || speedKmh>0) && (modal==="new" || modal==="removed")) setModal(null);
  },[active,speedAvailable,speedKmh,modal]);
  const sub = useRef(null);
  const timer = useRef(null);
  const lastSpoken = useRef({ id: null, distance: Infinity });
  const catalogRef = useRef({ publishedAt: null, checkedAt: null });
  const settingsHydrated = useRef(false);
  const postponedRef = useRef(false);
  const pendingBackgroundRef = useRef(false);
  const backgroundEnabledRef = useRef(false);
  const onAppActiveRef = useRef(async () => {});
  const { pad, height: windowHeight } = usePadLayout();

  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") onAppActiveRef.current();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    backgroundEnabledRef.current = backgroundEnabled;
  }, [backgroundEnabled]);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then(value => setOnboardingState(value === "done" ? "done" : "new"))
      .catch(() => setOnboardingState("new"));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await AsyncStorage.getItem(SETTINGS_KEY);
        const loadedSettings = mergeStoredSettings(DEFAULT_SETTINGS, s ? JSON.parse(s) : null);
        bgSettings = loadedSettings;
        settingsHydrated.current = true;
        if (s) setSettings(loadedSettings);
        // Apply Android resources before the user opens any Google map/session.
        if (Platform.OS === "android" && NativeModules.CamAlertLocale) {
          const language = s ? JSON.parse(s).language || DEFAULT_SETTINGS.language : DEFAULT_SETTINGS.language;
          try { await withNavigationWindow(() => NativeModules.CamAlertLocale.setLanguage(language), () => AppState.currentState === "active"); } catch {}
        }
        const h = await AsyncStorage.getItem(HISTORY_KEY);
        if (h) setHistory(JSON.parse(h));
        const hidden = await AsyncStorage.getItem(HIDDEN_KEY);
        if (hidden) {
          const ids = JSON.parse(hidden);
          setHiddenIds(ids);
          bgHiddenIds = new Set(ids.map(String));
        }
        const r = await AsyncStorage.getItem(REPORTS_KEY);
        if (r) setReports(JSON.parse(r));
        const saved = await loadCameraCache(AsyncStorage,REMOTE_CACHE_KEY);
        if (saved) {
          const feeds=saved.feeds||{UA:saved.ua,PL:saved.pl};
          remoteFeedsRef.current=feeds;countryVersionsRef.current=saved.countryVersions||{};bgCameraFeeds=feeds;setRemoteFeeds(feeds);
          setOfflineCountryCodes(storedCountryCodes(feeds));
          const storedPublished = saved.publishedAt || null;
          const storedChecked = saved.checkedAt || (!saved.publishedAt && saved.stamp) || null;
          catalogRef.current = { publishedAt: storedPublished, checkedAt: storedChecked };
          setCountryCoverage(saved.countries||[]);setCoverage(saved.cov||null);
          setPublishedAt(storedPublished);setCheckedAt(storedChecked);
        }
        const postponed = await AsyncStorage.getItem(BACKGROUND_GUIDE_KEY);
        postponedRef.current = postponed === "1";
        databaseReady.current = true;
        const initialCountry = s ? String(JSON.parse(s).country || "ua").toUpperCase() : "UA";
        await refreshRemoteData(true, initialCountry);
        const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        const session = JSON.parse(await AsyncStorage.getItem(BACKGROUND_SESSION_KEY) || "null");
        setBackgroundEnabled(started && !!session?.enabled);
        const [foregroundPermission, backgroundPermission] = await Promise.all([
          Location.getForegroundPermissionsAsync(),
          Location.getBackgroundPermissionsAsync(),
        ]);
        setBackgroundAccess(describeLocationAccess({ foreground: foregroundPermission, background: backgroundPermission }));
        settingsHydrated.current = true;
      } catch {
        settingsHydrated.current = true;
      }
    })();

    return () => {
      if (sub.current) sub.current.remove();
      if (timer.current) clearInterval(timer.current);
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (!settingsHydrated.current) return;
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(()=>{});
    bgSettings = settings;
  }, [settings]);

  useEffect(() => {
    if (active) stopTracking();
    setNearest(null);setAhead(null);plSectionIdRef.current=null;sectionPaceRef.current=null;plLastSectionState.current=null;
    setAverageSectionUi(null);averageSectionUiRef.current=null;
    if (averageSectionEndTimer.current) clearTimeout(averageSectionEndTimer.current);
    refreshRemoteData(true,selectedCountry);
  }, [selectedCountry]);

  function databaseMessage(kind) {
    const messages = {
      limit: {ru:"Можно хранить базы двух стран. Сначала удалите одну базу из скачанных.",uk:"Можна зберігати бази двох країн. Спочатку видаліть одну із завантажених баз.",en:"You can keep two country databases. Delete one downloaded database first.",pl:"Można przechowywać bazy dwóch krajów. Najpierw usuń jedną pobraną bazę."},
      busy: {ru:"Дождитесь завершения операции с базой.",uk:"Дочекайтеся завершення операції з базою.",en:"Wait for the database operation to finish.",pl:"Poczekaj na zakończenie operacji na bazie."},
      error: {ru:"Не удалось сохранить изменения. Проверьте интернет и свободное место. Сохранённые базы не изменены.",uk:"Не вдалося зберегти зміни. Перевірте інтернет і вільне місце. Збережені бази не змінено.",en:"Could not save changes. Check connectivity and free space. Saved databases are unchanged.",pl:"Nie udało się zapisać zmian. Sprawdź połączenie i wolne miejsce. Zapisane bazy pozostają bez zmian."},
      active: {ru:"Сначала завершите поездку и выключите фоновый режим, затем удалите используемую базу.",uk:"Спочатку завершіть поїздку та вимкніть фоновий режим.",en:"End the trip and turn off background mode before deleting the active database.",pl:"Zakończ jazdę i wyłącz tryb tła przed usunięciem aktywnej bazy."},
    };
    Alert.alert("CamAlert", messages[kind][settings.language] || messages[kind].en);
  }

  async function selectCountryDatabase(code) {
    if (code !== selectedCountry && (backgroundEnabled || backgroundBusy.current)) {
      Alert.alert("Фоновая сессия", "Остановите фоновый режим перед сменой страны.");return;
    }
    if (!databaseReady.current || databaseBusy.current) {databaseMessage("busy");return;}
    const installed = storedCountryCodes(remoteFeedsRef.current);
    if (!installed.includes(code)) {
      if (installed.length >= 2) {databaseMessage("limit");return;}
      if (!await refreshRemoteData(false,code)) return;
    }
    // Country choice loads a database. It does not change the camera-warning switch.
    setSettings(current => ({...current,country:code.toLowerCase()}));
  }

  async function refreshRemoteData(silent=false,country=selectedCountry) {
    if (!databaseReady.current || databaseBusy.current) {if (!silent) databaseMessage("busy");return false;}
    const installed = storedCountryCodes(remoteFeedsRef.current);
    // Automatic refresh updates an existing database only; it never restores a deleted one.
    if (!installed.includes(country)) {
      if (silent) return false;
      if (installed.length >= 2) {databaseMessage("limit");return false;}
    }
    databaseBusy.current = true;
    setCountryLoading(country);
    try {
      const result=await refreshCountryDelivery({country,feeds:remoteFeedsRef.current,versions:countryVersionsRef.current,countries:countryCoverage});
      if (!result.feed || result.source==='offline' || result.source==='bundled') {
        setDatabaseErrors(previous=>({...previous,[country]:true}));
        if (!silent) databaseMessage("error");
        return false;
      }
      const feeds={...remoteFeedsRef.current,[country]:result.feed};
      const countryVersions={...countryVersionsRef.current};
      if(result.version)countryVersions[country]=result.version;else delete countryVersions[country];
      const countries=result.countries;
      const coverageFor=code=>countries.find(entry=>entry.country_code===code);
      const ua=feeds.UA,pl=feeds.PL;
      const cov={UA:{speed_cameras:ua?.count??ua?.cameras?.length??coverageFor('UA')?.speed_cameras??0},PL:pl?.counts||coverageFor('PL')||{}};
      const dates = catalogTimestamps({
        source: result.source,
        generatedAt: result.generatedAt,
        previousPublishedAt: catalogRef.current.publishedAt,
        previousCheckedAt: catalogRef.current.checkedAt,
        now: new Date().toISOString(),
      });
      catalogRef.current = { publishedAt: dates.publishedAt, checkedAt: dates.checkedAt };
      await saveCameraCache(AsyncStorage,REMOTE_CACHE_KEY,{feeds,countries,cov,stamp:dates.stamp,publishedAt:dates.publishedAt,checkedAt:dates.checkedAt,countryVersions},country);
      remoteFeedsRef.current=feeds;countryVersionsRef.current=countryVersions;bgCameraFeeds=feeds;
      setRemoteFeeds(feeds);setCountryCoverage(countries);setCoverage(cov);
      setPublishedAt(dates.publishedAt);setCheckedAt(dates.checkedAt);setOfflineCountryCodes(storedCountryCodes(feeds));
      setDatabaseErrors(previous=>({...previous,[country]:false}));
      if (!silent) Alert.alert(result.source === "r2" ? t.updated : t.databaseCurrent);
      return true;
    } catch {
      setDatabaseErrors(previous=>({...previous,[country]:true}));
      if (!silent) databaseMessage("error");
      return false;
    } finally {
      databaseBusy.current = false;
      setCountryLoading(null);
    }
  }

  function confirmRemoveDatabase(code) {
    if (databaseBusy.current || !databaseReady.current) {databaseMessage("busy");return;}
    if (code === selectedCountry && (active || backgroundEnabled)) {databaseMessage("active");return;}
    const label = ({ru:"Удалить базу",uk:"Видалити базу",en:"Delete database",pl:"Usuń bazę"})[settings.language] || "Delete database";
    Alert.alert(label, `${countryFlag(code)} ${countryDisplayName(code,settings.language)}`, [
      {text:({ru:"Отмена",uk:"Скасувати",en:"Cancel",pl:"Anuluj"})[settings.language] || "Cancel",style:"cancel"},
      {text:label,style:"destructive",onPress:async () => {
        if (databaseBusy.current) {databaseMessage("busy");return;}
        if (code === selectedCountry && (active || backgroundEnabled)) {databaseMessage("active");return;}
        databaseBusy.current=true;setCountryLoading(code);
        try {
          const feeds={...remoteFeedsRef.current,[code]:{country:code,cameras:[],_removed:true}};
          const countryVersions={...countryVersionsRef.current};delete countryVersions[code];
          await saveCameraCache(AsyncStorage,REMOTE_CACHE_KEY,{feeds,countries:countryCoverage,cov:coverage,stamp:catalogRef.current.publishedAt,publishedAt:catalogRef.current.publishedAt,checkedAt:catalogRef.current.checkedAt,countryVersions},selectedCountry);
          remoteFeedsRef.current=feeds;countryVersionsRef.current=countryVersions;bgCameraFeeds=feeds;
          setRemoteFeeds(feeds);setOfflineCountryCodes(storedCountryCodes(feeds));
          if (code===selectedCountry) {setNearest(null);setAhead(null);}
        } catch {databaseMessage("error");}
        finally {databaseBusy.current=false;setCountryLoading(null);}
      }},
    ]);
  }

  async function sendReportToServer(item) {
    try {
      const res = await fetch(REPORT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error("report failed");
      const out = await res.json();
      return !!out.ok;
    } catch {
      return false;
    }
  }

  async function saveHistory(item) {
    const next = [item, ...history].slice(0, 100);
    setHistory(next);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  async function saveReports(next) {
    setReports(next);
    await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(next));
  }

  async function addHidden(id) {
    const next = Array.from(new Set([...hiddenIds.map(String), String(id)]));
    setHiddenIds(next);
    bgHiddenIds = new Set(next);
    await AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
  }

  function speakWarning(cam, threshold, currentSpeedKmh, currentSpeedAvailable) {
    const decision = cameraAlertDecision(bgSettings, cam);
    if (!decision.emit) return;
    if (!cam || cam.distance > threshold) return;
    const last = lastSpoken.current;
    if (last.id === cam.id && last.distance - cam.distance < 250) return;

    const over = isSpeedOverLimit(currentSpeedKmh, currentSpeedAvailable, cam.speed_limit);
    presentCameraAlert(cam, currentSpeedKmh, currentSpeedAvailable);
    if (decision.vibration) {
      Vibration.vibrate(over ? [0, 250, 120, 250] : [0, 250]);
      Haptics.notificationAsync(over ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success).catch(()=>{});
    }
    if (decision.voice) {
      const message = cameraAlertCopy(settings.language, cam, currentSpeedKmh, currentSpeedAvailable);
      Speech.stop();
      Speech.speak(message.speech, { language: message.locale, rate: 0.95 });
    }
    lastSpoken.current = { id: cam.id, distance: cam.distance };
    saveHistory({
      id: `${Date.now()}-${cam.id}`,
      cameraId: cam.id,
      when: new Date().toISOString(),
      distance: cam.distance,
      speed: speedKmh,
      limit: cam.speed_limit,
      location: cam.location || cam.road_index || cam.region,
    });
  }

  async function startTracking() {
    traceTrip("startTracking", "enter");
    try {
    const fg = await Location.requestForegroundPermissionsAsync();
    setLocationPermissionStatus(fg.status);
    if (fg.status !== "granted") {
      setGpsFixReceived(false);
      Alert.alert("GPS", "Разреши приложению использовать местоположение.");
      return;
    }
    // Always is optional. Foreground GPS, sound, the map, and the catalog keep working.
    const backgroundPermission = await Location.getBackgroundPermissionsAsync().catch(() => null);
    if (backgroundPermission?.granted) await startBackgroundSession({ quiet: true });
    else if (shouldShowBackgroundGuide({ backgroundGranted: false, postponed: postponedRef.current })) {
      setGuideReturned(false);
      setBackgroundGuide(true);
    }
    if (sub.current) sub.current.remove();
    setGpsFixReceived(false);
    setSpeedAvailable(false);
    sub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 5 },
      pos => {
        traceTrip("gps", "enter");
        try {
        if (AppState.currentState !== "active") return;
        const { latitude, longitude, speed: rs, heading: rh } = pos.coords;
        const kmh = typeof rs === "number" && rs >= 0 ? Math.round(rs * 3.6) : 0;
        const h = typeof rh === "number" && rh >= 0 ? norm(rh) : null;
        setCoords({ latitude, longitude });
        setSpeedKmh(kmh);
        setSpeedAvailable(typeof rs === "number" && Number.isFinite(rs) && rs >= 0);
        setHeading(h);
        setGpsFixReceived(true);

        bgHiddenIds = new Set(hiddenIds.map(String));

        if (!cameraWarningsEnabled(bgSettings)) {
          polandVisualAlertCameraId.current = null;
          plSectionIdRef.current = null;
          sectionPaceRef.current = null;
          plLastSectionState.current = null;
          if (averageSectionUiRef.current) {
            averageSectionUiRef.current = null;
            setAverageSectionUi(null);
          }
          setNearest(null);
          setAhead(null);
          return;
        }

        if (selectedCountry !== "UA") {
          const point =
            kmh >= MIN_MOVING_SPEED_KMH && h != null
              ? nearestPolandPoint(activeCountryFeedRef.current, latitude, longitude, h, 5000)
              : null;

          setNearest(point);
          setAhead(point);

          if (point) {
            const threshold = alertDistanceForSpeed(kmh, settings);
            if (point.distance <= threshold && polandVisualAlertCameraId.current !== String(point.id)) {
              presentCameraAlert(point, kmh, typeof rs === "number" && Number.isFinite(rs) && rs >= 0);
              polandVisualAlertCameraId.current = String(point.id);
            }

            if (point.distance <= threshold && settings.voice) {
              const rounded = Math.max(100, Math.round(point.distance / 100) * 100);

              const kind =
                point.type === "red_light"
                  ? "Kontrola czerwonego światła"
                  : point.type === "checkpoint"
                  ? "Punkt kontroli"
                  : "Fotoradar";

              Speech.stop();

              Speech.speak(
                settings.language === "pl"
                  ? `${kind} za ${rounded} metrów.${point.speed_limit ? ` Ograniczenie ${point.speed_limit}.` : ""}`
                  : settings.language === "uk"
                  ? `Камера попереду через ${rounded} метрів.${point.speed_limit ? ` Обмеження ${point.speed_limit}.` : ""}`
                  : settings.language === "en"
                  ? `Camera ahead in ${rounded} meters.${point.speed_limit ? ` Speed limit ${point.speed_limit}.` : ""}`
                  : `Камера впереди через ${rounded} метров.${point.speed_limit ? ` Ограничение ${point.speed_limit}.` : ""}`,
                {
                  language:
                    settings.language === "pl"
                      ? "pl-PL"
                      : settings.language === "uk"
                      ? "uk-UA"
                      : settings.language === "en"
                      ? "en-US"
                      : "ru-RU",
                  rate: 0.95
                }
              );
            }
          }

          if (!point || point.distance > alertDistanceForSpeed(kmh, settings)) {
            polandVisualAlertCameraId.current = null;
          }

          const sectionEvent =
            h != null
              ? detectAverageSpeedSection(
                  activeCountryFeedRef.current,
                  latitude,
                  longitude,
                  h,
                  plSectionIdRef.current
                )
              : null;

          if (sectionEvent) {
            const sectionId = String(sectionEvent.section.id);
            if ((sectionEvent.state === "entering" || sectionEvent.state === "inside") && plSectionIdRef.current !== sectionId) {
              plSectionIdRef.current = sectionId;
              sectionPaceRef.current = null;
            }
            const onSection = sectionEvent.state === "inside" || sectionEvent.state === "ending";
            const measured = onSection ? measureSectionProgress(sectionEvent.section, latitude, longitude) : null;
            if (onSection || sectionEvent.state === "entering") {
              sectionPaceRef.current = advanceSectionPace(sectionPaceRef.current, { latitude, longitude }, Date.now());
            } else {
              sectionPaceRef.current = null;
            }
            if (sectionEvent.state === "ending") {
              plSectionIdRef.current = null;
            }
            const key = `${sectionEvent.section.id}:${sectionEvent.state}`;
            const sectionUi = {
              state: sectionEvent.state,
              distance: sectionEvent.distance,
              remaining: measured?.remaining ?? null,
              progress: measured?.progress ?? null,
              length: measured?.length ?? null,
              averageKmh: onSection ? sectionPaceRef.current?.averageKmh ?? null : null,
              speedLimit: sectionEvent.section.speed_limit,
              name: sectionEvent.section.name,
              start: sectionEvent.section.start, end: sectionEvent.section.end,
            };
            setAverageSectionUi(sectionUi);
            averageSectionUiRef.current = sectionUi;
            if (averageSectionEndTimer.current) clearTimeout(averageSectionEndTimer.current);
            if (sectionEvent.state === "ending") {
              averageSectionEndTimer.current = setTimeout(() => {
                averageSectionUiRef.current = null;
                setAverageSectionUi(null);
              }, 6000);
            }

            if (plLastSectionState.current !== key) {
              plLastSectionState.current = key;

              const phrase = averageSectionSpeech(
                sectionEvent,
                settings.language
              );

              if (phrase && settings.voice) {
                Speech.stop();

                Speech.speak(phrase, {
                  language:
                    settings.language === "pl"
                      ? "pl-PL"
                      : settings.language === "uk"
                      ? "uk-UA"
                      : settings.language === "en"
                      ? "en-US"
                      : "ru-RU",
                  rate: 0.95
                });
              }
            }
          } else if (plSectionIdRef.current == null) {
            plLastSectionState.current = null;
            if (averageSectionUiRef.current?.state !== "ending") {
              averageSectionUiRef.current = null;
              setAverageSectionUi(null);
            }
          }

          return;
        }

        const n = findNearestAny(latitude, longitude);
        setNearest(n);

        const a =
          kmh >= MIN_MOVING_SPEED_KMH && h != null
            ? findNearestAhead(latitude, longitude, h)
            : null;

        setAhead(a);

        if (a) {
          speakWarning(a, alertDistanceForSpeed(kmh, settings), kmh, typeof rs === "number" && Number.isFinite(rs) && rs >= 0);
        }
        } finally {
          traceTrip("gps", "exit");
        }
      }
    );
    foregroundTripRunning = true;
    setActive(true);
    return true;
    } finally {
      traceTrip("startTracking", "exit");
    }
  }

  function stopTracking() {
    traceTrip("endTrip", "enter");
    try {
    setRouteGuidance(null);
    setManeuver(null);
    foregroundTripRunning = false;
    stopBackground().catch(error => Alert.alert("Фоновый режим", error.message));
    if (sub.current) { sub.current.remove(); sub.current = null; }
    Speech.stop();
    dismissCameraAlert();
    polandVisualAlertCameraId.current = null;
    plSectionIdRef.current = null;
    sectionPaceRef.current = null;
    if (averageSectionEndTimer.current) clearTimeout(averageSectionEndTimer.current);
    averageSectionUiRef.current = null;
    setActive(false); setAhead(null); setHeading(null); setGpsFixReceived(false); setSpeedAvailable(false); setAverageSectionUi(null);
    } catch (error) {
      traceTrip("error", "error");
      console.log("[trip-diag] error endTrip", error && (error.message || String(error)));
      throw error;
    } finally {
      traceTrip("endTrip", "exit");
    }
  }

  const backgroundBusy = useRef(false);
  async function stopBackground() {
    await backgroundQueue.catch(()=>{});
    await AsyncStorage.removeItem(BACKGROUND_SESSION_KEY);
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
    setBackgroundEnabled(false);
  }

  async function readLocationAccess() {
    const [foreground, background] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
    ]);
    const access = describeLocationAccess({ foreground, background });
    setBackgroundAccess(access);
    return access;
  }

  async function postponeBackgroundGuide() {
    postponedRef.current = true;
    pendingBackgroundRef.current = false;
    setGuideReturned(false);
    setBackgroundGuide(false);
    await AsyncStorage.setItem(BACKGROUND_GUIDE_KEY, "1").catch(() => {});
  }

  async function openBackgroundSettings() {
    pendingBackgroundRef.current = true;
    try {
      if (Platform.OS === "android") {
        const asked = await Location.requestBackgroundPermissionsAsync();
        const access = await readLocationAccess();
        if (access === "always") {
          pendingBackgroundRef.current = false;
          setGuideReturned(false);
          setBackgroundGuide(false);
          await startBackgroundSession();
          return;
        }
        if (asked.canAskAgain === false) {
          await Linking.openSettings();
          return;
        }
        pendingBackgroundRef.current = false;
        setGuideReturned(true);
        setBackgroundGuide(true);
        return;
      }
      await Linking.openSettings();
    } catch {
      pendingBackgroundRef.current = false;
      setGuideReturned(true);
      setBackgroundGuide(true);
    }
  }

  async function startBackgroundSession({ quiet = false } = {}) {
    if (backgroundBusy.current) return false;
    backgroundBusy.current = true;
    const failure = backgroundFailureCopy(settings.language);
    try {
      if (!databaseReady.current || !storedCountryCodes(remoteFeedsRef.current).includes(selectedCountry) ||
          !cameraPoints(countryFeed(remoteFeedsRef.current,selectedCountry,data,plData)).length) {
        throw new Error(failure.database);
      }
      if (!(await Location.hasServicesEnabledAsync())) throw new Error(failure.services);
      if (!(await TaskManager.isAvailableAsync())) throw new Error(failure.task);
      let fg = await Location.getForegroundPermissionsAsync();
      if (!fg.granted) fg = await Location.requestForegroundPermissionsAsync();
      if (!fg.granted) throw new Error(failure.foreground);
      if (Platform.OS === "android") {
        for (const sound of [true,false]) for (const vibration of [true,false]) {
          await Notifications.setNotificationChannelAsync(`camera-alerts-${sound ? "sound" : "silent"}-${vibration ? "vibrate" : "still"}`, {
            name:`Камеры · ${sound ? "звук" : "без звука"} · ${vibration ? "вибрация" : "без вибрации"}`,
            importance:Notifications.AndroidImportance.HIGH, sound:sound ? "default" : null,
            enableVibrate:vibration, vibrationPattern:vibration ? [0,250] : [0],
          });
        }
      }
      let notifications = await Notifications.getPermissionsAsync();
      if (!notifications.granted) notifications = await Notifications.requestPermissionsAsync();
      if (!notifications.granted) throw new Error(failure.notifications);
      const bg = await Location.getBackgroundPermissionsAsync();
      if (!bg.granted) return false;
      if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
        if (!(await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK))) throw new Error(failure.start);
        await AsyncStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));
        await AsyncStorage.setItem(BACKGROUND_SESSION_KEY,JSON.stringify({enabled:true,country:selectedCountry}));
        setBackgroundEnabled(true);
        return true;
      }
      await AsyncStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));
      await AsyncStorage.setItem(BACKGROUND_SESSION_KEY,JSON.stringify({enabled:true,country:selectedCountry}));
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy:Location.Accuracy.BestForNavigation, distanceInterval:20, timeInterval:2000,
        deferredUpdatesDistance:20, activityType:Location.ActivityType.AutomotiveNavigation,
        pausesUpdatesAutomatically:false, showsBackgroundLocationIndicator:true,
        ...(Platform.OS === "android" ? {foregroundService:{notificationTitle:"CamAlert · Фоновая сессия",
          notificationBody:"Предупреждения о камерах. Остановить: CamAlert → Настройки.",notificationColor:"#23D3EF",killServiceOnDestroy:true}} : {}),
      });
      if (!(await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) ||
          !(await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK))) throw new Error(failure.start);
      setBackgroundEnabled(true);
      return true;
    } catch(error) {
      await stopBackground().catch(()=>{});
      if (!quiet) {
        Alert.alert(failure.title, error.message || failure.start, [
          {text:failure.close, style:"cancel"},
          {text:failure.openSettings, onPress:() => Linking.openSettings()},
        ]);
      }
      return false;
    } finally {backgroundBusy.current=false;}
  }

  async function requestBackground() {
    let foreground = await Location.getForegroundPermissionsAsync();
    if (!foreground.granted && foreground.canAskAgain !== false) {
      foreground = await Location.requestForegroundPermissionsAsync();
      setLocationPermissionStatus(foreground.status);
    }
    const access = await readLocationAccess();
    if (access === "always") return startBackgroundSession();
    if (!shouldShowBackgroundGuide({ backgroundGranted: false, postponed: postponedRef.current })) return false;
    setGuideReturned(false);
    setBackgroundGuide(true);
    return false;
  }

  async function toggleBackground() {
    if (backgroundBusy.current) return;
    if (backgroundEnabled) {
      try {await stopBackground();} catch(error) {Alert.alert(backgroundFailureCopy(settings.language).title, error.message);}
    } else await requestBackground();
  }

  onAppActiveRef.current = async () => {
    const access = await readLocationAccess().catch(() => null);
    if (!access) return;
    if (access === "always") {
      postponedRef.current = false;
      await AsyncStorage.removeItem(BACKGROUND_GUIDE_KEY).catch(() => {});
      setGuideReturned(false);
      setBackgroundGuide(false);
      if (pendingBackgroundRef.current && !backgroundEnabledRef.current) {
        pendingBackgroundRef.current = false;
        await startBackgroundSession();
      } else pendingBackgroundRef.current = false;
      return;
    }
    if (backgroundEnabledRef.current) await stopBackground().catch(() => {});
    if (pendingBackgroundRef.current) {
      pendingBackgroundRef.current = false;
      setGuideReturned(true);
      setBackgroundGuide(true);
    }
  };

  useEffect(() => {
    if (tab !== "nearby" || active) return;
    let cancelled = false;
    let timer;
    setNearbyStatus("loading");
    async function locate() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (permission.status !== "granted") {
          setNearbyPosition(null);
          setNearbyStatus("denied");
          return;
        }
        const position = await Promise.race([
          Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Balanced}),
          new Promise((_, reject) => {timer = setTimeout(() => reject(new Error("GPS timeout")), 20000);}),
        ]);
        if (!cancelled) {
          setNearbyPosition({latitude:position.coords.latitude,longitude:position.coords.longitude});
          setNearbyStatus("ready");
        }
      } catch (_) {
        if (!cancelled) setNearbyStatus("error");
      } finally {clearTimeout(timer);}
    }
    locate();
    return () => {cancelled = true;clearTimeout(timer);};
  }, [tab, active, nearbyRefresh]);

  const nearbyOrigin = active ? coords : nearbyPosition;
  const nearbyCopy = ({
    ru: {title:"Камеры рядом",loading:"Определяем местоположение…",denied:"Разрешите доступ к геолокации в настройках телефона, чтобы увидеть ближайшие камеры.",error:"Не удалось получить GPS. Проверьте геолокацию и повторите попытку.",retry:"Обновить местоположение",empty:"В базе выбранной страны нет доступных камер.",settings:"Открыть настройки",waiting:"Ожидаем местоположение",previous:"Показаны расстояния от последней полученной позиции."},
    uk: {title:"Камери поруч",loading:"Визначаємо місцеположення…",denied:"Дозвольте геолокацію в налаштуваннях телефона, щоб побачити найближчі камери.",error:"Не вдалося отримати GPS. Перевірте геолокацію та повторіть спробу.",retry:"Оновити місцеположення",empty:"У базі вибраної країни немає доступних камер.",settings:"Відкрити налаштування",waiting:"Очікуємо місцеположення",previous:"Відстані від останньої отриманої позиції."},
    en: {title:"Nearby cameras",loading:"Finding your location…",denied:"Allow location access in phone settings to see nearby cameras.",error:"Could not get GPS. Check location services and try again.",retry:"Refresh location",empty:"No cameras available in the selected country database.",settings:"Open settings",waiting:"Waiting for location",previous:"Distances use your last received position."},
    pl: {title:"Kamery w pobliżu",loading:"Ustalanie lokalizacji…",denied:"Zezwól na lokalizację w ustawieniach telefonu, aby zobaczyć pobliskie kamery.",error:"Nie udało się uzyskać GPS. Sprawdź lokalizację i spróbuj ponownie.",retry:"Odśwież lokalizację",empty:"Brak kamer w bazie wybranego kraju.",settings:"Otwórz ustawienia",waiting:"Oczekiwanie na lokalizację",previous:"Odległości od ostatniej otrzymanej pozycji."},
  })[settings.language] || {title:"Nearby cameras",loading:"Finding location…",denied:"Allow location in phone settings.",error:"GPS unavailable. Try again.",retry:"Refresh location",empty:"No cameras available.",settings:"Open settings",waiting:"Waiting for location",previous:"Using last received position."};

  function nearbyList() {
    if (!nearbyOrigin) return [];
    return visibleCameras()
      .filter(c => c.latitude != null && c.longitude != null && Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude)))
      .filter(c => (nearbyType === "all" || cameraKind(c) === nearbyType) && (nearbyLimit === "all" || (nearbyLimit === "unknown" ? c.speed_limit == null : Number(c.speed_limit) === Number(nearbyLimit))))
      .map(c => ({...c, distance: Math.round(distanceMeters(nearbyOrigin.latitude, nearbyOrigin.longitude, Number(c.latitude), Number(c.longitude)))}))
      .sort((a,b)=>a.distance-b.distance)
      .slice(0,20);
  }

  async function reportNewCamera() {
    if(active && (!speedAvailable || speedKmh>0)) { Alert.alert("CamAlert",ui.stop); return; }
    if (!coords) {
      Alert.alert("GPS", "Сначала включи поездку, чтобы приложение знало координаты.");
      return;
    }
    const item = {
      id: `new-${Date.now()}`,
      type: "new",
      latitude: coords.latitude,
      longitude: coords.longitude,
      note: reportNote,
      createdAt: new Date().toISOString(),
      status: "local",
    };
    await saveReports([item, ...reports]);
    setReportNote("");
    setModal(null);

    const sent = await sendReportToServer(item);

    Alert.alert(
      t.saved,
      sent ? t.reportSent : t.reportFailed
    );
  }

  async function reportRemovedCamera(cam) {
    if(active && (!speedAvailable || speedKmh>0)) { Alert.alert("CamAlert",ui.stop); return; }
    if (!cam) return;
    const item = {
      id: `removed-${Date.now()}`,
      type: "removed",
      cameraId: cam.id,
      location: cam.location || cam.road_index || cam.region,
      createdAt: new Date().toISOString(),
      status: "local",
    };
    await saveReports([item, ...reports]);
    await addHidden(cam.id);
    setNearest(null);
    setAhead(null);
    setModal(null);

    const sent = await sendReportToServer(item);

    Alert.alert(
      t.saved,
      sent ? t.reportSent : t.reportFailed
    );
  }

  const shownCam = ahead || nearest;
  const shownDistance = ahead?.distance ?? nearest?.distance;
  const currentThreshold = alertDistanceForSpeed(speedKmh, settings);
  const danger = shownDistance != null && shownDistance <= currentThreshold && !!ahead;

  function presentCameraAlert(cam, currentSpeedKmh, currentSpeedAvailable) {
    if (!cam) return;
    if (cameraAlertDismissTimer.current) clearTimeout(cameraAlertDismissTimer.current);
    setCameraAlertPresentation({
      cameraId: String(cam.id),
      distance: Number(cam.distance),
      speedKmh: Number(currentSpeedKmh),
      speedAvailable: !!currentSpeedAvailable,
    });
    cameraAlertDismissTimer.current = setTimeout(() => {
      setCameraAlertPresentation(null);
      cameraAlertDismissTimer.current = null;
    }, CAMERA_ALERT_OVERLAY_MS);
  }

  function dismissCameraAlert() {
    if (cameraAlertDismissTimer.current) clearTimeout(cameraAlertDismissTimer.current);
    cameraAlertDismissTimer.current = null;
    setCameraAlertPresentation(null);
  }

  useEffect(() => {
    traceTrip("warningsEffect", "enter");
    try {
    if (cameraWarningsEnabled(settings)) return;
    Speech.stop();
    dismissCameraAlert();
    polandVisualAlertCameraId.current = null;
    plSectionIdRef.current = null;
    sectionPaceRef.current = null;
    plLastSectionState.current = null;
    if (averageSectionEndTimer.current) clearTimeout(averageSectionEndTimer.current);
    averageSectionUiRef.current = null;
    setAverageSectionUi(null);
    setNearest(null);
    setAhead(null);
    } finally {
      traceTrip("warningsEffect", "exit");
    }
  }, [settings.cameraWarnings]);

  function openNavigatorPicker() {
    setNavigatorDestination("");
    setModal("navigator");
  }

  function endRouteOnly() {
    setRouteGuidance(null);
    setManeuver(null);
  }

  function openInAppRoute() {
    if (Platform.OS !== "ios") return;
    setModal(null);
    setIosRouteOpen(true);
  }

  async function startRouteGuidance(packed) {
    if (!packed?.polyline || packed.polyline.length < 2) return false;
    setRouteGuidance(packed);
    setIosRouteOpen(false);
    setTab("drive");
    // The running trip already owns watchPositionAsync. Calling startTracking
    // again removes that watch and starts a second GPS session.
    if (foregroundTripRunning || sub.current) return true;
    try {
      const started = await startTracking();
      if (!started) {
        setRouteGuidance(null);
        setManeuver(null);
        return false;
      }
      return true;
    } catch (error) {
      setRouteGuidance(null);
      setManeuver(null);
      throw error;
    }
  }

  async function launchNavigator(navigator, destination) {
    if (navigator === "inapp") {
      if (Platform.OS !== "ios") return;
      setModal(null);
      setIosRouteOpen(true);
      return;
    }
    if (navigator === "google" && Platform.OS === "android") {
      setNavigatorDestination(destination || "");
      setModal(null);
      setGoogleNavigationOpen(true);
      return;
    }
    let links;
    try {
      links = buildNavigatorLinks(navigator, destination, Platform.OS);
    } catch (error) {
      Alert.alert("Не удалось построить маршрут", error.message || "Проверьте пункт назначения.");
      return;
    }

    const backgroundPermission = await Location.getBackgroundPermissionsAsync().catch(() => null);
    if (!backgroundPermission?.granted) {
      setModal(null);
      setGuideReturned(false);
      setBackgroundGuide(true);
      return;
    }
    if (!(await startBackgroundSession())) return;
    setModal(null);
    let installed = false;
    try { installed = await Linking.canOpenURL(links.appUrl); } catch (_) {}
    let failedToOpenInstalledApp = false;
    if (installed) {
      try {
        await Linking.openURL(links.appUrl);
        return;
      } catch (_) { failedToOpenInstalledApp = true; }
    }

    const isApple = navigator === "apple";
    const storeUrl = navigator === "google"
      ? Platform.OS === "ios"
        ? "https://apps.apple.com/app/google-maps/id585027354"
        : "https://play.google.com/store/apps/details?id=com.google.android.apps.maps"
      : links.webUrl;
    const appName = navigator === "apple" ? "Apple Maps" : "Google Maps";
    const openWebsite = async () => {
      try { await Linking.openURL(links.webUrl); }
      catch (_) { Alert.alert("Ссылка недоступна", "Не удалось открыть сайт навигатора на этом устройстве."); }
    };
    const openStore = async () => {
      try { await Linking.openURL(storeUrl); }
      catch (_) { await openWebsite(); }
    };

    Alert.alert(
      isApple ? "Apple Maps недоступны" : failedToOpenInstalledApp ? `Не удалось открыть ${appName}` : `${appName} не установлен`,
      isApple ? "Откройте карты в браузере." : failedToOpenInstalledApp ? "Попробуйте открыть сайт или страницу приложения." : "Откройте сайт навигатора или перейдите к установке приложения.",
      [
        { text: "Открыть сайт", onPress: openWebsite },
        ...(!isApple ? [{ text: "Установить", onPress: openStore }] : []),
        { text: "Отмена", style: "cancel" },
      ]
    );
  }

  useEffect(() => () => {
    if (cameraAlertDismissTimer.current) clearTimeout(cameraAlertDismissTimer.current);
  }, []);

  useEffect(() => {
    if (!active || !gpsFixReceived || !ahead || !danger) dismissCameraAlert();
  }, [active, gpsFixReceived, ahead?.id, danger]);

  const nav = [
    ["drive","🚗","Поездка"], ["map","🗺️",t.map], ["nearby","📍",t.nearby], ["settings","⚙️",t.settings]
  ];

  async function finishOnboarding() {
    await AsyncStorage.setItem(ONBOARDING_KEY, "done").catch(() => {});
    setOnboardingState("done");
  }

  async function continueFromOnboarding() {
    try {
      // Informational welcome pages never read location or start a trip.
      // Request permission only after Continue on the final page.
      const permission = await Location.requestForegroundPermissionsAsync();
      setLocationPermissionStatus(permission.status);
    } catch (_) {}
    await finishOnboarding();
  }

  function renderBackgroundGuide() {
    if (!backgroundGuide) return null;
    const copy = backgroundGuideCopy(settings.language, Platform.OS);
    return (
      <View style={[StyleSheet.absoluteFill, s.modalShade]}>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.later} onPress={postponeBackgroundGuide} style={StyleSheet.absoluteFill} />
          <View style={[s.guideCard, {maxHeight: Math.max(240, Math.min(windowHeight * 0.62, 460))}]}>
            <ScrollView contentContainerStyle={s.guideScroll} bounces={false}>
              <PageBackButton language={settings.language} onPress={postponeBackgroundGuide} onLight />
              <Text maxFontSizeMultiplier={1.5} style={s.guideTitle}>{copy.title}</Text>
              {guideReturned
                ? <Text maxFontSizeMultiplier={1.6} style={s.guideState}>{backgroundAccessMessage(settings.language, backgroundAccess)}</Text>
                : <>
                    <Text maxFontSizeMultiplier={1.6} style={s.guideBody}>{copy.body}</Text>
                    {copy.steps.map(step => <Text key={step} maxFontSizeMultiplier={1.6} style={s.guideStep}>{step}</Text>)}
                  </>}
              <Pressable accessibilityRole="button" onPress={openBackgroundSettings} style={s.guideButton}>
                <Text maxFontSizeMultiplier={1.4} style={s.guideButtonText}>{copy.openSettings}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={postponeBackgroundGuide} style={s.guideLater}>
                <Text maxFontSizeMultiplier={1.4} style={s.guideLaterText}>{copy.later}</Text>
              </Pressable>
            </ScrollView>
          </View>
      </View>
    );
  }

  if (onboardingState !== "done") {
    if (onboardingState === "loading") {
      return <View style={{flex:1,backgroundColor:"#071525"}}><StatusBar style="light" /></View>;
    }
    return (
      <WelcomeScreen
        language={settings.language}
        page={onboardingPage}
        onNext={() => onboardingPage < 2 ? setOnboardingPage(onboardingPage + 1) : continueFromOnboarding()}
        onBack={() => onboardingPage > 0 ? setOnboardingPage(onboardingPage - 1) : finishOnboarding()}
        onSkip={finishOnboarding}
      />
    );
  }

  if (iosRouteOpen) {
    return <>
      <IosRouteScreen
        language={settings.language}
        night={isNight}
        initialQuery={navigatorDestination}
        coords={coords}
        onClose={() => setIosRouteOpen(false)}
        onStartGuidance={startRouteGuidance}
        onOpenApple={(place) => {
          setIosRouteOpen(false);
          return launchNavigator("apple", `${place.latitude},${place.longitude}`);
        }}
        onOpenGoogle={(place) => {
          setIosRouteOpen(false);
          return launchNavigator("google", `${place.latitude},${place.longitude}`);
        }}
      />
      {renderBackgroundGuide()}
    </>;
  }

  if (googleNavigationOpen) {
    return <>
      <GoogleNavigationScreen
        language={settings.language} initialDestination={navigatorDestination}
        coords={coords} night={isNight} voiceEnabled={settings.voice} mapStyle={NIGHT_MAP_STYLE}
        camera={cameraWarningsEnabled(settings) ? ahead : null} gpsFixReceived={gpsFixReceived} speedKmh={speedKmh} speedAvailable={speedAvailable}
        averageSection={cameraWarningsEnabled(settings) ? averageSectionUi : null}
        onStartTrip={async () => {
          if (active) return true;
          if (!databaseReady.current || !storedCountryCodes(remoteFeedsRef.current).includes(selectedCountry) || !cameraPoints(countryFeed(remoteFeedsRef.current, selectedCountry, data, plData)).length) {
            Alert.alert("CamAlert", settings.language === "ru" ? "Сначала загрузите базу камер выбранной страны." : settings.language === "uk" ? "Спочатку завантажте базу камер вибраної країни." : settings.language === "pl" ? "Najpierw pobierz bazę kamer wybranego kraju." : "Download the selected country's camera database first.");
            return false;
          }
          return !!(await startTracking());
        }}
        onClose={() => { setGoogleNavigationOpen(false); setTab("drive"); }}
      />
      {renderBackgroundGuide()}
    </>;
  }

  if (tab === "drive" && active) {
    return (
      <>
      <DriveModeScreen
        theme={resolvedTheme}
        language={settings.language}
        coords={coords}
        gpsFixReceived={gpsFixReceived}
        locationPermissionStatus={locationPermissionStatus}
        speedKmh={speedKmh}
        speedAvailable={speedAvailable}
        heading={heading}
        camera={cameraWarningsEnabled(settings) ? ahead : null}
        currentThreshold={currentThreshold}
        danger={cameraWarningsEnabled(settings) && danger}
        warningsEnabled={cameraWarningsEnabled(settings)}
        voiceEnabled={cameraWarningsEnabled(settings) && settings.voice}
        vibrationEnabled={cameraWarningsEnabled(settings) && settings.vibration}
        backgroundEnabled={backgroundEnabled}
        averageSection={averageSectionUi}
        warningPresentation={cameraAlertPresentation}
        onDismissWarning={dismissCameraAlert}
        onRetry={startTracking}
        onStop={stopTracking}
        routePolyline={routeGuidance?.polyline || null}
        routeCameras={routeMapCameras}
        routeZoom={routeGuidance ? guidanceZoom(speedKmh) : null}
        maneuver={routeGuidance && maneuver ? {
          distanceLabel: formatDistance(settings.language, maneuver.distanceMeters),
          instruction: maneuver.instruction,
          remainingLabel: formatDistance(settings.language, maneuver.remainingMeters),
          arrivalLabel: formatArrivalTime(settings.language, maneuver.etaSeconds),
        } : null}
        onEndRoute={routeGuidance ? endRouteOnly : null}
        onOpenRoute={Platform.OS === "ios" ? openInAppRoute : null}
        databaseStatus={`${countryFlag(selectedCountry)} ${countryDisplayName(selectedCountry,settings.language)} · ${countryLoading===selectedCountry?({ru:"↻ Обновление",uk:"↻ Оновлення",en:"↻ Updating",pl:"↻ Aktualizacja"})[settings.language]:databaseErrors[selectedCountry]?"⚠":"✓"} ${offlineCountryCodes.includes(selectedCountry)?({ru:"База на устройстве",uk:"База на пристрої",en:"Database on device",pl:"Baza na urządzeniu"})[settings.language]:"—"}${databaseErrors[selectedCountry]?" · "+({ru:"Обновить не удалось",uk:"Не вдалося оновити",en:"Update failed",pl:"Aktualizacja nieudana"})[settings.language]:""}`}
        onSettings={() => {setCountryScreenTab("settings");setTab("settings");}}
      />
      {renderBackgroundGuide()}
      </>
    );
  }

  return (
    <ThemeContext.Provider value={isNight}>
    <SystemSafeArea style={s.safe}>
      <StatusBar style={isNight ? "light" : "dark"} />


      <ScrollView style={{flex:1}} contentContainerStyle={[s.container, pad && { paddingHorizontal: 28, paddingBottom: 28, gap: 18 }, pad && tab === "drive" && !active && { flexGrow: 1 }]}>
        {tab === "drive" && !active && (
          <DriveHome
            language={settings.language}
            country={selectedCountry}
            lastDataUpdate={publishedAt || checkedAt}
            cameraCount={cameraPoints(countryFeed(remoteFeeds,selectedCountry,data,plData)).length}
            offlineAvailable={offlineCountryCodes.includes(selectedCountry)}
            onBack={() => {setOnboardingPage(2);setOnboardingState("new");}}
            onStart={startTracking}
            onOpenRoute={openInAppRoute}
            onChooseNavigator={openNavigatorPicker}
            onSettings={() => { setCountryScreenTab("settings"); setTab("settings"); }}
            onCountry={() => { setCountryScreenTab("countries"); setTab("settings"); }}
          />
        )}
        {!(tab === "drive" && !active) && <>
          <View style={s.screenHeader}>
            <PageBackButton language={settings.language} onPress={() => setTab("drive")} onLight={!isNight} />
          <Text maxFontSizeMultiplier={1.25} numberOfLines={2} style={[s.title, {flex:1}, pad && { fontSize: 40, lineHeight: 50 }]}>{tab === "settings" ? (settings.language === "uk" ? "Країни та дані" : settings.language === "en" ? "Countries and data" : settings.language === "pl" ? "Kraje i dane" : "Страны и данные") : tab === "nearby" ? nearbyCopy.title : tab === "history" ? ui.history : t.title}</Text>
          </View>
          {tab !== "settings" && <Text style={s.subtitle}>{countryFlag(selectedCountry)} {countryDisplayName(selectedCountry,settings.language)}{cameraWarningsEnabled(settings) ? ` · ${visibleCameras().length} камер` : ""}</Text>}
        </>}

        {tab === "drive" && active && <>
          <View style={[s.card, danger && s.cardDanger]}>
            <Text style={s.label}>{ahead ? t.ahead : active && speedKmh < MIN_MOVING_SPEED_KMH ? t.waitMove : t.nearest}</Text>
            {shownCam ? <>
              <Text style={s.distance}>{shownDistance >= 1000 ? `${(shownDistance/1000).toFixed(1)} км` : `${shownDistance} м`}</Text>
              <Text style={s.place}>{shownCam.location || shownCam.road_index || shownCam.region}</Text>
              <Text style={s.region}>{shownCam.region}</Text>
              <Text style={s.typeLabel}>{cameraTypeLabel(shownCam,settings.language)}</Text>
              {danger && <View style={s.warningBox}><Text style={s.warningText}>{t.aheadWarn}</Text><Text style={s.warningSub}>{currentThreshold} м</Text></View>}
              {shownCam.speed_limit != null && (
                <View style={s.limitRow}>
                  <View style={s.limitCircle}><Text style={s.limitText}>{shownCam.speed_limit}</Text></View>
                  <View><Text style={s.small}>{t.limit}</Text><Text style={s.value}>{shownCam.speed_limit} км/ч</Text></View>
                </View>
              )}
            </> : <Text style={s.empty}>{t.start}</Text>}
          </View>

          <View style={s.row}>
            <View style={s.stat}><Text style={s.small}>{t.speed}</Text><Text style={s.statValue}>{speedKmh}</Text><Text style={s.unit}>км/ч</Text></View>
            <View style={s.stat}><Text style={s.small}>{t.direction}</Text><Text style={s.heading}>{heading==null?t.waitMove:directionLabel(heading,settings.language)}</Text><Text style={s.unit}>{coords?t.gpsWorks:t.gpsWait}</Text></View>
          </View>

          <View style={s.backgroundCard}>
            <View style={{flex:1}}>
              <Text style={s.backgroundTitle}>{t.background}</Text>
              <Text style={s.backgroundText}>{backgroundEnabled?t.on:t.off}</Text>
            </View>
            <Pressable onPress={toggleBackground} style={[s.smallButton, backgroundEnabled&&s.smallButtonStop]}>
              <Text style={s.smallButtonText}>{backgroundEnabled?t.disable:t.enable}</Text>
            </Pressable>
          </View>

          <Pressable onPress={active?stopTracking:startTracking} style={[s.button,active&&s.stop]}>
            <Text style={s.buttonText}>{active?t.stop:t.start}</Text>
          </Pressable>

          <View style={s.row}>
            <Pressable onPress={()=>active && (!speedAvailable || speedKmh>0) ? Alert.alert("CamAlert",ui.stop) : setModal("new")} style={s.action}><Text style={s.actionText}>＋ {t.report}</Text></Pressable>
            <Pressable onPress={()=>active && (!speedAvailable || speedKmh>0) ? Alert.alert("CamAlert",ui.stop) : shownCam?setModal("removed"):null} style={s.action}><Text style={s.actionText}>− {t.removed}</Text></Pressable>
          </View>
        </>}

        {tab === "map" && cameraWarningsEnabled(settings) && <Pressable onPress={()=>setTab("cameras")} style={s.action}><Text style={s.actionText}>{ui.catalog} →</Text></Pressable>}
        {tab === "map" && cameraWarningsEnabled(settings) && <MapMarkerLegend night={isNight} labelStyle={s.note} items={["speed_camera","red_light","speed_and_red_light","average_speed","checkpoint"].map(type=>({type,label:cameraTypeLabel({type},settings.language)}))} />}
        {tab === "map" && !cameraWarningsEnabled(settings) && <Text style={s.note}>{(WARNING_UI[settings.language] || WARNING_UI.ru).offMap}</Text>}
        {tab === "map" && <BrowseMap
          key={selectedCountry}
          coords={coords}
          cameras={cameraPoints(countryFeed(remoteFeeds,selectedCountry,data,plData))}
          showCameras={cameraWarningsEnabled(settings)}
          showLocation={locationPermissionStatus === "granted"}
          currentThreshold={currentThreshold}
          active={active}
        />}

        {tab === "cameras" && <RoadCamerasScreen
          key={selectedCountry}
          country={selectedCountry}
          language={settings.language}
          feed={countryFeed(remoteFeeds,selectedCountry,data,plData)}
          showCameras={cameraWarningsEnabled(settings)}
          userCoords={coords}
          onCountries={() => {setCountryScreenTab("countries");setTab("settings");}}
        />}

        {tab === "nearby" && !cameraWarningsEnabled(settings) && (
          <View style={s.card}>
            <Text style={s.label}>{(WARNING_UI[settings.language] || WARNING_UI.ru).off}</Text>
            <Text style={s.note}>{(WARNING_UI[settings.language] || WARNING_UI.ru).offMap}</Text>
          </View>
        )}
        {tab === "nearby" && cameraWarningsEnabled(settings) && (
          <View style={s.list}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>{["all","speed_camera","red_light","speed_and_red_light","average_speed","checkpoint"].map(type=><FilterChip key={type} night={isNight} selected={nearbyType===type} onPress={()=>setNearbyType(type)}>{type==="all"?ui.all:`${cameraGlyph({type})} ${cameraTypeLabel({type},settings.language)}`}</FilterChip>)}</ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>{["all",...new Set(visibleCameras().map(c=>c.speed_limit).filter(v=>v!=null).map(Number).filter(Number.isFinite).sort((a,b)=>a-b)),"unknown"].map(limit=><FilterChip key={limit} night={isNight} selected={nearbyLimit===limit} onPress={()=>setNearbyLimit(limit)}>{limit==="all"?ui.all:limit==="unknown"?ui.unknown:`${limit} км/ч`}</FilterChip>)}</ScrollView>
            {nearbyOrigin && nearbyList().length===0 && <Text style={s.empty}>{ui.empty}</Text>}
            {nearbyList().map(cam => (
              <View key={String(cam.id)} style={s.listItem}>
                <View style={{flex:1}}>
                  <Text style={s.listTitle}>{cam.location || cam.road_index || cam.region}</Text>
                  <Text style={s.listSub}>{cameraGlyph(cam)} {cameraTypeLabel(cam,settings.language)} · {directionLabel(cam.direction,settings.language)}{cam.speed_limit != null ? ` · ${cam.speed_limit} км/ч` : ""}</Text>
                </View>
                <Text style={s.listDistance}>{cam.distance>=1000?`${(cam.distance/1000).toFixed(1)} км`:`${cam.distance} м`}</Text>
              </View>
            ))}
            {!active && nearbyStatus === "loading" && <View><ActivityIndicator /><Text style={s.empty}>{nearbyCopy.loading}</Text></View>}
            {!active && (nearbyStatus === "denied" || nearbyStatus === "error") && <Text style={s.empty}>{nearbyCopy[nearbyStatus]}</Text>}
            {!active && nearbyOrigin && nearbyStatus !== "ready" && <Text style={s.listSub}>{nearbyCopy.previous}</Text>}
            {active && !nearbyOrigin && <Text style={s.empty}>{nearbyCopy.waiting}</Text>}
            {nearbyOrigin && nearbyList().length === 0 && <Text style={s.empty}>{nearbyCopy.empty}</Text>}
            {!active && <Pressable accessibilityRole="button" disabled={nearbyStatus === "loading"} onPress={() => setNearbyRefresh(value => value+1)} style={[s.button,{opacity:nearbyStatus === "loading" ? 0.5 : 1}]}><Text style={s.buttonText}>{nearbyCopy.retry}</Text></Pressable>}
            {!active && nearbyStatus === "denied" && <Pressable accessibilityRole="button" onPress={() => Linking.openSettings().catch(() => {})} style={s.action}><Text style={s.actionText}>{nearbyCopy.settings}</Text></Pressable>}
          </View>
        )}

        {tab === "history" && (
          <View style={[s.list, pad && { flexDirection: "row", flexWrap: "wrap" }]}>
            {history.map(h => (
              <View key={h.id} style={[s.listItem, pad && { width: "48%", flexGrow: 1, padding: 20 }]}>
                <View style={{flex:1}}>
                  <Text style={[s.listTitle, pad && { fontSize: 18 }]}>{h.location}</Text>
                  <Text style={[s.listSub, pad && { fontSize: 15 }]}>{new Date(h.when).toLocaleString()} · {h.speed} км/ч</Text>
                </View>
                <Text style={[s.listDistance, pad && { fontSize: 18 }]}>{h.limit}</Text>
              </View>
            ))}
            {!history.length && <Text style={[s.empty, pad && { fontSize: 22, textAlign: "center", paddingVertical: 72 }]}>Предупреждений пока не было.</Text>}
          </View>
        )}

        {tab === "settings" && lawsOpen && (
          <LawsPage
            language={settings.language}
            night={isNight}
            query={lawsQuery}
            onQuery={setLawsQuery}
            onBack={() => setLawsOpen(false)}
          />
        )}

        {tab === "settings" && !lawsOpen && countryScreenTab === "countries" && (
          <View style={countriesStyles.screen}>
            <View style={countriesStyles.segment}>
              {[["countries",settings.language==="uk"?"Країни":settings.language==="en"?"Countries":settings.language==="pl"?"Kraje":"Страны"],["settings",t.settings]].map(([key,label])=>(
                <Pressable key={key} accessibilityRole="tab" accessibilityState={{selected:countryScreenTab===key}} onPress={()=>setCountryScreenTab(key)} style={[countriesStyles.segmentItem,countryScreenTab===key&&countriesStyles.segmentItemActive]}>
                  <Text style={[countriesStyles.segmentText,countryScreenTab===key&&countriesStyles.segmentTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <CountriesDataScreen
              language={settings.language}
              theme={resolvedTheme}
              countries={[...new Set(["UA","PL",...countryCoverage.map(item=>item.country_code)])]
                .map(code=>({code,name:countryDisplayName(code,settings.language),count:countryCameraCount(code,remoteFeeds,countryCoverage),
                  offline:offlineCountryCodes.includes(code),loading:countryLoading===code,selected:selectedCountry===code}))
                .filter(item=>`${item.name} ${item.code}`.toLowerCase().includes(countrySearch.trim().toLowerCase()))}
              search={countrySearch}
              onSearch={setCountrySearch}
              onSelect={selectCountryDatabase}
              onRemove={confirmRemoveDatabase}
              downloadedCount={offlineCountryCodes.length}
              publishedAt={publishedAt}
              checkedAt={checkedAt}
            />
          </View>
        )}

        {tab === "settings" && !lawsOpen && countryScreenTab === "settings" && (
          <View style={[s.settingsCard, pad && { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" }]}>
            <View style={[countriesStyles.segment, pad && { width: "100%", minHeight: 52 }]}>
              {[["countries",settings.language==="uk"?"Країни":settings.language==="en"?"Countries":settings.language==="pl"?"Kraje":"Страны"],["settings",t.settings]].map(([key,label])=>(
                <Pressable key={key} accessibilityRole="tab" accessibilityState={{selected:countryScreenTab===key}} onPress={()=>setCountryScreenTab(key)} style={[countriesStyles.segmentItem,countryScreenTab===key&&countriesStyles.segmentItemActive]}>
                  <Text style={[countriesStyles.segmentText,countryScreenTab===key&&countriesStyles.segmentTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={pad ? { width: "46%", gap: 12, alignSelf: "flex-start" } : { gap: 12 }}>
            <SettingSwitch label={(WARNING_UI[settings.language] || WARNING_UI.ru).switchLabel} value={settings.cameraWarnings !== false} onChange={v=>setSettings({...settings,cameraWarnings:v})}/>
            <Pressable accessibilityRole="button" onPress={() => {setLawsQuery("");setLawsOpen(true);}} style={[s.action, pad && { flex: 0 }]}><Text style={s.actionText}>{(WARNING_UI[settings.language] || WARNING_UI.ru).laws} →</Text></Pressable>
            <Text style={s.note}>{(WARNING_UI[settings.language] || WARNING_UI.ru).lawsNote}</Text>
            <Pressable accessibilityRole="button" onPress={() => {setOnboardingPage(0);setOnboardingState("new");}} style={s.alertDemoButton}>
              <Text style={s.alertDemoButtonTitle}>{({ru:"Посмотреть приветствие",uk:"Переглянути привітання",en:"View welcome",pl:"Zobacz powitanie"})[settings.language] || "View welcome"}</Text>
            </Pressable>
            <Pressable onPress={()=>setTab("history")} style={[s.action, pad && { flex: 0 }]}><Text style={s.actionText}>{ui.history} →</Text></Pressable>
            <Text style={s.sectionTitle}>{t.country}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {setCountrySearch("");setCountryScreenTab("countries");}}
              style={homeStyles.countryCard}
            >
              <Text style={homeStyles.countryFlag}>{countryFlag(selectedCountry)}</Text>
              <View style={homeStyles.countryCopy}>
                <Text style={homeStyles.countryName}>{countryDisplayName(selectedCountry,settings.language)}</Text>
                <Text style={homeStyles.countryMeta}>{({ru:"Выбор страны и загрузка базы",uk:"Вибір країни та завантаження бази",en:"Choose a country and download its database",pl:"Wybór kraju i pobieranie bazy"})[settings.language] || "Choose a country and download its database"}</Text>
              </View>
              <Text style={homeStyles.countryChevron}>›</Text>
            </Pressable>
            <Text style={s.sectionTitle}>{DRIVE_THEME_LABELS[settings.language] || DRIVE_THEME_LABELS.ru}</Text>
            <View style={s.driveThemeRow}>
              {["auto", "night", "day"].map(value => {
                const themeCopy = DRIVE_THEME_OPTIONS[settings.language] || DRIVE_THEME_OPTIONS.ru;
                const label = value === "auto" ? ui.auto : themeCopy[value];
                return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: settings.driveTheme === value }}
                  onPress={() => setSettings({ ...settings, driveTheme: value })}
                  style={[s.driveThemeOption, settings.driveTheme === value && s.driveThemeOptionActive]}
                >
                  <Text maxFontSizeMultiplier={1.4} numberOfLines={2} style={[s.driveThemeOptionText, settings.driveTheme === value && s.driveThemeOptionTextActive]}>{label}</Text>
                </Pressable>
              );})}
            </View>
            <Pressable accessibilityRole="button" onPress={() => setModal("alertDemo")} style={s.alertDemoButton}>
              <Text maxFontSizeMultiplier={1.4} style={s.alertDemoButtonTitle}>{(ALERT_PREVIEW_COPY[settings.language] || ALERT_PREVIEW_COPY.ru).title}</Text>
              <Text maxFontSizeMultiplier={1.4} style={s.alertDemoButtonSub}>{(ALERT_PREVIEW_COPY[settings.language] || ALERT_PREVIEW_COPY.ru).sub}</Text>
            </Pressable>
            <Text style={s.sectionTitle}>{t.languageLabel}</Text>
            <View style={s.row}>
              {["ru","uk","en","pl"].map(l => <Pressable key={l} onPress={()=>{
                setSettings({...settings,language:l});
                if (Platform.OS === "android" && NativeModules.CamAlertLocale) NativeModules.CamAlertLocale.setLanguage(l).catch(()=>{});
              }} style={[s.lang,settings.language===l&&s.langActive]}><Text style={s.settingLabel}>{l==="uk"?"UA":l.toUpperCase()}</Text></Pressable>)}
            </View>
            <SettingSwitch label={t.background} value={backgroundEnabled} onChange={toggleBackground}/>
            <Text maxFontSizeMultiplier={1.5} style={s.note}>{backgroundAccessMessage(settings.language, backgroundAccess)}</Text>
            <Pressable accessibilityRole="button" onPress={openBackgroundSettings} style={s.locationButton}>
              <Text maxFontSizeMultiplier={1.4} style={s.locationButtonText}>{backgroundGuideCopy(settings.language, Platform.OS).openSettings}</Text>
            </Pressable>
            <Text maxFontSizeMultiplier={1.5} style={s.note}>{BACKGROUND_NOTE[settings.language] || BACKGROUND_NOTE.ru}</Text>
            <SettingSwitch label={t.voiceLabel} value={settings.voice} onChange={v=>setSettings({...settings,voice:v})}/>
            <SettingSwitch label={t.vibrationLabel} value={settings.vibration} onChange={v=>setSettings({...settings,vibration:v})}/>
            <SettingSwitch label={t.smartDistanceLabel} value={settings.smartDistance} onChange={v=>setSettings({...settings,smartDistance:v})}/>
            <Pressable accessibilityRole="button" accessibilityState={{expanded:advancedOpen}} onPress={()=>setAdvancedOpen(!advancedOpen)} style={[s.action, pad && { flex: 0 }]}><Text style={s.actionText}>{ui.advanced} {advancedOpen?"−":"＋"}</Text></Pressable>
            {advancedOpen && <>
            <Text style={s.sectionTitle}>{t.distancesLabel}</Text>
            {[
              [t.band1,"cityDistance"],[t.band2,"roadDistance"],
              [t.band3,"highwayDistance"],[t.band4,"fastDistance"]
            ].map(([label,key]) => <DistanceRow key={key} label={label} value={settings[key]} setValue={v=>setSettings({...settings,[key]:v})}/>)}
            </>}
            </View>
            <View style={pad ? { width: "46%", gap: 12, alignSelf: "flex-start" } : { gap: 12 }}>
            <Text style={[s.sectionTitle, pad && { fontSize: 22 }]}>{t.dataUpdate}</Text>
            {databaseErrors[selectedCountry] && <Text style={s.note}>⚠ {({ru:"Обновление не удалось. Используется сохранённая база; её актуальность не подтверждена.",uk:"Оновлення не вдалося. Використовується збережена база; актуальність не підтверджено.",en:"Update failed. Using saved data; freshness is unconfirmed.",pl:"Aktualizacja nieudana. Używana jest zapisana baza; aktualność niepotwierdzona."})[settings.language]}</Text>}
            <View style={[s.dataCard, s.dataCardStack]}>
              <View>
                <Text maxFontSizeMultiplier={1.6} style={s.dataLabel}>{t.databaseVersion}</Text>
                <Text maxFontSizeMultiplier={1.6} style={s.dataValue}>{formatCatalogDate(publishedAt, settings.language) || "—"}</Text>
              </View>
              <View>
                <Text maxFontSizeMultiplier={1.6} style={s.dataLabel}>{t.lastCheck}</Text>
                <Text maxFontSizeMultiplier={1.6} style={s.dataValue}>{formatCatalogDate(checkedAt, settings.language, true) || "—"}</Text>
              </View>
              <Pressable onPress={()=>refreshRemoteData(false)} style={[s.smallButton, s.dataUpdateButton]}>
                <Text maxFontSizeMultiplier={1.4} style={s.smallButtonText}>{t.updateNow}</Text>
              </Pressable>
            </View>

            <Text style={s.sectionTitle}>{t.coverage}</Text>
            <View style={s.coverageCard}>
              {pad ? <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled>
                {countryCoverage.map(item=><Text key={item.country_code} style={[s.coverageLine, { fontSize: 16, lineHeight: 24 }]}>{countryFlag(item.country_code)} {COUNTRY_NAMES[item.country_code]||item.country_code}: {item.record_count ?? item.total}</Text>)}
                <Pressable onPress={()=>Linking.openURL("https://www.openstreetmap.org/copyright")}><Text style={s.coverageLine}>© OpenStreetMap contributors · ODbL 1.0</Text></Pressable>
              </ScrollView> : <>
                {countryCoverage.map(item=><Text key={item.country_code} style={s.coverageLine}>{countryFlag(item.country_code)} {COUNTRY_NAMES[item.country_code]||item.country_code}: {item.record_count ?? item.total}</Text>)}
                <Pressable onPress={()=>Linking.openURL("https://www.openstreetmap.org/copyright")}><Text style={s.coverageLine}>© OpenStreetMap contributors · ODbL 1.0</Text></Pressable>
              </>}
            </View>


            <Pressable accessibilityRole="button" onPress={()=>active && (!speedAvailable || speedKmh>0) ? Alert.alert("CamAlert",ui.stop) : setModal("new")} style={[s.action, pad && { flex: 0 }]}><Text style={s.actionText}>＋ {t.report}</Text></Pressable>
            <Text style={s.sectionTitle}>{t.about}</Text>
            <AboutLink label={t.privacy} url={URLS.privacy}/>
            <AboutLink label={t.safety} url={URLS.safety}/>
            <AboutLink label={t.sources} url={URLS.sources}/>
            <AboutLink label={t.reportHelp} url={URLS.reportHelp}/>
            <AboutLink label={t.support} url={URLS.support}/>
            <AboutLink label={t.terms} url={URLS.terms}/>
            <AboutLink label={t.website} url={URLS.home}/>
            {reports.length>0 && <Text style={s.note}>{ui.report}: {reports.length}</Text>}
            <Text style={s.note}>Локальных сообщений: {reports.length}. Скрытых камер: {hiddenIds.length}.</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[s.nav, pad && { marginHorizontal: 28, marginBottom: 14, padding: 8, borderRadius: 24 }]}>
        {nav.map(([key,icon,label]) => (
          <Pressable accessibilityRole="tab" accessibilityState={{selected:tab===key || key==="map" && tab==="cameras" || key==="settings" && tab==="history"}} key={key} onPress={()=>{if(key!=="settings")setLawsOpen(false);if(key==="settings")setCountryScreenTab("settings");setTab(key);}} style={[s.navItem, pad && { minHeight: 64 }, (tab===key || key==="map" && tab==="cameras" || key==="settings" && tab==="history") && s.navActive]}>
            <Text maxFontSizeMultiplier={1.3} style={[s.navIcon, pad && { fontSize: 22 }]}>{icon}</Text><Text maxFontSizeMultiplier={1.45} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[s.navLabel, pad && { fontSize: 16, lineHeight: 20 }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {renderBackgroundGuide()}
      <NavigatorPickerSheet
        visible={modal === "navigator"}
        language={settings.language}
        platform={Platform.OS}
        destination={navigatorDestination}
        onDestinationChange={setNavigatorDestination}
        onSelect={launchNavigator}
        onAlertsOnly={() => { setModal(null); startTracking(); }}
        onClose={() => setModal(null)}
      />

      {modal === "new" && <Modal visible transparent animationType="slide">
        <View style={s.modalShade}><View style={[s.modalCard, pad && { width: "100%", maxWidth: 640, alignSelf: "center", marginBottom: 24, borderRadius: 26 }]}>
          <PageBackButton language={settings.language} onPress={() => setModal(null)} onLight={!isNight} />
          <Text style={s.modalTitle}>{t.reportTitle}</Text>
          <Text style={s.modalText}>{coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : "GPS недоступен"}</Text>
          <TextInput style={s.input} value={reportNote} onChangeText={setReportNote} placeholder="Комментарий, например направление или тип камеры" multiline />
          <Pressable onPress={reportNewCamera} style={s.button}><Text style={s.buttonText}>{t.send}</Text></Pressable>
          <Pressable onPress={()=>setModal(null)} style={s.cancel}><Text style={s.settingLabel}>{t.cancel}</Text></Pressable>
        </View></View>
      </Modal>}

      {modal === "removed" && <Modal visible transparent animationType="slide">
        <View style={s.modalShade}><View style={[s.modalCard, pad && { width: "100%", maxWidth: 640, alignSelf: "center", marginBottom: 24, borderRadius: 26 }]}>
          <PageBackButton language={settings.language} onPress={() => setModal(null)} onLight={!isNight} />
          <Text style={s.modalTitle}>{t.removedTitle}</Text>
          <Text style={s.modalText}>{shownCam?.location || shownCam?.region}</Text>
          <Pressable onPress={()=>reportRemovedCamera(shownCam)} style={[s.button,s.stop]}><Text style={s.buttonText}>{t.removed}</Text></Pressable>
          <Pressable onPress={()=>setModal(null)} style={s.cancel}><Text style={s.settingLabel}>{t.cancel}</Text></Pressable>
        </View></View>
      </Modal>}

      {modal === "alertDemo" && <Modal visible transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <View style={s.alertDemoShade}>
          <View style={s.alertDemoContent}>
            <PageBackButton language={settings.language} onPress={() => setModal(null)} onLight={settings.driveTheme === "day"} />
            <View style={s.alertDemoModeRow}>
              {["compact", "expanded"].map((mode) => {
                const previewCopy = ALERT_PREVIEW_COPY[settings.language] || ALERT_PREVIEW_COPY.ru;
                return (
                <Pressable key={mode} onPress={() => setAlertPreviewMode(mode)} style={[s.alertDemoMode, alertPreviewMode === mode && s.alertDemoModeActive]}>
                  <Text style={[s.alertDemoModeText, alertPreviewMode === mode && s.alertDemoModeTextActive]}>{mode === "compact" ? previewCopy.compact : previewCopy.expanded}</Text>
                </Pressable>
              );})}
            </View>
            {alertPreviewMode === "compact" ? (
              <CameraAlertCompact
                camera={{ id: "demo-only-camera", distance: 250, speed_limit: 90, type: "speed_camera" }}
                threshold={alertDistanceForSpeed(78, settings)}
                language={settings.language}
                theme={resolvedTheme}
                demo
              />
            ) : (
              <CameraWarningPanel
                camera={{ id: "demo-only-camera", distance: 250, speed_limit: 90, type: "speed_camera" }}
                currentSpeedKmh={78}
                speedAvailable
                threshold={alertDistanceForSpeed(78, settings)}
                language={settings.language}
                theme={resolvedTheme}
                voiceEnabled={false}
                vibrationEnabled={false}
                demo
                onDismiss={() => setModal(null)}
              />
            )}
            {alertPreviewMode === "compact" && <Pressable onPress={() => setModal(null)} style={driveStyles.warningDismiss}><Text style={[driveStyles.warningDismissText, settings.driveTheme === "day" ? driveStyles.textMutedDay : driveStyles.textMuted]}>{(ALERT_PREVIEW_COPY[settings.language] || ALERT_PREVIEW_COPY.ru).close}</Text></Pressable>}
          </View>
        </View>
      </Modal>}
    </SystemSafeArea>
    </ThemeContext.Provider>
  );
}

const DRIVE_HOME_COPY = {
  ru: {
    gps: "GPS", gpsReady: "Разрешение есть", gpsNeeded: "Нужен доступ", database: "База камер",
    databaseReady: "Обновлена", localDatabase: "Локальная база", title: "В путь!", subtitle: "Больше уверенности на каждой дороге",
    start: "Начать поездку", where: "Куда едем?", chooseNav: "Выберите навигацию", alertsOnly: "Только предупреждения",
    country: "Украина", cameras: "камер", settings: "Настройки", updated: "Обновлено", baseLoaded: "База загружена", databaseMissing: "Базы пока нет", offlineAvailable: "Доступна офлайн", offlineUnknown: "Офлайн не подтверждён",
    localReady: "Доступна на устройстве", navNote: "Фоновые предупреждения рядом с навигатором ещё требуют настройки и проверки.",
    navUnavailableTitle: "Навигация недоступна",
    navUnavailable: "Откройте сайт навигатора или установите приложение. Фоновые предупреждения CamAlert проверяются отдельно.",
  },
  uk: {
    gps: "GPS", gpsReady: "Дозвіл є", gpsNeeded: "Потрібен доступ", database: "База камер",
    databaseReady: "Оновлена", localDatabase: "Локальна база", title: "У дорогу!", subtitle: "Більше впевненості на кожній дорозі",
    start: "Почати поїздку", where: "Куди їдемо?", chooseNav: "Оберіть навігацію", alertsOnly: "Лише попередження",
    country: "Україна", cameras: "камер", settings: "Налаштування", updated: "Оновлено", baseLoaded: "Базу завантажено", databaseMissing: "Бази ще немає", offlineAvailable: "Доступна офлайн", offlineUnknown: "Офлайн не підтверджено",
    localReady: "Доступна на пристрої", navNote: "Фонові попередження поруч із навігатором ще потрібно налаштувати й перевірити.",
    navUnavailableTitle: "Навігацію ще не підключено",
    navUnavailable: "Зараз CamAlert працює окремо. Спільний запуск і попередження поверх цього навігатора ще не реалізовані.",
  },
  en: {
    gps: "GPS", gpsReady: "Permission granted", gpsNeeded: "Access needed", database: "Camera database",
    databaseReady: "Updated", localDatabase: "Local database", title: "Ready to go", subtitle: "More confidence on every road",
    start: "Start trip", where: "Where to?", chooseNav: "Choose navigation", alertsOnly: "Alerts only",
    country: "Ukraine", cameras: "cameras", settings: "Settings", updated: "Updated", baseLoaded: "Database ready", databaseMissing: "No database yet", offlineAvailable: "Available offline", offlineUnknown: "Offline not confirmed",
    localReady: "Available on this device", navNote: "Background alerts alongside a navigator still need setup and device testing.",
    navUnavailableTitle: "Navigation is not connected yet",
    navUnavailable: "CamAlert currently works on its own. Launching this navigator alongside background alerts is not implemented yet.",
  },
  pl: {
    gps: "GPS", gpsReady: "Zezwolono", gpsNeeded: "Wymagany dostęp", database: "Baza fotoradarów",
    databaseReady: "Zaktualizowana", localDatabase: "Baza lokalna", title: "W drogę!", subtitle: "Więcej pewności na każdej trasie",
    start: "Rozpocznij jazdę", where: "Dokąd jedziemy?", chooseNav: "Wybierz nawigację", alertsOnly: "Tylko ostrzeżenia",
    country: "Ukraina", cameras: "kamer", settings: "Ustawienia", updated: "Zaktualizowano", baseLoaded: "Baza gotowa", databaseMissing: "Brak bazy", offlineAvailable: "Dostępna offline", offlineUnknown: "Offline niepotwierdzony",
    localReady: "Dostępna na urządzeniu", navNote: "Ostrzeżenia w tle obok nawigacji wymagają konfiguracji i testów.",
    navUnavailableTitle: "Nawigacja nie jest jeszcze połączona",
    navUnavailable: "CamAlert działa teraz samodzielnie. Wspólne uruchomienie i ostrzeżenia w tle nad tą nawigacją nie są jeszcze dostępne.",
  },
};

const DRIVE_THEME_LABELS = {
  ru: "Тема приложения", uk: "Тема застосунку", en: "App theme", pl: "Motyw aplikacji",
};
const DRIVE_THEME_OPTIONS = {
  ru: { night: "Ночная поездка", day: "Дневная поездка" },
  uk: { night: "Нічна поїздка", day: "Денна поїздка" },
  en: { night: "Night Drive", day: "Day Drive" },
  pl: { night: "Nocna jazda", day: "Dzienna jazda" },
};
const ALERT_PREVIEW_COPY = {
  ru: { title: "Проверить предупреждение", sub: "Пример оповещения · 250 м · 78 / 90 км/ч", example: "Пример оповещения", compact: "Компактное", expanded: "Крупное", close: "Закрыть" },
  uk: { title: "Перевірити попередження", sub: "Приклад сповіщення · 250 м · 78 / 90 км/год", example: "Приклад сповіщення", compact: "Компактне", expanded: "Велике", close: "Закрити" },
  en: { title: "Check a warning", sub: "Sample alert · 250 m · 78 / 90 km/h", example: "Sample alert", compact: "Compact", expanded: "Large", close: "Close" },
  pl: { title: "Sprawdź ostrzeżenie", sub: "Przykład powiadomienia · 250 m · 78 / 90 km/h", example: "Przykład powiadomienia", compact: "Kompaktowe", expanded: "Duże", close: "Zamknij" },
};
const BACKGROUND_NOTE = {
  ru: "Фон: системные уведомления о камерах. Голос и Bluetooth требуют проверки на устройстве. После принудительного закрытия приложения сессию нужно запустить снова.",
  uk: "Фон: системні сповіщення про камери. Голос і Bluetooth потребують перевірки на пристрої. Після примусового закриття застосунку сесію потрібно запустити знову.",
  en: "Background: system camera notifications. Voice and Bluetooth need a check on the device. After force-quitting the app, start the session again.",
  pl: "Tło: systemowe powiadomienia o kamerach. Głos i Bluetooth wymagają sprawdzenia na urządzeniu. Po wymuszonym zamknięciu aplikacji sesję trzeba uruchomić ponownie.",
};

const DRIVE_MODE_COPY = {
  ru: {
    gps: "GPS", connected: "Подключён", searching: "Поиск сигнала…", unavailable: "Недоступен",
    warnings: "Сигналы", voiceOn: "Голос включён", vibrationOn: "Вибрация включена", warningsOff: "Выключены",
    backgroundOn: "Фон: включён", backgroundOff: "Фон: не настроен", speedUnit: "км/ч", camera: "Камера впереди",
    cameraType: "Тип контроля", cameraLimit: "Лимит камеры", sectionLimit: "Ограничение участка",     noCamera: "Поиск камер активен",
    noCameraSub: "Камер впереди пока нет", warningsPaused: "Предупреждения о камерах выключены", warningsPausedSub: "Спидометр и карта работают", gpsTitle: "Ожидаем GPS-сигнал", gpsBody: "Положение и скорость появятся после получения данных GPS.",
    retry: "Повторить поиск", center: "К автомобилю", zoomIn: "Увеличить карту", zoomOut: "Уменьшить карту",
    settings: "Настройки", route: "Маршрут", stop: "Завершить поездку", sectionApproach: "Начало участка через", sectionEntering: "Начало участка контроля средней скорости",
    sectionInside: "Контроль средней скорости", sectionEnding: "Конец участка контроля средней скорости", meters: "м",
  },
  uk: {
    gps: "GPS", connected: "Підключено", searching: "Пошук сигналу…", unavailable: "Недоступний",
    warnings: "Сигнали", voiceOn: "Голос увімкнено", vibrationOn: "Вібрацію увімкнено", warningsOff: "Вимкнені",
    backgroundOn: "Фон: увімкнено", backgroundOff: "Фон: не налаштовано", speedUnit: "км/год", camera: "Камера попереду",
    cameraType: "Тип контролю", cameraLimit: "Обмеження камери", sectionLimit: "Обмеження ділянки",     noCamera: "Пошук камер активний",
    noCameraSub: "Камер попереду поки немає", warningsPaused: "Попередження про камери вимкнені", warningsPausedSub: "Спідометр і карта працюють", gpsTitle: "Очікуємо сигнал GPS", gpsBody: "Положення та швидкість з’являться після отримання даних GPS.",
    retry: "Повторити пошук", center: "До автомобіля", zoomIn: "Збільшити карту", zoomOut: "Зменшити карту",
    settings: "Налаштування", route: "Маршрут", stop: "Завершити поїздку", sectionApproach: "Початок ділянки через", sectionEntering: "Початок контролю середньої швидкості",
    sectionInside: "Контроль середньої швидкості", sectionEnding: "Кінець контролю середньої швидкості", meters: "м",
  },
  en: {
    gps: "GPS", connected: "Connected", searching: "Searching for signal…", unavailable: "Unavailable",
    warnings: "Warnings", voiceOn: "Voice on", vibrationOn: "Vibration on", warningsOff: "Off",
    backgroundOn: "Background: on", backgroundOff: "Background: not set up", speedUnit: "km/h", camera: "Camera ahead",
    cameraType: "Enforcement", cameraLimit: "Camera limit", sectionLimit: "Section limit",     noCamera: "Camera search active",
    noCameraSub: "No camera ahead right now", warningsPaused: "Camera warnings are off", warningsPausedSub: "The speedometer and map keep working", gpsTitle: "Waiting for GPS signal", gpsBody: "Your position and speed will appear when GPS data arrives.",
    retry: "Retry GPS", center: "Center on car", zoomIn: "Zoom in", zoomOut: "Zoom out",
    settings: "Settings", route: "Route", stop: "End trip", sectionApproach: "Section starts in", sectionEntering: "Average-speed section starts",
    sectionInside: "Average-speed control", sectionEnding: "Average-speed section ends", meters: "m",
  },
  pl: {
    gps: "GPS", connected: "Połączono", searching: "Szukanie sygnału…", unavailable: "Niedostępny",
    warnings: "Ostrzeżenia", voiceOn: "Głos włączony", vibrationOn: "Wibracje włączone", warningsOff: "Wyłączone",
    backgroundOn: "Tło: włączone", backgroundOff: "Tło: nie skonfigurowano", speedUnit: "km/h", camera: "Fotoradar przed Tobą",
    cameraType: "Rodzaj kontroli", cameraLimit: "Limit fotoradaru", sectionLimit: "Limit odcinka",     noCamera: "Wyszukiwanie fotoradarów aktywne",
    noCameraSub: "Brak fotoradaru przed Tobą", warningsPaused: "Ostrzeżenia o kamerach są wyłączone", warningsPausedSub: "Prędkościomierz i mapa nadal działają", gpsTitle: "Oczekiwanie na sygnał GPS", gpsBody: "Pozycja i prędkość pojawią się po otrzymaniu danych GPS.",
    retry: "Ponów GPS", center: "Wyśrodkuj na aucie", zoomIn: "Przybliż mapę", zoomOut: "Oddal mapę",
    settings: "Ustawienia", route: "Trasa", stop: "Zakończ jazdę", sectionApproach: "Początek odcinka za", sectionEntering: "Początek odcinkowego pomiaru prędkości",
    sectionInside: "Kontrola średniej prędkości", sectionEnding: "Koniec odcinkowego pomiaru prędkości", meters: "m",
  },
};

function pageBackLabel(language) {
  return language === "en" ? "Back" : language === "pl" ? "Wstecz" : "Назад";
}

function PageBackButton({ language, onPress, onLight = false, label }) {
  const text = label || pageBackLabel(language);
  const color = onLight ? "#10263B" : "#F7FBFF";
  const background = onLight ? "rgba(255,255,255,0.96)" : "rgba(16,38,59,0.94)";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={onPress} style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 14, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: background }}>
      <View style={{ width: 10, height: 10, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: color, transform: [{ rotate: "45deg" }], marginRight: 8 }} />
      <Text maxFontSizeMultiplier={1.4} style={{ color, fontSize: 17, fontWeight: "700" }}>{text}</Text>
    </Pressable>
  );
}

function DriveModeScreen({
  theme, language, coords, gpsFixReceived, locationPermissionStatus, speedKmh, speedAvailable, heading,
  camera, currentThreshold, danger, warningsEnabled = true, voiceEnabled, vibrationEnabled, backgroundEnabled, averageSection,
  warningPresentation, onDismissWarning, databaseStatus,
  onRetry, onStop, onSettings,
  routePolyline = null, routeCameras = null, routeZoom = null, maneuver = null, onEndRoute = null, onOpenRoute = null,
}) {
  const mapRef = useRef(null);
  const followPose = useRef(null);
  const followingRef = useRef(false);
  const tripMapRegion = useRef(null);
  const { pad } = usePadLayout();
  const [following, setFollowing] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [deferTripMap, setDeferTripMap] = useState(true);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDeferTripMap(false));
    return () => cancelAnimationFrame(frame);
  }, []);
  const copy = DRIVE_MODE_COPY[language] || DRIVE_MODE_COPY.ru;
  const isNight = theme !== "day";
  const hasFix = !!(gpsFixReceived && coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude));
  const headingIsReliable = hasFix && speedAvailable && speedKmh >= MIN_MOVING_SPEED_KMH && Number.isFinite(heading);
  const hasCameraCoordinate = camera && camera.latitude != null && camera.longitude != null
    && Number.isFinite(Number(camera.latitude)) && Number.isFinite(Number(camera.longitude));
  const targetZoom = routeZoom ?? (camera?.distance > 3000 ? 14 : camera?.distance > 1500 ? 15 : camera?.distance > 700 ? 16 : 17);
  const proximity = camera && currentThreshold > 0
    ? Math.max(0, Math.min(1, 1 - Number(camera.distance || 0) / currentThreshold))
    : 0;
  const gpsLabel = hasFix ? copy.connected
    : locationPermissionStatus === "granted" ? copy.searching : copy.unavailable;
  const warningLabel = voiceEnabled ? copy.voiceOn : vibrationEnabled ? copy.vibrationOn : copy.warningsOff;
  const expandedWarning = !!(warningPresentation && hasFix && danger && camera
    && String(camera.id) === warningPresentation.cameraId);

  function applyDriveCamera(command) {
    traceTrip("map", "enter");
    try {
    if (!command || !mapRef.current || command.api !== "setCamera") return;
    followPose.current = command;
    mapRef.current.setCamera({
      center: { latitude: command.latitude, longitude: command.longitude },
      pitch: command.pitch,
      heading: command.heading,
      zoom: command.zoom,
    });
    } catch (error) {
      traceTrip("error", "error");
      console.log("[trip-diag] error map", error && (error.message || String(error)));
      throw error;
    } finally {
      traceTrip("map", "exit");
    }
  }

  useEffect(() => {
    traceTrip("follow", "enter");
    try {
    if (!following) {
      followingRef.current = false;
      return;
    }
    if (!hasFix || !mapReady || !mapRef.current) return;
    const resumed = !followingRef.current;
    followingRef.current = true;
    const command = nextDriveCameraCommand(followPose.current, {
      latitude: coords.latitude,
      longitude: coords.longitude,
      heading: headingIsReliable ? heading : null,
      moving: headingIsReliable,
      zoom: targetZoom,
      at: Date.now(),
    }, { force: resumed });
    applyDriveCamera(command);
    } finally {
      traceTrip("follow", "exit");
    }
  }, [coords?.latitude, coords?.longitude, hasFix, heading, headingIsReliable, following, mapReady, targetZoom]);

  async function adjustZoom(delta) {
    if (!mapRef.current || !mapReady) return;
    try {
      const cameraState = await mapRef.current.getCamera();
      const zoom = Number.isFinite(cameraState.zoom) ? cameraState.zoom : 16;
      mapRef.current.setCamera({ ...cameraState, zoom: Math.max(10, Math.min(20, zoom + delta)) });
    } catch (_) {}
  }

  function recenter() {
    if (!hasFix) return;
    const command = nextDriveCameraCommand(followPose.current, {
      latitude: coords.latitude,
      longitude: coords.longitude,
      heading: headingIsReliable ? heading : null,
      moving: headingIsReliable,
      zoom: targetZoom,
      at: Date.now(),
    }, { force: true });
    followingRef.current = true;
    applyDriveCamera(command);
    if (!following) setFollowing(true);
  }

  function sectionLabel() {
    if (!averageSection) return null;
    if (averageSection.state === "approaching") return `${copy.sectionApproach} ${formatRoadDistance(averageSection.distance)}`;
    if (averageSection.state === "entering") return copy.sectionEntering;
    if (averageSection.state === "ending") return copy.sectionEnding;
    return copy.sectionInside;
  }

  if (!tripMapRegion.current && hasFix) {
    tripMapRegion.current = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };
  }

  traceTrip("driveRender", "render");
  return (
    <View testID="DriveModeScreenRoot" collapsable={false} style={[driveStyles.root, isNight ? driveStyles.nightRoot : driveStyles.dayRoot]}>
      <StatusBar style={isNight ? "light" : "dark"} translucent backgroundColor="transparent" />
      {!deferTripMap && tripMapRegion.current ? <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={tripMapRegion.current}
          mapType="standard"
          userInterfaceStyle={isNight ? "dark" : "light"}
          customMapStyle={isNight ? NIGHT_MAP_STYLE : []}
          showsUserLocation={false}
          followsUserLocation={false}
          showsCompass={false}
          showsScale={false}
          showsTraffic={false}
          toolbarEnabled={false}
          onMapReady={() => setMapReady(true)}
          onPanDrag={() => setFollowing(false)}
        >
          {Array.isArray(routePolyline) && routePolyline.length > 1 && (
            <Polyline coordinates={routePolyline} strokeColor="#1260E8" strokeWidth={5} />
          )}
          {Array.isArray(routeCameras) && routeCameras.map((item) => (
            <Marker
              key={`route-camera-${item.id}`}
              coordinate={{ latitude: Number(item.latitude), longitude: Number(item.longitude) }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={driveStyles.routeCameraDot} />
            </Marker>
          ))}
          {averageSection && ["start","end"].map(edge=>{
            const point=averageSection[edge];
            if(point?.latitude==null || point?.longitude==null || !Number.isFinite(Number(point.latitude)) || !Number.isFinite(Number(point.longitude))) return null;
            return <Marker key={edge} coordinate={{latitude:Number(point.latitude),longitude:Number(point.longitude)}} title={uiCopy(language)[edge]}><View style={{backgroundColor:"#172A40",padding:8,borderRadius:12}}><Text style={{color:"#23D3EF"}}>↔ {uiCopy(language)[edge]}</Text></View></Marker>;
          })}
          {hasFix && <Marker coordinate={coords} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} title={copy.gps}>
            <View style={[driveStyles.carMarkerHalo, isNight ? driveStyles.carMarkerHaloNight : driveStyles.carMarkerHaloDay]}>
              <Text style={driveStyles.carArrow}>▲</Text>
            </View>
          </Marker>}
          {hasFix && hasCameraCoordinate && (
            <Marker
              coordinate={{ latitude: Number(camera.latitude), longitude: Number(camera.longitude) }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              title={copy.camera}
              description={camera.location || camera.road_index || camera.region || cameraTypeLabel(camera, language)}
            >
              <View style={[driveStyles.mapCameraMarker, danger && driveStyles.mapCameraMarkerDanger]}><Text style={driveStyles.mapCameraGlyph}>{cameraGlyph(camera)}</Text></View>
            </Marker>
          )}
        </MapView> : <View pointerEvents="none" style={[StyleSheet.absoluteFill, isNight ? driveStyles.mapWaitingNight : driveStyles.mapWaitingDay]} />}

      <SystemSafeArea pointerEvents="box-none" style={driveStyles.safeOverlay}>
        <View pointerEvents="box-none" style={[driveStyles.topArea, pad && { marginHorizontal: 28, gap: 14 }]}>
          <PageBackButton language={language} onPress={onStop} onLight={!isNight} />
          <View style={driveStyles.statusRow}>
            <View style={[driveStyles.statusCard, isNight ? driveStyles.glassNight : driveStyles.glassDay]}>
              <View style={[driveStyles.statusDot, hasFix ? driveStyles.dotReady : locationPermissionStatus === "granted" ? driveStyles.dotSearching : driveStyles.dotOff]} />
              <View style={driveStyles.statusTextBlock}>
                <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[driveStyles.statusTitle, isNight ? driveStyles.textWhite : driveStyles.textDark]}>{copy.gps}</Text>
                <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[driveStyles.statusSub, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>{gpsLabel}</Text>
              </View>
            </View>
            <View style={[driveStyles.statusCard, isNight ? driveStyles.glassNight : driveStyles.glassDay]}>
              <Text style={[driveStyles.audioGlyph, voiceEnabled ? driveStyles.audioOn : driveStyles.audioOff]}>{voiceEnabled ? "◖" : "◌"}</Text>
              <View style={driveStyles.statusTextBlock}>
                <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[driveStyles.statusTitle, isNight ? driveStyles.textWhite : driveStyles.textDark]}>{copy.warnings}</Text>
                <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[driveStyles.statusSub, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>{warningLabel}</Text>
                <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[driveStyles.statusTiny, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>{backgroundEnabled ? copy.backgroundOn : copy.backgroundOff}</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={copy.settings} onPress={onSettings} style={[driveStyles.settingsButton, isNight ? driveStyles.glassNight : driveStyles.glassDay]}>
              <Text style={[driveStyles.settingsGlyph, isNight ? driveStyles.textWhite : driveStyles.textDark]}>⚙</Text>
            </Pressable>
          </View>

          <Text maxFontSizeMultiplier={1.3} numberOfLines={2} style={{fontSize:11,color:isNight?"#CAD7E7":"#24445B",backgroundColor:isNight?"#172A40":"#FFFFFF",padding:6,borderRadius:8}}>{databaseStatus}</Text>
          <View style={driveStyles.metricsRow}>
            <View style={[driveStyles.speedBadge, pad && { width: 124, height: 124, borderRadius: 62 }, isNight ? driveStyles.glassNight : driveStyles.glassDay]}>
              <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[driveStyles.speedValue, pad && { fontSize: 46, lineHeight: 50 }, isNight ? driveStyles.textWhite : driveStyles.textDark]}>{speedAvailable ? speedKmh : "—"}</Text>
              <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[driveStyles.speedUnit, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>{copy.speedUnit}</Text>
              <Text maxFontSizeMultiplier={1.3} style={{fontSize:11,color:isNight?"#CAD7E7":"#24445B"}}>{headingIsReliable?directionLabel(heading,language):"—"}</Text>
            </View>
            {camera?.speed_limit != null && (
              <View style={[driveStyles.limitBlock, isNight ? driveStyles.glassNight : driveStyles.glassDay]}>
                <View style={driveStyles.limitSignOuter}><View style={driveStyles.limitSignInner}><Text style={driveStyles.limitValue}>{camera.speed_limit}</Text></View></View>
                <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[driveStyles.limitCaption, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>{copy.cameraLimit}</Text>
              </View>
            )}
          </View>
        </View>

        {hasFix && <View pointerEvents="box-none" style={driveStyles.mapControls}>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.center} onPress={recenter} style={[driveStyles.mapControl, isNight ? driveStyles.glassNight : driveStyles.glassDay]}>
            <Text style={[driveStyles.mapControlGlyph, isNight ? driveStyles.textWhite : driveStyles.textDark]}>⌖</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.zoomIn} onPress={() => adjustZoom(1)} style={[driveStyles.mapControl, isNight ? driveStyles.glassNight : driveStyles.glassDay]}>
            <Text style={[driveStyles.mapControlGlyph, isNight ? driveStyles.textWhite : driveStyles.textDark]}>＋</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.zoomOut} onPress={() => adjustZoom(-1)} style={[driveStyles.mapControl, isNight ? driveStyles.glassNight : driveStyles.glassDay]}>
            <Text style={[driveStyles.mapControlGlyph, isNight ? driveStyles.textWhite : driveStyles.textDark]}>−</Text>
          </Pressable>
          {!following && <View style={[driveStyles.offCenterBadge, isNight ? driveStyles.glassNight : driveStyles.glassDay]}><Text style={[driveStyles.offCenterText, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>{copy.center}</Text></View>}
        </View>}

          <View pointerEvents="box-none" style={[driveStyles.bottomArea, pad && { marginHorizontal: 28, gap: 14, paddingBottom: 16 }]}>
          {averageSection && (
            <View style={[driveStyles.sectionNotice, averageSection.state === "ending" ? driveStyles.sectionNoticeCool : driveStyles.sectionNoticeAmber]}>
              <Text style={driveStyles.sectionNoticeGlyph}>◉</Text>
              <View style={{ flex: 1 }}>
                  <Text style={[driveStyles.sectionNoticeTitle, !isNight && driveStyles.sectionNoticeTitleDay]}>{sectionLabel()}</Text>
                {averageSection.speedLimit != null && <Text style={[driveStyles.sectionNoticeSub, !isNight && driveStyles.sectionNoticeSubDay]}>{copy.sectionLimit}: {averageSection.speedLimit} {copy.speedUnit}</Text>}
                <SectionState section={averageSection} language={language} night={isNight} />
              </View>
            </View>
          )}
          {!hasFix ? (
            <View style={[driveStyles.gpsPrompt, isNight ? driveStyles.glassNightStrong : driveStyles.glassDay]}>
              <Text style={[driveStyles.gpsPromptTitle, isNight ? driveStyles.textWhite : driveStyles.textDark]}>{copy.gpsTitle}</Text>
              <Text style={[driveStyles.gpsPromptBody, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>{copy.gpsBody}</Text>
              <Pressable accessibilityRole="button" onPress={onRetry} style={driveStyles.retryButton}><Text style={driveStyles.retryText}>{copy.retry}</Text></Pressable>
            </View>
          ) : camera && !expandedWarning ? (
            <CameraAlertCompact camera={camera} language={language} theme={theme} danger={danger} proximity={proximity} speedKmh={speedKmh} speedAvailable={speedAvailable} />
          ) : (
            <View style={[driveStyles.noCameraCard, isNight ? driveStyles.glassNightStrong : driveStyles.glassDay]}>
              <View style={[driveStyles.statusDot, warningsEnabled ? driveStyles.dotReady : driveStyles.dotOff]} />
              <View style={{ flex: 1 }}>
                <Text style={[driveStyles.noCameraTitle, pad && { fontSize: 18 }, isNight ? driveStyles.textWhite : driveStyles.textDark]}>{warningsEnabled ? copy.noCamera : copy.warningsPaused}</Text>
                <Text style={[driveStyles.noCameraSub, pad && { fontSize: 15 }, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>{warningsEnabled ? copy.noCameraSub : copy.warningsPausedSub}</Text>
              </View>
            </View>
          )}
          {maneuver && (
            <View style={[driveStyles.noCameraCard, isNight ? driveStyles.glassNightStrong : driveStyles.glassDay]}>
              <View style={{ flex: 1 }}>
                <Text style={[driveStyles.noCameraTitle, isNight ? driveStyles.textWhite : driveStyles.textDark]}>{maneuver.distanceLabel}</Text>
                {!!maneuver.instruction && <Text style={[driveStyles.noCameraSub, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>{maneuver.instruction}</Text>}
                {!!maneuver.remainingLabel && <Text style={[driveStyles.noCameraSub, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>{language === "en" ? "Remaining" : language === "pl" ? "Pozostało" : language === "uk" ? "Залишилось" : "Осталось"} {maneuver.remainingLabel}</Text>}
                {!!maneuver.arrivalLabel && <Text style={[driveStyles.noCameraSub, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>{language === "en" ? "Arrival" : language === "pl" ? "Przyjazd" : language === "uk" ? "Прибуття" : "Прибытие"} {maneuver.arrivalLabel}</Text>}
                {!!maneuver.arrivalLabel && <Text style={[driveStyles.noCameraSub, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>{language === "en" ? "Scaled from the last Apple estimate. Not live traffic." : language === "pl" ? "Przeliczone z ostatniego szacunku Apple. To nie są aktualne korki." : language === "uk" ? "Перерахунок останньої оцінки Apple. Не поточні затори." : "Пересчёт последней оценки Apple. Не текущие пробки."}</Text>}
              </View>
            </View>
          )}
          {onOpenRoute && (
            <Pressable accessibilityRole="button" accessibilityLabel={copy.route} onPress={onOpenRoute} style={[driveStyles.routeButton, pad && { minHeight: 64, borderRadius: 20 }]}>
              <Text style={[driveStyles.routeButtonText, pad && { fontSize: 20 }]}>{copy.route}</Text>
            </Pressable>
          )}
          {onEndRoute && (
            <Pressable accessibilityRole="button" onPress={onEndRoute} style={driveStyles.retryButton}>
              <Text style={driveStyles.retryText}>{language === "en" ? "End route" : language === "pl" ? "Zakończ trasę" : language === "uk" ? "Завершити маршрут" : "Завершить маршрут"}</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" onPress={onStop} style={({ pressed }) => [driveStyles.stopButton, pad && { minHeight: 64, borderRadius: 20 }, pressed && driveStyles.stopButtonPressed]}>
            <Text style={[driveStyles.stopButtonText, pad && { fontSize: 20 }]}>{copy.stop}</Text>
          </Pressable>
          </View>
      </SystemSafeArea>
      {expandedWarning && (
        <View pointerEvents="box-none" style={[driveStyles.warningOverlay, pad && { left: 40, right: 40, top: "18%" }]}>
          <CameraWarningPanel
            camera={camera}
            currentSpeedKmh={speedKmh}
            speedAvailable={speedAvailable}
            threshold={currentThreshold}
            language={language}
            theme={theme}
            voiceEnabled={voiceEnabled}
            vibrationEnabled={vibrationEnabled}
            onDismiss={onDismissWarning}
          />
        </View>
      )}
    </View>
  );
}

function CameraAlertCompact({ camera, language, theme, danger = false, proximity, threshold, demo = false, speedKmh, speedAvailable }) {
  const isNight = theme !== "day";
  const [details,setDetails]=useState(false);
  useEffect(()=>setDetails(false),[camera?.id]);
  const copy=uiCopy(language);
  const over=isSpeedOverLimit(speedKmh,speedAvailable,camera?.speed_limit);
  const labels = {
    ru: { ahead: "Камера впереди", limit: "Лимит камеры" },
    uk: { ahead: "Камера попереду", limit: "Обмеження камери" },
    en: { ahead: "Camera ahead", limit: "Camera limit" },
    pl: { ahead: "Fotoradar przed Tobą", limit: "Limit fotoradaru" },
  };
  const text = labels[language] || labels.ru;
  const { pad } = usePadLayout();
  const progress = proximity == null
    ? Number.isFinite(Number(camera?.distance)) && threshold > 0 ? Math.max(0, Math.min(1, 1 - Number(camera.distance) / threshold)) : null
    : proximity;

  return (
    <View style={[driveStyles.cameraCard, pad && { paddingHorizontal: 20, paddingVertical: 18, borderRadius: 24 }, isNight ? driveStyles.glassNightStrong : driveStyles.glassDay, danger && driveStyles.cameraCardDanger, over && {borderColor:"#E14A38"}, demo && driveStyles.demoCameraCard]}>
      <View style={driveStyles.cameraCardTop}>
        <View style={[driveStyles.cameraIconWrap, danger && driveStyles.cameraIconWrapDanger]}><Text style={driveStyles.cameraIcon}>{cameraGlyph(camera)}</Text></View>
        <View style={driveStyles.cameraTextBlock}>
          <Text style={[driveStyles.cameraEyebrow, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>{demo ? (ALERT_PREVIEW_COPY[language] || ALERT_PREVIEW_COPY.ru).example : text.ahead}</Text>
          <Text numberOfLines={1} style={[driveStyles.cameraLocation, pad && { fontSize: 20, lineHeight: 26 }, isNight ? driveStyles.textWhite : driveStyles.textDark]}>{camera?.location || camera?.road_index || camera?.region || cameraTypeLabel(camera || {}, language)}</Text>
          <Text numberOfLines={1} style={[driveStyles.cameraType, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>
            {cameraTypeLabel(camera || {}, language)}{camera?.speed_limit != null ? ` · ${text.limit}: ${camera.speed_limit}` : ""}
          </Text>
        </View>
        <View style={driveStyles.distanceBlock}>
          <Text style={[driveStyles.distanceValue, pad && { fontSize: 32, lineHeight: 38 }, danger ? isNight ? driveStyles.warningText : driveStyles.warningTextDay : isNight ? driveStyles.textWhite : driveStyles.textDark]}>{formatRoadDistance(camera?.distance)}</Text>
        </View>
      </View>
      <SpeedState speed={speedKmh} available={speedAvailable} limit={camera?.speed_limit} language={language} night={isNight} />
      <Pressable accessibilityRole="button" accessibilityState={{expanded:details}} onPress={()=>setDetails(!details)} style={{minHeight:48,justifyContent:"center"}}><Text style={{color:isNight?"#23D3EF":"#1260E8"}}>{details?copy.close:copy.details}</Text></Pressable>
      {details && <Text style={{color:isNight?"#CAD7E7":"#24445B"}}>{[camera?.region,camera?.road_index,`${copy.direction}: ${directionLabel(camera?.direction,language)}${camera?.direction!=null && Number.isFinite(Number(camera.direction))?` (${camera.direction}°)`:""}`,camera?.id != null ? `ID: ${camera.id}` : null].filter(Boolean).join(" · ")}</Text>}
      <View style={[driveStyles.progressTrack, isNight ? driveStyles.progressTrackNight : driveStyles.progressTrackDay]}>
        {progress != null && <View style={[driveStyles.progressFill, danger && driveStyles.progressFillDanger, { width: `${Math.round(progress * 100)}%` }]} />}
      </View>
    </View>
  );
}

function CameraWarningPanel({
  camera, currentSpeedKmh, speedAvailable, threshold, language, theme,
  voiceEnabled, vibrationEnabled, demo = false, onDismiss,
}) {
  const isNight = theme !== "day";
  const { pad } = usePadLayout();
  const overLimit = isSpeedOverLimit(currentSpeedKmh, speedAvailable, camera?.speed_limit);
  const distance = Number(camera?.distance);
  const progress = Number.isFinite(distance) && threshold > 0
    ? Math.max(0, Math.min(1, 1 - distance / threshold)) : null;
  const labels = {
    ru: { attention: "Внимание!", ahead: "Камера впереди", reduce: "Снизьте скорость до разрешённой", camera: "Камера контроля скорости", cameraLimit: "Лимит камеры", speed: "Скорость", voice: "Голосовое предупреждение", voiceOff: "Звук выключен", vib: "Вибрация включена", vibOff: "Оповещения выключены", fold: "Свернуть", unknown: "Лимит не указан", close: "Закрыть" },
    uk: { attention: "Увага!", ahead: "Камера попереду", reduce: "Зменште швидкість до дозволеної", camera: "Камера контролю швидкості", cameraLimit: "Обмеження камери", speed: "Швидкість", voice: "Голосове попередження", voiceOff: "Звук вимкнено", vib: "Вібрацію увімкнено", vibOff: "Сповіщення вимкнено", fold: "Згорнути", unknown: "Обмеження не вказано", close: "Закрити" },
    en: { attention: "Attention", ahead: "Camera ahead", reduce: "Reduce speed to the posted limit", camera: "Speed camera", cameraLimit: "Camera limit", speed: "Speed", voice: "Voice warning on", voiceOff: "Sound off", vib: "Vibration on", vibOff: "Alerts off", fold: "Collapse", unknown: "Limit unavailable", close: "Close" },
    pl: { attention: "Uwaga!", ahead: "Fotoradar przed Tobą", reduce: "Zwolnij do dozwolonej prędkości", camera: "Kontrola prędkości", cameraLimit: "Limit fotoradaru", speed: "Prędkość", voice: "Ostrzeżenie głosowe", voiceOff: "Dźwięk wyłączony", vib: "Wibracje włączone", vibOff: "Powiadomienia wyłączone", fold: "Zwiń", unknown: "Brak limitu", close: "Zamknij" },
  };
  const text = labels[language] || labels.ru;
  const audioStatus = voiceEnabled ? text.voice : vibrationEnabled ? text.vib : text.voiceOff;
  const displayDistance = Number.isFinite(distance) ? formatRoadDistance(distance) : "—";

  return (
    <View style={[driveStyles.warningPanel, pad && { maxWidth: 520, paddingHorizontal: 28, paddingTop: 22, paddingBottom: 14, borderRadius: 32 }, isNight ? driveStyles.warningPanelNight : driveStyles.warningPanelDay]}>
      <View style={driveStyles.warningHeader}>
        <Text style={[driveStyles.warningTitle, pad && { fontSize: 32, lineHeight: 38 }, isNight ? driveStyles.textWhite : driveStyles.textDark, demo && { marginRight: 128 }]}>{text.attention}</Text>
        {demo ? <View style={driveStyles.demoBadge}><Text style={driveStyles.demoBadgeText}>{(ALERT_PREVIEW_COPY[language] || ALERT_PREVIEW_COPY.ru).example}</Text></View> : null}
      </View>
      <View style={driveStyles.warningIconGlow}>
        <View style={driveStyles.warningIconInner}><Text style={driveStyles.warningIcon}>{cameraGlyph(camera)}</Text></View>
      </View>
      <Text style={[driveStyles.warningDistance, pad && { fontSize: 68, lineHeight: 74 }, isNight ? driveStyles.textWhite : driveStyles.textDark]}>{displayDistance}</Text>
      <Text style={[driveStyles.warningCameraType, pad && { fontSize: 18, lineHeight: 24 }, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>{cameraTypeLabel(camera || {}, language) || text.camera}</Text>
      <View style={[driveStyles.warningProgressTrack, isNight ? driveStyles.progressTrackNight : driveStyles.progressTrackDay]}>
        {progress != null && <View style={[driveStyles.warningProgressFill, { width: `${Math.round(progress * 100)}%` }]} />}
      </View>
      <View style={driveStyles.warningMetrics}>
        <View style={[driveStyles.warningMetric, isNight ? driveStyles.glassNight : driveStyles.glassDay]}>
          <Text style={[driveStyles.warningMetricValue, pad && { fontSize: 42, lineHeight: 48 }, overLimit ? driveStyles.warningText : isNight ? driveStyles.textWhite : driveStyles.textDark]}>{speedAvailable ? currentSpeedKmh : "—"}</Text>
          <Text style={[driveStyles.warningMetricLabel, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>{text.speed} · км/ч</Text>
        </View>
        <View style={[driveStyles.warningMetric, isNight ? driveStyles.glassNight : driveStyles.glassDay]}>
          {camera?.speed_limit != null ? (
            <>
              <View style={[driveStyles.warningLimitSign, overLimit && driveStyles.warningLimitSignOver]}><Text style={driveStyles.warningLimitValue}>{camera.speed_limit}</Text></View>
              <Text style={[driveStyles.warningMetricLabel, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>{text.cameraLimit}</Text>
            </>
          ) : <Text style={[driveStyles.warningUnknownLimit, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>{text.unknown}</Text>}
        </View>
      </View>
      <View style={[driveStyles.warningStatus, overLimit ? driveStyles.warningStatusOver : driveStyles.warningStatusNormal]}>
        <Text style={[driveStyles.warningStatusTitle, pad && { fontSize: 18, lineHeight: 24 }, overLimit && driveStyles.warningStatusTitleOver]}>{overLimit ? text.reduce : text.ahead}</Text>
        <Text style={[driveStyles.warningStatusSub, overLimit && driveStyles.warningStatusSubOver]}>{demo ? text.voiceOff : audioStatus}</Text>
      </View>
      {onDismiss && (
        <Pressable accessibilityRole="button" accessibilityLabel={demo ? text.close : text.fold} onPress={onDismiss} style={driveStyles.warningDismiss}>
          <Text style={[driveStyles.warningDismissText, isNight ? driveStyles.textMuted : driveStyles.textMutedDay]}>{demo ? text.close : text.fold}</Text>
        </Pressable>
      )}
    </View>
  );
}

function DriveHome({ language, country, cameraCount, offlineAvailable, lastDataUpdate, onBack, onStart, onOpenRoute, onChooseNavigator, onSettings, onCountry }) {
  const isNight = useContext(ThemeContext);
  const homeStyles = useMemo(() => homeThemeStyles(isNight),[isNight]);
  const { pad, landscape } = usePadLayout();
  const copy = DRIVE_HOME_COPY[language] || DRIVE_HOME_COPY.ru;
  const [locationPermission, setLocationPermission] = useState("checking");

  useEffect(() => {
    let current = true;
    Location.getForegroundPermissionsAsync()
      .then(permission => { if (current) setLocationPermission(permission.status); })
      .catch(() => { if (current) setLocationPermission("unknown"); });
    return () => { current = false; };
  }, []);

  const isLocationGranted = locationPermission === "granted";
  const countryCode = String(country || "UA").toUpperCase();
  const flag = countryFlag(countryCode);
  const countryName = countryDisplayName(countryCode,language);
  const locale = language === "uk" ? "uk-UA" : language === "pl" ? "pl-PL" : language === "en" ? "en-US" : "ru-RU";
  const updateLabel = `${cameraCount.toLocaleString(locale)} ${copy.cameras}`;
  const navigatorOptions = [
    { key: "alerts", label: "CamAlert" },
    ...(Platform.OS === "ios" ? [{ key: "apple", label: "Apple Maps", icon: "⌖", iconStyle: homeStyles.appleIcon }] : []),
    { key: "google", label: "Google Maps", icon: "📍", iconStyle: homeStyles.googleIcon },
  ];

  const header = (
      <View style={homeStyles.header}>
        <PageBackButton language={language} onPress={onBack} onLight={!isNight} />
        <View style={homeStyles.brandLockup}>
          <View style={homeStyles.brandMark}><Text style={homeStyles.brandMarkText}>A</Text></View>
          <Text maxFontSizeMultiplier={1.2} adjustsFontSizeToFit numberOfLines={1} style={[homeStyles.brand,{flexShrink:1}]}><Text style={homeStyles.brandCam}>Cam</Text><Text style={homeStyles.brandAlert}>Alert</Text></Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.settings} onPress={onSettings} style={homeStyles.settingsButton}>
          <Text style={homeStyles.settingsGlyph}>⚙</Text>
        </Pressable>
      </View>
  );
  const status = (
      <View style={homeStyles.statusRow}>
        <View style={[homeStyles.statusCard, pad && { minHeight: 78, paddingVertical: 12 }]}>
          <Text style={[homeStyles.statusIcon, pad && { fontSize: 34 }]}>⌖</Text>
          <View style={homeStyles.statusCopy}>
            <Text style={[homeStyles.statusTitle, pad && { fontSize: 16 }]}>{copy.gps}</Text>
            <View style={homeStyles.statusValueRow}>
              <View style={[homeStyles.statusDot, isLocationGranted ? homeStyles.statusDotReady : homeStyles.statusDotIdle]} />
              <Text style={[homeStyles.statusValue, pad && { fontSize: 14 }]}>{isLocationGranted ? copy.gpsReady : copy.gpsNeeded}</Text>
            </View>
          </View>
        </View>
        <View style={[homeStyles.statusCard, pad && { minHeight: 78, paddingVertical: 12 }]}>
          <Text style={[homeStyles.databaseIcon, pad && { fontSize: 30 }]}>▤</Text>
          <View style={homeStyles.statusCopy}>
            <Text style={[homeStyles.statusTitle, pad && { fontSize: 16 }]}>{copy.database}</Text>
            <View style={homeStyles.statusValueRow}>
              <View style={[homeStyles.statusDot, homeStyles.statusDotReady]} />
              <Text style={[homeStyles.statusValue, pad && { fontSize: 14 }]}>{lastDataUpdate ? copy.databaseReady : copy.localDatabase}</Text>
            </View>
          </View>
        </View>
      </View>
  );
  const hero = (
      <ImageBackground
        source={require("./assets/onboarding-window-view.png")}
        resizeMode="cover"
        imageStyle={homeStyles.heroImage}
        style={[homeStyles.hero, pad && { flex: 1, height: undefined, minHeight: landscape ? 240 : 340 }]}
        accessible={false}
      >
        <View pointerEvents="none" style={homeStyles.heroShade} />
        <Text style={homeStyles.heroCar}>🚙</Text>
        <View style={homeStyles.heroRoadMark} />
      </ImageBackground>
  );
  const intro = (
      <View style={homeStyles.intro}>
        <Text style={[homeStyles.title, pad && { fontSize: 48, lineHeight: 54 }]}>{copy.title}</Text>
        <Text style={[homeStyles.subtitle, pad && { fontSize: 22, lineHeight: 28, marginTop: 6 }]}>{copy.subtitle}</Text>
      </View>
  );
  const start = (
      <Pressable
        accessibilityRole="button"
        onPress={onStart}
        style={({ pressed }) => [homeStyles.startButton, pad && { minHeight: 76 }, pressed && homeStyles.startButtonPressed]}
      >
        <Text style={[homeStyles.playIcon, pad && { fontSize: 22 }]}>▶</Text>
        <Text style={[homeStyles.startButtonText, pad && { fontSize: 22 }]}>{copy.start}</Text>
      </Pressable>
  );
  const whereTo = Platform.OS === "ios" && onOpenRoute ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.where}
        onPress={onOpenRoute}
        style={({ pressed }) => [homeStyles.whereButton, pad && { minHeight: 64 }, pressed && homeStyles.whereButtonPressed]}
      >
        <Text style={[homeStyles.whereButtonText, pad && { fontSize: 22 }]}>{copy.where}</Text>
      </Pressable>
  ) : null;
  const navigation = (
      <View style={homeStyles.navSection}>
        <Text style={[homeStyles.sectionTitle, pad && { fontSize: 18 }]}>{copy.chooseNav}</Text>
        <View style={homeStyles.navigatorRow}>
          {navigatorOptions.map(option => (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              onPress={option.key === "alerts" ? (Platform.OS === "ios" && onOpenRoute ? onOpenRoute : onStart) : (onChooseNavigator || onStart)}
              style={({ pressed }) => [homeStyles.navigatorCard, pad && { minHeight: 118, paddingVertical: 16 }, pressed && homeStyles.navigatorPressed]}
            >
              <View style={[homeStyles.navigatorIconBox, pad && { width: 52, height: 52, borderRadius: 16 }]}>
                {option.key === "alerts"
                  ? <Image source={require("./assets/icon.png")} style={{width:40,height:40,borderRadius:10}} accessible={false} />
                  : <Text style={[homeStyles.navigatorIcon, option.iconStyle]}>{option.icon}</Text>}
              </View>
              <Text numberOfLines={2} style={[homeStyles.navigatorLabel, pad && { fontSize: 15, lineHeight: 19 }]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[homeStyles.navNote, pad && { fontSize: 14, lineHeight: 19 }]}>{copy.navNote}</Text>
      </View>
  );
  const countryCard = (
      <Pressable accessibilityRole="button" onPress={onCountry} style={[homeStyles.countryCard, pad && { minHeight: 108, paddingVertical: 16 }]}>
        <Text style={[homeStyles.countryFlag, pad && { fontSize: 48, lineHeight: 56 }]}>{flag}</Text>
        <View style={homeStyles.countryCopy}>
          <Text style={[homeStyles.countryName, pad && { fontSize: 20 }]}>{countryName} · {cameraCount > 0 ? copy.baseLoaded : copy.databaseMissing}</Text>
          <Text style={[homeStyles.countryMeta, pad && { fontSize: 16, marginTop: 4 }]}>{offlineAvailable ? copy.offlineAvailable : copy.offlineUnknown}</Text>
          <Text style={[homeStyles.countryUpdate, pad && { fontSize: 14, marginTop: 4 }]}>{updateLabel}</Text>
        </View>
        <Text style={homeStyles.countryChevron}>›</Text>
      </Pressable>
  );

  if (pad) {
    return (
      <View style={[homeStyles.screen, { flex: 1, gap: 18 }]}>
        {header}
        <View style={{ flex: 1, flexDirection: "row", gap: 24 }}>
          <View style={{ flex: 1.15, gap: 16 }}>{hero}{intro}{start}{whereTo}</View>
          <View style={{ flex: 1, gap: 18, justifyContent: "center" }}>{status}{navigation}{countryCard}</View>
        </View>
      </View>
    );
  }

  return (
    <View style={homeStyles.screen}>
      {header}
      {status}
      {hero}
      {intro}
      {start}
      {whereTo}
      {navigation}
      {countryCard}
    </View>
  );
}

function CountriesDataScreen({ language, theme, countries, search, onSearch, onSelect, onRemove, downloadedCount, publishedAt, checkedAt }) {
  const countriesStyles = baseCountriesStyles;
  const copy = COUNTRY_SCREEN_COPY[language] || COUNTRY_SCREEN_COPY.ru;
  const isNight = theme === "night";
  const { pad, width } = usePadLayout();
  const columns = !pad ? 1 : width >= 1100 ? 3 : 2;
  return (
    <View style={countriesStyles.content}>
      <Text style={[countriesStyles.noteTitle,isNight&&countriesStyles.textNight]}>{({ru:"Сохранено стран",uk:"Збережено країн",en:"Saved countries",pl:"Zapisane kraje"})[language] || "Saved countries"}: {downloadedCount} / 2</Text>
      <Text style={[countriesStyles.noteText,isNight&&countriesStyles.mutedNight]}>{({ru:"Для загрузки третьей страны сначала удалите одну базу.",uk:"Щоб завантажити третю країну, спочатку видаліть одну базу.",en:"Delete one database before downloading a third country.",pl:"Usuń jedną bazę przed pobraniem trzeciego kraju."})[language] || "Delete one database before downloading a third country."}</Text>
      <TextInput
        value={search}
        onChangeText={onSearch}
        placeholder={copy.search}
        placeholderTextColor={isNight ? "#8FA3B8" : "#8493A5"}
        style={[countriesStyles.search,isNight&&countriesStyles.searchNight]}
        accessibilityLabel={copy.search}
      />
      <View style={pad ? { flexDirection: "row", flexWrap: "wrap", gap: 12 } : { gap: 10 }}>
      {countries.map(item=>(
        <View key={item.code} style={[countriesStyles.countryShell,isNight&&countriesStyles.countryCardNight,item.selected&&countriesStyles.countrySelected, pad && { width: columns === 3 ? "31.5%" : "48.5%", flexGrow: 1 }]}>
        <Pressable accessibilityRole="button" accessibilityState={{selected:item.selected}} onPress={()=>onSelect(item.code)} style={countriesStyles.countryCard}>
          <Text style={countriesStyles.flag}>{countryFlag(item.code)}</Text>
          <View style={countriesStyles.countryCopy}>
            <Text style={[countriesStyles.countryName,isNight&&countriesStyles.textNight, pad && { fontSize: 18 }]}>{item.name}</Text>
            <Text style={[countriesStyles.countryCount,isNight&&countriesStyles.mutedNight, pad && { fontSize: 15 }]}>{item.count==null?copy.countUnavailable:`${item.count.toLocaleString()} ${copy.cameras}`}</Text>
            <Text style={[countriesStyles.countryStatus,item.offline?countriesStyles.offlineStatus:isNight?countriesStyles.mutedNight:countriesStyles.countryCount]}>
              {item.loading ? copy.loading : item.offline ? copy.offline : copy.tapToDownload}
            </Text>
          </View>

          <View style={countriesStyles.statusMark}>
            {item.loading ? <ActivityIndicator size="small" color="#1260E8" /> : <Text style={[countriesStyles.check,item.offline?countriesStyles.checkReady:countriesStyles.checkPending]}>{item.offline?"✓":"↓"}</Text>}
          </View>
        </Pressable>
          {item.offline && <Pressable accessibilityRole="button" disabled={item.loading} onPress={event => {event.stopPropagation();onRemove(item.code);}} style={countriesStyles.deleteButton}>
            <Text maxFontSizeMultiplier={1.45} style={[countriesStyles.deleteLabel,{color:isNight?"#FF9B9B":"#B52132"}]}>{({ru:"Удалить базу",uk:"Видалити базу",en:"Delete database",pl:"Usuń bazę"})[language] || "Delete database"}</Text>
          </Pressable>}
        </View>
      ))}
      </View>
      {!countries.length && <Text style={[countriesStyles.empty,isNight&&countriesStyles.mutedNight]}>{copy.noCountries}</Text>}
      <View style={[countriesStyles.noteCard,isNight&&countriesStyles.countryCardNight]}>
        <Text style={[countriesStyles.noteTitle,isNight&&countriesStyles.textNight]}>{copy.offlineTitle}</Text>
        <Text style={[countriesStyles.noteText,isNight&&countriesStyles.mutedNight]}>{copy.offlineNote}</Text>
        <Text maxFontSizeMultiplier={1.6} style={[countriesStyles.lastUpdate,isNight&&countriesStyles.mutedNight]}>{copy.version} {formatCatalogDate(publishedAt, language) || "—"}</Text>
        <Text maxFontSizeMultiplier={1.6} style={[countriesStyles.lastUpdate,isNight&&countriesStyles.mutedNight]}>{copy.checked} {formatCatalogDate(checkedAt, language, true) || "—"}</Text>
      </View>
    </View>
  );
}

const COUNTRY_SCREEN_COPY = {
  ru: { search:"Найти страну", cameras:"камер", countUnavailable:"Количество камер неизвестно", offline:"Доступна без интернета", loading:"Загружается…", tapToDownload:"Нажмите, чтобы выбрать и загрузить", noCountries:"Страны не найдены", offlineTitle:"Доступность офлайн", offlineNote:"Показываем офлайн-статус только для баз, сохранённых на устройстве или встроенных в приложение.", version:"Версия базы:", checked:"Последняя проверка:" },
  uk: { search:"Знайти країну", cameras:"камер", countUnavailable:"Кількість камер невідома", offline:"Доступна без інтернету", loading:"Завантажується…", tapToDownload:"Натисніть, щоб вибрати й завантажити", noCountries:"Країн не знайдено", offlineTitle:"Доступність офлайн", offlineNote:"Офлайн-статус показуємо лише для баз, збережених на пристрої або вбудованих у застосунок.", version:"Версія бази:", checked:"Остання перевірка:" },
  en: { search:"Find a country", cameras:"cameras", countUnavailable:"Camera count unavailable", offline:"Available offline", loading:"Loading…", tapToDownload:"Tap to select and download", noCountries:"No countries found", offlineTitle:"Offline availability", offlineNote:"Offline status is shown only for databases saved on this device or bundled with the app.", version:"Database version:", checked:"Last check:" },
  pl: { search:"Znajdź kraj", cameras:"kamer", countUnavailable:"Liczba kamer niedostępna", offline:"Dostępna offline", loading:"Pobieranie…", tapToDownload:"Dotknij, aby wybrać i pobrać", noCountries:"Nie znaleziono krajów", offlineTitle:"Dostępność offline", offlineNote:"Status offline pokazujemy tylko dla baz zapisanych na urządzeniu lub dołączonych do aplikacji.", version:"Wersja bazy:", checked:"Ostatnie sprawdzenie:" },
};

function NavigatorPickerSheet({ visible, language, platform, destination, onDestinationChange, onSelect, onAlertsOnly, onClose }) {
  const isNight = useContext(ThemeContext);
  const navigatorStyles = themedStyles(baseNavigatorStyles, !isNight, {
    sheet:{backgroundColor:"#F7FAFF",borderColor:"#DCE5EF"},
    title:{color:"#102A4D"},optionTitle:{color:"#102A4D"},cancelText:{color:"#1260E8"},
    subtitle:{color:"#526A80"},hint:{color:"#526A80"},optionSubtitle:{color:"#526A80"},footnote:{color:"#526A80"},
    destinationInput:{backgroundColor:"#FFFFFF",borderColor:"#DCE5EF",color:"#102A4D"},
    option:{backgroundColor:"#FFFFFF",borderColor:"#DCE5EF"},optionPressed:{backgroundColor:"#E5F8FC"},optionIcon:{backgroundColor:"#EAF2FA"},
  });
  const { pad } = usePadLayout();
  const copy = NAVIGATOR_SHEET_COPY[language] || NAVIGATOR_SHEET_COPY.ru;
  const options = [
    { id: "alerts", name: "CamAlert", action: copy.alertsSubtitle },
    ...(platform === "ios" ? [
      { id: "inapp", icon: "➤", name: copy.routeInApp, action: copy.routeInAppAction },
      { id: "apple", icon: "⌖", name: "Apple Maps", action: copy.openApple },
    ] : []),
    { id: "google", icon: "📍", name: "Google Maps", action: platform === "android" ? navigationCopy(language).title : copy.openGoogle },
  ];

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={navigatorStyles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.close} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[navigatorStyles.sheet, pad && { width: "100%", maxWidth: 680, alignSelf: "center", borderRadius: 28 }]}>
          <PageBackButton language={language} onPress={onClose} onLight={!isNight} />
          <View style={navigatorStyles.handle} />
          <Text style={navigatorStyles.title}>{copy.title}</Text>
          <Text style={navigatorStyles.subtitle}>{platform === "android" ? navigationCopy(language).choose : copy.subtitle}</Text>
          <TextInput
            accessibilityLabel={copy.destination}
            value={destination}
            onChangeText={onDestinationChange}
            placeholder={copy.destinationPlaceholder}
            placeholderTextColor="#8194A8"
            returnKeyType="done"
            autoCapitalize="words"
            style={navigatorStyles.destinationInput}
          />
          <Text style={navigatorStyles.hint}>{copy.destinationHint}</Text>
          <View style={navigatorStyles.options}>
            {options.map(option => (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={`${option.name}. ${option.action}`}
                onPress={() => option.id === "alerts" ? onAlertsOnly() : onSelect(option.id, destination)}
                style={({ pressed }) => [navigatorStyles.option, pressed && navigatorStyles.optionPressed]}
              >
                <View style={navigatorStyles.optionIcon}>
                  {option.id === "alerts"
                    ? <Image source={require("./assets/icon.png")} style={{width:40,height:40,borderRadius:10}} accessible={false} />
                    : <Text style={navigatorStyles.optionIconText}>{option.icon}</Text>}
                </View>
                <View style={navigatorStyles.optionCopy}>
                  <Text style={navigatorStyles.optionTitle}>{option.name}</Text>
                  <Text style={navigatorStyles.optionSubtitle}>{option.action}</Text>
                </View>
                <Text style={navigatorStyles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
          <Text style={navigatorStyles.footnote}>{platform === "android" ? navigationCopy(language).internet : copy.backgroundNote}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={navigatorStyles.cancelButton}>
            <Text style={navigatorStyles.cancelText}>{copy.cancel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const NAVIGATOR_SHEET_COPY = {
  ru: {
    title: "Выберите навигатор", subtitle: "Поездка без цели остаётся основной кнопкой. Здесь можно построить маршрут в CamAlert или передать цель в другое приложение.",
    routeInApp: "Маршрут в CamAlert", routeInAppAction: "Адрес, варианты Apple и ведение",
    destination: "Пункт назначения", destinationPlaceholder: "Адрес или координаты",
    destinationHint: "Необязательно · координаты укажите как широта, долгота",
    openApple: "Открыть в Apple Maps", openGoogle: "Открыть в Google Maps",
    alerts: "Только предупреждения", alertsSubtitle: "Карта и предупреждения", backgroundNote: "Перед открытием навигатора CamAlert запросит разрешения и включит фоновую сессию. Остановить её можно в настройках.",
    cancel: "Отмена", close: "Закрыть выбор навигатора",
  },
  uk: {
    title: "Оберіть навігатор", subtitle: "Поїздка без цілі лишається основною кнопкою. Тут можна побудувати маршрут у CamAlert або передати ціль в іншу програму.",
    routeInApp: "Маршрут у CamAlert", routeInAppAction: "Адреса, варіанти Apple і ведення",
    destination: "Пункт призначення", destinationPlaceholder: "Адреса або координати",
    destinationHint: "Необов’язково · координати: широта, довгота",
    openApple: "Відкрити в Apple Maps", openGoogle: "Відкрити в Google Maps",
    alerts: "Лише попередження", alertsSubtitle: "Карта та попередження", backgroundNote: "Перед відкриттям навігатора CamAlert увімкне фонову сесію. Зупинити її можна в налаштуваннях.",
    cancel: "Скасувати", close: "Закрити вибір навігатора",
  },
  en: {
    title: "Choose a navigator", subtitle: "A trip without a destination stays the main button. Build a route in CamAlert or pass the destination to another app.",
    routeInApp: "Route in CamAlert", routeInAppAction: "Address, Apple alternatives, and guidance",
    destination: "Destination", destinationPlaceholder: "Address or coordinates",
    destinationHint: "Optional · enter coordinates as latitude, longitude",
    openApple: "Open in Apple Maps", openGoogle: "Open in Google Maps",
    alerts: "CamAlert alerts only", alertsSubtitle: "Map and alerts", backgroundNote: "CamAlert checks permissions and starts a background session before opening navigation. Stop it in Settings.",
    cancel: "Cancel", close: "Close navigator selection",
  },
  pl: {
    title: "Wybierz nawigację", subtitle: "Podróż bez celu zostaje głównym przyciskiem. Tu można wyznaczyć trasę w CamAlert albo przekazać cel do innej aplikacji.",
    routeInApp: "Trasa w CamAlert", routeInAppAction: "Adres, warianty Apple i prowadzenie",
    destination: "Cel podróży", destinationPlaceholder: "Adres lub współrzędne",
    destinationHint: "Opcjonalnie · współrzędne: szerokość, długość",
    openApple: "Otwórz w Apple Maps", openGoogle: "Otwórz w Google Maps",
    alerts: "Tylko ostrzeżenia", alertsSubtitle: "Mapa i ostrzeżenia", backgroundNote: "CamAlert uruchomi sesję w tle przed otwarciem nawigacji. Zatrzymaj ją w ustawieniach.",
    cancel: "Anuluj", close: "Zamknij wybór nawigacji",
  },
};

function BrowseMap({ coords, cameras, showLocation, currentThreshold, active, showCameras = true }) {
  const isNight = useContext(ThemeContext);
  const s = baseAppStyles;
  const { pad, width, height } = usePadLayout();
  const mapHeight = pad ? Math.max(640, Math.min(height - 320, 980)) : 560;
  const mapWidth = Math.max(280, width - (pad ? 56 : 36));
  const mapRef = useRef(null);
  const points = (showCameras ? cameras : []).filter(camera => !camera._example_only
    && camera.latitude != null && camera.longitude != null
    && Number.isFinite(Number(camera.latitude)) && Number.isFinite(Number(camera.longitude))
    && Math.abs(Number(camera.latitude)) <= 90 && Math.abs(Number(camera.longitude)) <= 180);
  const hasPosition = coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude);
  let region = {latitude:30,longitude:15,latitudeDelta:100,longitudeDelta:100};
  if (hasPosition) {
    region = {...coords,latitudeDelta:0.18,longitudeDelta:0.18};
  } else if (points.length) {
    let south=90,north=-90,west=180,east=-180;
    for (const point of points) {
      south=Math.min(south,Number(point.latitude)); north=Math.max(north,Number(point.latitude));
      west=Math.min(west,Number(point.longitude)); east=Math.max(east,Number(point.longitude));
    }
    region={latitude:(south+north)/2,longitude:(west+east)/2,
      latitudeDelta:Math.min(170,Math.max(0.1,(north-south)*1.2)),
      longitudeDelta:Math.min(350,Math.max(0.1,(east-west)*1.2))};
  }
  // Browsing never requests GPS or starts tracking. Markers follow the visible area and zoom.
  const [viewport,setViewport]=useState(region);
  const [trackMarkers,setTrackMarkers]=useState(true);
  const visible=points.filter(point => Math.abs(Number(point.latitude)-viewport.latitude)<=viewport.latitudeDelta/2
    && Math.abs(Number(point.longitude)-viewport.longitude)<=viewport.longitudeDelta/2);
  const mapRegion={...viewport,width:mapWidth,height:mapHeight};
  const items=clusterMapPoints(visible,mapRegion);
  const pinSize=markerPixelSize(viewport.latitudeDelta);
  useEffect(()=>{
    setTrackMarkers(true);
    const timer=setTimeout(()=>setTrackMarkers(false),400);
    return ()=>clearTimeout(timer);
  },[isNight,pinSize]);
  return <MapView ref={mapRef} style={[s.map, { height: mapHeight }]} userInterfaceStyle={isNight?"dark":"light"} customMapStyle={isNight?NIGHT_MAP_STYLE:[]} initialRegion={region} showsUserLocation={showLocation}
    onRegionChangeComplete={setViewport}>
    {items.map(item => item.kind === "cluster"
      ? <Marker key={`cluster:${item.latitude.toFixed(5)}:${item.longitude.toFixed(5)}:${item.count}`}
          coordinate={{latitude:item.latitude,longitude:item.longitude}}
          anchor={{x:0.5,y:0.5}} tracksViewChanges={trackMarkers}
          onPress={()=>mapRef.current?.animateToRegion(clusterFocusRegion(item,mapRegion),280)}>
          <MapCameraPin count={item.count} size={pinSize} night={isNight} />
        </Marker>
      : <Marker key={`${item.camera.id ?? "camera"}:${item.latitude}:${item.longitude}`}
          coordinate={{latitude:item.latitude,longitude:item.longitude}}
          anchor={{x:0.5,y:0.5}} tracksViewChanges={trackMarkers}
          title={item.camera.location || item.camera.name || item.camera.road_index || item.camera.region}
          description={item.camera.speed_limit != null ? `${item.camera.speed_limit} км/ч` : undefined}>
          <MapCameraPin camera={item.camera} size={pinSize} night={isNight} />
        </Marker>)}
    {showCameras && active && hasPosition && <Circle center={coords} radius={currentThreshold} />}
  </MapView>;
}

function RoadCamerasScreen({ country, language, feed, userCoords, onCountries, showCameras = true }) {
  const isNight = useContext(ThemeContext);
  const rc = themedStyles(baseRoadStyles,isNight,{
    sectionTitle:{color:"#FFFFFF"},sectionHint:{color:"#CAD7E7"},
    selectedCard:{backgroundColor:"#172A40",borderColor:"#29435A"},cameraTitle:{color:"#FFFFFF"},cameraDirection:{color:"#CAD7E7"},metaValue:{color:"#CAD7E7"},
    cameraListRow:{backgroundColor:"#172A40",borderColor:"#29435A"},cameraListSelected:{backgroundColor:"#29435A",borderColor:"#23D3EF"},
    listName:{color:"#FFFFFF"},listRoad:{color:"#CAD7E7"},listDistance:{color:"#CAD7E7"},
    chip:{backgroundColor:"#172A40",borderColor:"#29435A"},chipText:{color:"#CAD7E7"},mapFrame:{borderColor:"#29435A"},
  });
  const mapRef = useRef(null);
  const { pad, width, height } = usePadLayout();
  const mapHeight = pad ? Math.max(420, Math.min(560, Math.round(height * 0.42))) : 275;
  const mapWidth = Math.max(280, width - (pad ? 56 : 36));
  const [selectedId, setSelectedId] = useState(null);
  const [page, setPage] = useState(0);
  const [layerEnabled, setLayerEnabled] = useState(true);
  const copy = ({
    ru: { map: "Карта камер", cameras: "камер", data: "Камеры из базы выбранной страны", note: "Точки контроля на дорогах. Видеотрансляции не подключены.", empty: "Нет загруженных камер этой страны", download: "Открыть страны и базы", list: "Камеры страны", location: "Расстояния появятся после получения GPS", previous: "Назад", next: "Далее", layer: "Камеры на карте", shown: "На карте и в списке", limit: "Ограничение", unit: "км/ч" },
    uk: { map: "Карта камер", cameras: "камер", data: "Камери з бази вибраної країни", note: "Точки контролю на дорогах. Відеотрансляції не підключені.", empty: "Немає завантажених камер цієї країни", download: "Відкрити країни та бази", list: "Камери країни", location: "Відстані з’являться після отримання GPS", previous: "Назад", next: "Далі", layer: "Камери на карті", shown: "На карті та у списку", limit: "Обмеження", unit: "км/год" },
    en: { map: "Camera map", cameras: "cameras", data: "Cameras from the selected country database", note: "Road enforcement locations. Video feeds are not connected.", empty: "No cameras downloaded for this country", download: "Open countries and databases", list: "Country cameras", location: "Distances will appear when GPS is available", previous: "Previous", next: "Next", layer: "Cameras on map", shown: "On the map and in the list", limit: "Speed limit", unit: "km/h" },
    pl: { map: "Mapa fotoradarów", cameras: "kamer", data: "Kamery z bazy wybranego kraju", note: "Punkty kontroli drogowej. Transmisje wideo nie są podłączone.", empty: "Brak pobranych kamer tego kraju", download: "Otwórz kraje i bazy", list: "Kamery kraju", location: "Odległości pojawią się po uzyskaniu GPS", previous: "Wstecz", next: "Dalej", layer: "Kamery na mapie", shown: "Na mapie i na liście", limit: "Ograniczenie", unit: "km/h" },
  })[language] || null;
  const labels = copy || { map: "Camera map", cameras: "cameras", data: "Selected country database", note: "Video feeds are not connected.", empty: "No downloaded cameras", download: "Open countries", list: "Cameras", location: "Waiting for GPS", previous: "Previous", next: "Next", layer: "Cameras", shown: "On map and in list", limit: "Speed limit", unit: "km/h" };
  const name = countryDisplayName(country, language);
  const points = useMemo(() => cameraPoints(feed)
    .filter(camera => !camera._example_only && camera.latitude != null && camera.longitude != null
      && Number.isFinite(Number(camera.latitude)) && Number.isFinite(Number(camera.longitude))
      && Math.abs(Number(camera.latitude)) <= 90 && Math.abs(Number(camera.longitude)) <= 180)
    .map((camera, index) => ({...camera, latitude: Number(camera.latitude), longitude: Number(camera.longitude), uiId: `${country}:${camera.id ?? index}:${index}`})), [feed, country]);
  const hasOrigin = userCoords && Number.isFinite(userCoords.latitude) && Number.isFinite(userCoords.longitude);
  const sorted = useMemo(() => hasOrigin
    ? points.map(camera => ({...camera, distance: distanceBetweenMeters(userCoords, camera)})).sort((a,b) => a.distance-b.distance)
    : points, [points, hasOrigin, userCoords]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / 50));
  const currentPage = Math.min(page, pageCount-1);
  const visible = sorted.slice(currentPage*50, (currentPage+1)*50);
  const selected = visible.find(camera => camera.uiId === selectedId);
  const backToCamerasLabel = ({ru:"Назад к камерам",uk:"Назад до камер",en:"Back to cameras",pl:"Wróć do kamer"})[language] || "Back to cameras";
  const markerRefs = useRef(new Map());
  const [viewport,setViewport]=useState({latitude:visible[0]?.latitude ?? 30,longitude:visible[0]?.longitude ?? 15,latitudeDelta:5,longitudeDelta:5});
  const [trackMarkers,setTrackMarkers]=useState(true);
  const mapRegion={...viewport,width:mapWidth,height:mapHeight};
  const items=clusterMapPoints(layerEnabled ? visible : [],mapRegion);
  const pinSize=markerPixelSize(viewport.latitudeDelta);
  function backToCameras() {
    markerRefs.current.get(selectedId)?.hideCallout();
    setSelectedId(null);
    fitMap();
  }
  const title = camera => camera.location || camera.name || camera.road_index || camera.road || camera.region || cameraTypeLabel(camera, language);
  function fitMap() {
    if (visible.length) mapRef.current?.fitToCoordinates(visible.map(camera => ({latitude:camera.latitude,longitude:camera.longitude})), {
      edgePadding: {top:40,right:40,bottom:40,left:40}, animated:true,
    });
  }
  useEffect(() => {fitMap();}, [points, currentPage, hasOrigin]);
  useEffect(()=>{
    setTrackMarkers(true);
    const timer=setTimeout(()=>setTrackMarkers(false),400);
    return ()=>clearTimeout(timer);
  },[isNight,pinSize,currentPage]);
  if (!showCameras) {
    const paused = WARNING_UI[language] || WARNING_UI.ru;
    const region = hasOrigin
      ? { latitude: userCoords.latitude, longitude: userCoords.longitude, latitudeDelta: 0.18, longitudeDelta: 0.18 }
      : { latitude: 30, longitude: 15, latitudeDelta: 100, longitudeDelta: 100 };
    return <View style={rc.screen}>
      <Text style={rc.sectionTitle}>{paused.off}</Text>
      <Text style={rc.sectionHint}>{paused.offMap}</Text>
      <View style={[rc.mapFrame, { height: mapHeight }]}>
        <MapView style={rc.map} userInterfaceStyle={isNight ? "dark" : "light"} customMapStyle={isNight ? NIGHT_MAP_STYLE : []}
          initialRegion={region} showsUserLocation={!!hasOrigin} />
      </View>
    </View>;
  }
  function selectCamera(camera) {
    setSelectedId(camera.uiId);
    mapRef.current?.animateToRegion({latitude:camera.latitude,longitude:camera.longitude,latitudeDelta:0.005,longitudeDelta:0.005},300);
  }
  return <View style={rc.screen}>
    <MapMarkerLegend night={isNight} labelStyle={rc.sectionHint} items={["speed_camera","red_light","speed_and_red_light","average_speed","checkpoint"].map(type=>({type,label:cameraTypeLabel({type},language)}))} />
    <View style={rc.hero}>
      <View style={rc.heroTop}>
        <View style={rc.liveBadge}><Text style={rc.liveBadgeText}>{countryFlag(country)} {name}</Text></View>
        <Text style={rc.heroCount}>{points.length.toLocaleString()} {labels.cameras}</Text>
      </View>
      <Text style={rc.heroTitle}>{labels.map}</Text>
      <Text style={rc.heroCopy}>{labels.data}</Text>
      <View style={rc.notice}><Text style={rc.noticeText}>{labels.note}</Text></View>
    </View>
    {points.length ? <>
      <View style={rc.mapHeader}>
        <View style={{flex:1}}><Text style={rc.sectionTitle}>{name}</Text><Text style={rc.sectionHint}>{labels.shown}: {currentPage*50+1}–{Math.min((currentPage+1)*50,points.length)} / {points.length}</Text></View>
        <Switch accessibilityLabel={labels.layer} value={layerEnabled} onValueChange={setLayerEnabled} />
      </View>
      <View style={[rc.mapFrame, { height: mapHeight }]}>
        <MapView ref={mapRef} style={rc.map} userInterfaceStyle={isNight?"dark":"light"} customMapStyle={isNight?NIGHT_MAP_STYLE:[]} onMapReady={fitMap}
          initialRegion={{latitude:visible[0].latitude,longitude:visible[0].longitude,latitudeDelta:5,longitudeDelta:5}}
          onRegionChangeComplete={setViewport}>
          {items.map(item => item.kind === "cluster"
            ? <Marker key={`cluster:${item.latitude.toFixed(5)}:${item.longitude.toFixed(5)}:${item.count}`}
                coordinate={{latitude:item.latitude,longitude:item.longitude}}
                anchor={{x:0.5,y:0.5}} tracksViewChanges={trackMarkers}
                onPress={()=>mapRef.current?.animateToRegion(clusterFocusRegion(item,mapRegion),280)}>
                <MapCameraPin count={item.count} size={pinSize} night={isNight} />
              </Marker>
            : <Marker key={item.camera.uiId}
                ref={marker => { if (marker) markerRefs.current.set(item.camera.uiId, marker); else markerRefs.current.delete(item.camera.uiId); }}
                coordinate={{latitude:item.latitude,longitude:item.longitude}}
                anchor={{x:0.5,y:0.5}} tracksViewChanges={trackMarkers}
                title={title(item.camera)} description={cameraTypeLabel(item.camera,language)}
                onPress={() => setSelectedId(item.camera.uiId)}>
                <MapCameraPin camera={item.camera} size={pinSize} night={isNight} />
              </Marker>)}
        </MapView>
        {selected && <View style={rc.mapBackButton}><PageBackButton language={language} onPress={backToCameras} onLight={!isNight} label={backToCamerasLabel} /></View>}
      </View>
      {selected && <View style={rc.selectedCard}>
        <View style={rc.selectedTop}>
          <PageBackButton language={language} onPress={backToCameras} onLight={!isNight} label={backToCamerasLabel} />
          <Text style={[rc.cameraTitle,{flex:1,marginTop:0}]}>{title(selected)}</Text>
        </View>
        <Text style={rc.cameraDirection}>{cameraTypeLabel(selected,language)}</Text>
        {selected.speed_limit != null && <Text style={rc.metaValue}>{labels.limit}: {selected.speed_limit} {labels.unit}</Text>}
      </View>}
      <Text style={rc.sectionTitle}>{labels.list}</Text>
      {!hasOrigin && <Text style={rc.sectionHint}>{labels.location}</Text>}
      <View style={rc.cameraList}>{visible.map(camera => <Pressable key={camera.uiId} accessibilityRole="button" onPress={() => selectCamera(camera)} style={[rc.cameraListRow,selectedId===camera.uiId&&rc.cameraListSelected]}>
        <View style={rc.miniIcon}><Text>{cameraGlyph(camera)}</Text></View>
        <View style={rc.listInfo}><Text style={rc.listName}>{title(camera)}</Text><Text style={rc.listRoad}>{cameraTypeLabel(camera,language)}{camera.speed_limit != null ? ` · ${camera.speed_limit} ${labels.unit}` : ""}</Text></View>
        {hasOrigin && <Text style={rc.listDistance}>{formatRoadDistance(Math.round(camera.distance))}</Text>}
      </Pressable>)}</View>
      <View style={rc.sectionHeadRow}>
        <Pressable accessibilityRole="button" disabled={currentPage===0} onPress={() => {setPage(currentPage-1);setSelectedId(null);}} style={[rc.chip,{opacity:currentPage===0?0.4:1}]}><Text style={rc.chipText}>{labels.previous}</Text></Pressable>
        <Text style={rc.sectionHint}>{currentPage+1} / {pageCount}</Text>
        <Pressable accessibilityRole="button" disabled={currentPage+1>=pageCount} onPress={() => {setPage(currentPage+1);setSelectedId(null);}} style={[rc.chip,{opacity:currentPage+1>=pageCount?0.4:1}]}><Text style={rc.chipText}>{labels.next}</Text></Pressable>
      </View>
    </> : <View style={rc.selectedCard}><Text style={rc.cameraTitle}>{labels.empty}</Text>
      <Pressable accessibilityRole="button" onPress={onCountries} style={rc.locationButton}><Text style={rc.locationButtonText}>{labels.download}</Text></Pressable>
    </View>}
  </View>;
}

function formatRoadDistance(meters) {
  if (meters == null) return "—";
  return meters >= 1000 ? `${(meters / 1000).toFixed(1).replace(".", ",")} км` : `${meters} м`;
}

function cameraTypeLabel(cam, language="ru"){
  if(!cam) return "";
  const type=({fixed_speed:"speed_camera",average_speed_section:"average_speed",average_speed_start:"average_speed",average_speed_end:"average_speed",other_enforcement:"checkpoint"})[cam.camera_type] || cam.camera_type || cam.type || "speed_camera";
  const labels={
    ru:{speed_and_red_light:"Скорость и красный свет",speed_camera:"Камера скорости",red_light:"Контроль красного света",checkpoint:"Контрольная точка",average_speed:"Средняя скорость"},
    uk:{speed_and_red_light:"Швидкість і червоне світло",speed_camera:"Камера швидкості",red_light:"Контроль червоного світла",checkpoint:"Контрольна точка",average_speed:"Середня швидкість"},
    en:{speed_and_red_light:"Speed and red-light camera",speed_camera:"Speed camera",red_light:"Red-light camera",checkpoint:"Checkpoint",average_speed:"Average-speed control"},
    pl:{speed_and_red_light:"Prędkość i czerwone światło",speed_camera:"Fotoradar",red_light:"Kontrola czerwonego światła",checkpoint:"Punkt kontroli",average_speed:"Odcinkowy pomiar prędkości"}
  };
  return (labels[language]||labels.ru)[type] || type;
}

function LawsPage({ language, night, query, onQuery, onBack }) {
  const copy = WARNING_UI[language] || WARNING_UI.ru;
  const { pad } = usePadLayout();
  const text = night ? "#CAD7E7" : "#10263B";
  const muted = night ? "#8FA6BE" : "#4E6478";
  const card = night ? "#172A40" : "#FFFFFF";
  const notices = searchLegalNotices(query, language);
  return (
    <View style={{ width: "100%", maxWidth: 980, alignSelf: "center", gap: 14 }}>
      <Pressable accessibilityRole="button" onPress={onBack} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={{ color: "#1260E8", fontSize: 17, fontWeight: "700" }}>{copy.lawsBack}</Text>
      </Pressable>
      <Text style={{ fontSize: pad ? 32 : 24, fontWeight: "800", color: text }}>{copy.laws}</Text>
      <Text style={{ color: muted, fontSize: 15, lineHeight: 21 }}>{copy.lawsNote}</Text>
      <TextInput
        value={query}
        onChangeText={onQuery}
        placeholder={copy.lawsSearch}
        placeholderTextColor={muted}
        autoCorrect={false}
        style={{ minHeight: 48, borderWidth: 1, borderColor: night ? "#416078" : "#D5DEE8", borderRadius: 14, paddingHorizontal: 14, color: text, backgroundColor: card }}
      />
      {notices.map(notice => (
        <View key={notice.iso} style={{ backgroundColor: card, borderRadius: 18, padding: 16, gap: 6, borderWidth: 1, borderColor: night ? "#29435A" : "#E4EAF1" }}>
          <Text style={{ color: text, fontSize: 18, fontWeight: "700" }}>{notice.names[language] || notice.names.ru}</Text>
          <Text style={{ color: "#1260E8", fontSize: 14 }}>{statusLabel(notice.status, language)}</Text>
          <Text style={{ color: text, fontSize: 15, lineHeight: 21 }}>{notice.explanation[language] || notice.explanation.ru}</Text>
          <Text style={{ color: muted, fontSize: 13 }}>{notice.checkedOn ? `${copy.checkedOn}: ${notice.checkedOn}` : copy.checkedOnMissing}</Text>
          {notice.sourceUrl
            ? <Pressable accessibilityRole="link" onPress={() => Linking.openURL(notice.sourceUrl)}><Text style={{ color: "#1260E8", fontSize: 14 }}>{copy.source}</Text></Pressable>
            : <Text style={{ color: muted, fontSize: 13 }}>{copy.sourceMissing}</Text>}
        </View>
      ))}
    </View>
  );
}

function SettingSwitch({label,value,onChange}) {
  const s = appThemeStyles(useContext(ThemeContext));
  const { pad } = usePadLayout();
  return <View style={[s.settingRow, pad && { minHeight: 56 }]}><Text style={[s.settingLabel, pad && { fontSize: 18 }]}>{label}</Text><Switch value={value} onValueChange={onChange}/></View>
}
function DistanceRow({label,value,setValue}) {
  const s = appThemeStyles(useContext(ThemeContext));
  const { pad } = usePadLayout();
  return <View style={s.settingRow}>
    <Text style={[s.settingLabel, pad && { fontSize: 18 }]}>{label}</Text>
    <View style={s.stepper}>
      <Pressable onPress={()=>setValue(Math.max(200,value-100))} style={s.stepBtn}><Text style={s.settingLabel}>−</Text></Pressable>
      <Text style={s.stepValue}>{value} м</Text>
      <Pressable onPress={()=>setValue(Math.min(3000,value+100))} style={s.stepBtn}><Text style={s.settingLabel}>＋</Text></Pressable>
    </View>
  </View>
}

const baseHomeStyles = StyleSheet.create({
  screen: { gap: 10, paddingBottom: 2 },
  header: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: {width:44,height:44,alignItems:"center",justifyContent:"center"},
  brandLockup: { flex:1, flexDirection: "row", alignItems: "center", gap: 6 },
  brandMark: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#E5F8FC" },
  brandMarkText: { color: "#0CAFD1", fontSize: 29, lineHeight: 33, fontWeight: "900", fontStyle: "italic" },
  brand: { fontSize: 28, lineHeight: 34, fontWeight: "900", letterSpacing: -1.1 },
  brandCam: { color: "#102A4D" },
  brandAlert: { color: "#17BFE0" },
  settingsButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#F1F5FA" },
  settingsGlyph: { color: "#173553", fontSize: 25, lineHeight: 29 },
  statusRow: { flexDirection: "row", gap: 9 },
  statusCard: { flex: 1, minHeight: 55, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 11, borderRadius: 17, backgroundColor: "#EAF7F8" },
  statusIcon: { color: "#143250", fontSize: 29, lineHeight: 32, fontWeight: "800" },
  databaseIcon: { color: "#143250", fontSize: 25, lineHeight: 30, fontWeight: "800" },
  statusCopy: { flex: 1, minWidth: 0 },
  statusTitle: { color: "#254361", fontSize: 12, fontWeight: "700" },
  statusValueRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDotReady: { backgroundColor: "#1FB849" },
  statusDotIdle: { backgroundColor: "#E0A32D" },
  statusValue: { color: "#50677C", fontSize: 10, fontWeight: "600", flexShrink: 1 },
  hero: { height: 158, borderRadius: 21, overflow: "hidden", backgroundColor: "#DCEAF0", justifyContent: "flex-end" },
  heroImage: { borderRadius: 21 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(9, 30, 47, 0.05)" },
  heroCar: { position: "absolute", bottom: 13, right: "24%", fontSize: 41, textShadowColor: "rgba(5, 23, 42, 0.35)", textShadowRadius: 7 },
  heroRoadMark: { position: "absolute", height: 2, left: 0, right: 0, bottom: 7, backgroundColor: "rgba(255, 255, 255, 0.62)" },
  intro: { marginTop: 0 },
  title: { color: "#102A4D", fontSize: 34, lineHeight: 39, fontWeight: "900", letterSpacing: -0.8 },
  subtitle: { color: "#435D78", fontSize: 17, lineHeight: 22, fontWeight: "500", marginTop: 1 },
  startButton: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 13, borderRadius: 20, backgroundColor: "#1558ED", shadowColor: "#1558ED", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  startButtonPressed: { backgroundColor: "#1049CC", transform: [{ scale: 0.99 }] },
  playIcon: { color: "#fff", fontSize: 17, marginTop: 1 },
  startButtonText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  whereButton: { minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#1558ED" },
  whereButtonPressed: { backgroundColor: "#E7F0FF" },
  whereButtonText: { color: "#1558ED", fontSize: 17, fontWeight: "800" },
  navSection: { gap: 7 },
  sectionTitle: { color: "#183453", fontSize: 14, fontWeight: "800" },
  navigatorRow: { flexDirection: "row", gap: 7 },
  navigatorCard: { flex: 1, minWidth: 0, minHeight: 82, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, paddingVertical: 7, borderRadius: 17, backgroundColor: "#F7FAFE", borderWidth: 1, borderColor: "#E1EAF4" },
  navigatorPressed: { backgroundColor: "#EEF6FF", transform: [{ scale: 0.98 }] },
  navigatorIconBox: { width: 35, height: 35, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#EAF4FF" },
  navigatorIcon: { fontSize: 24, lineHeight: 30, fontWeight: "800" },
  appleIcon: { color: "#198BD7", fontSize: 27 },
  googleIcon: { fontSize: 20 },
  alertsIcon: { color: "#245078", fontSize: 23 },
  navigatorLabel: { color: "#365270", fontSize: 9, lineHeight: 12, fontWeight: "700", textAlign: "center", marginTop: 4 },
  navNote: { color: "#8091A3", fontSize: 9, lineHeight: 12 },
  countryCard: { minHeight: 73, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 19, backgroundColor: "#F7FAFE", borderWidth: 1, borderColor: "#E5EDF5" },
  countryFlag: { fontSize: 38, lineHeight: 45 },
  countryCopy: { flex: 1 },
  countryName: { color: "#173554", fontSize: 15, fontWeight: "800" },
  countryMeta: { color: "#526B84", fontSize: 12, marginTop: 1 },
  countryUpdate: { color: "#7D8FA2", fontSize: 10, marginTop: 2 },
  countryChevron: { color: "#315473", fontSize: 30, lineHeight: 34, paddingHorizontal: 3 },
});

const baseCountriesStyles = StyleSheet.create({
  screen:{gap:12},content:{gap:10},
  segment:{minHeight:42,flexDirection:"row",padding:3,borderRadius:14,backgroundColor:"#E8EEF5",gap:4},
  segmentItem:{flex:1,minHeight:36,alignItems:"center",justifyContent:"center",borderRadius:11},
  segmentItemActive:{backgroundColor:"#1260E8"},
  segmentText:{color:"#52677F",fontSize:13,fontWeight:"700"},segmentTextActive:{color:"#FFFFFF"},
  search:{minHeight:46,paddingHorizontal:14,borderRadius:14,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E2EAF2",color:"#173554",fontSize:15},
  searchNight:{backgroundColor:"#10263B",borderColor:"#27425D",color:"#FFFFFF"},
  countryShell:{borderRadius:18,backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E3EAF2",overflow:"hidden"},
  deleteButton:{minHeight:48,paddingHorizontal:16,paddingVertical:10,justifyContent:"center",borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:"#8290A2"},
  deleteLabel:{fontSize:14,lineHeight:18,fontWeight:"700"},
  countryCard:{minHeight:82,flexDirection:"row",alignItems:"center",gap:12,paddingHorizontal:13,paddingVertical:10},
  countryCardNight:{backgroundColor:"#10263B",borderColor:"#213B55"},countrySelected:{borderColor:"#1260E8",borderWidth:1.5},
  flag:{fontSize:32,width:40,textAlign:"center"},countryCopy:{flex:1,minWidth:0},countryName:{color:"#14213D",fontSize:15,fontWeight:"800"},
  countryCount:{color:"#748399",fontSize:12,marginTop:2},countryStatus:{fontSize:11,fontWeight:"600",marginTop:3},offlineStatus:{color:"#169B69"},
  statusMark:{width:32,height:32,alignItems:"center",justifyContent:"center"},check:{fontSize:19,fontWeight:"800"},checkReady:{color:"#22C58B"},checkPending:{color:"#1260E8"},
  noteCard:{padding:14,borderRadius:16,backgroundColor:"#EEF4FA",gap:5},noteTitle:{color:"#14213D",fontSize:13,fontWeight:"800"},noteText:{color:"#627187",fontSize:12,lineHeight:17},lastUpdate:{color:"#8290A2",fontSize:11,marginTop:4},
  textNight:{color:"#FFFFFF"},mutedNight:{color:"#B8C8DA"},empty:{color:"#7B8496",textAlign:"center",padding:18},
});

const baseNavigatorStyles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2, 8, 17, 0.68)" },
  sheet: { paddingHorizontal: 20, paddingTop: 11, paddingBottom: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#0B1829", borderWidth: 1, borderColor: "rgba(128, 170, 205, 0.18)" },
  handle: { width: 42, height: 4, alignSelf: "center", borderRadius: 3, backgroundColor: "#60758B", marginBottom: 18 },
  title: { color: "#F7FAFF", fontSize: 21, lineHeight: 27, fontWeight: "800" },
  subtitle: { color: "#B6C6D8", fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 14 },
  destinationInput: { minHeight: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#14283E", borderWidth: 1, borderColor: "rgba(163, 190, 218, 0.18)", color: "#F7FAFF", fontSize: 14 },
  hint: { color: "#8FA3B8", fontSize: 10, marginTop: 5, marginBottom: 12 },
  options: { gap: 8 },
  option: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16, backgroundColor: "#14283E", borderWidth: 1, borderColor: "rgba(163, 190, 218, 0.14)" },
  optionPressed: { backgroundColor: "#1B3551", borderColor: "rgba(35, 211, 239, 0.55)" },
  optionIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#203B55" },
  optionIconText: { color: "#23D3EF", fontSize: 23, fontWeight: "800" },
  optionCopy: { flex: 1 },
  optionTitle: { color: "#F4F8FC", fontSize: 13, fontWeight: "800" },
  optionSubtitle: { color: "#AFC1D2", fontSize: 10, lineHeight: 14, marginTop: 2 },
  chevron: { color: "#8FA3B8", fontSize: 25, lineHeight: 28, paddingHorizontal: 3 },
  footnote: { color: "#8FA3B8", fontSize: 10, lineHeight: 14, textAlign: "center", marginTop: 12 },
  cancelButton: { minHeight: 42, alignItems: "center", justifyContent: "center", marginTop: 4 },
  cancelText: { color: "#CAD7E7", fontSize: 13, fontWeight: "700" },
});

const driveStyles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  nightRoot: { backgroundColor: "#071525" },
  dayRoot: { backgroundColor: "#DDE8F0" },
  safeOverlay: { flex: 1, paddingTop: 7 },
  mapWaitingNight: { backgroundColor: "#071525" },
  mapWaitingDay: { backgroundColor: "#E8F0F5" },
  topArea: { gap: 10, marginHorizontal: 14, marginTop: 7 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  statusCard: { minHeight: 49, flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  glassNight: { backgroundColor: "rgba(13, 33, 52, 0.88)", borderColor: "rgba(133, 178, 212, 0.2)" },
  glassNightStrong: { backgroundColor: "rgba(12, 31, 49, 0.94)", borderColor: "rgba(133, 178, 212, 0.24)" },
  glassDay: { backgroundColor: "rgba(250, 253, 255, 0.94)", borderColor: "rgba(41, 78, 113, 0.13)" },
  statusTextBlock: { flex: 1, minWidth: 0 },
  statusTitle: { fontSize: 11, lineHeight: 14, fontWeight: "800" },
  statusSub: { fontSize: 9, lineHeight: 12, marginTop: 1 },
  statusTiny: { fontSize: 7, lineHeight: 9, marginTop: 1 },
  textWhite: { color: "#FFFFFF" },
  textDark: { color: "#102B45" },
  textMuted: { color: "#B8C9D9" },
  textMutedDay: { color: "#687E92" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotReady: { backgroundColor: "#20D782", shadowColor: "#20D782", shadowOpacity: 0.6, shadowRadius: 5 },
  dotSearching: { backgroundColor: "#FFAE20" },
  dotOff: { backgroundColor: "#9AA9B8" },
  audioGlyph: { fontSize: 22, width: 21, textAlign: "center" },
  audioOn: { color: "#23D3EF" },
  audioOff: { color: "#8295A9" },
  settingsButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 15, borderWidth: 1 },
  settingsGlyph: { fontSize: 22 },
  metricsRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  speedBadge: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  speedValue: { fontSize: 32, lineHeight: 36, fontWeight: "900", letterSpacing: -1 },
  speedUnit: { fontSize: 11, lineHeight: 14, fontWeight: "700" },
  limitBlock: { minWidth: 64, minHeight: 78, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 16, borderWidth: 1 },
  limitSignOuter: { width: 53, height: 53, alignItems: "center", justifyContent: "center", borderRadius: 27, backgroundColor: "#E9444E", borderWidth: 2, borderColor: "#FFFFFF" },
  limitSignInner: { width: 43, height: 43, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  limitValue: { color: "#152C44", fontSize: 18, fontWeight: "900" },
  limitCaption: { fontSize: 8, lineHeight: 10, fontWeight: "700", textAlign: "center" },
  carMarkerHalo: { width: 43, height: 43, alignItems: "center", justifyContent: "center", borderRadius: 22, borderWidth: 1.5 },
  routeCameraDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#1260E8", borderWidth: 1, borderColor: "#fff" },
  carMarkerHaloNight: { backgroundColor: "rgba(35, 211, 239, 0.2)", borderColor: "rgba(100, 237, 255, 0.75)" },
  carMarkerHaloDay: { backgroundColor: "rgba(18, 96, 232, 0.16)", borderColor: "rgba(18, 96, 232, 0.6)" },
  carArrow: { color: "#23D3EF", fontSize: 29, lineHeight: 34, fontWeight: "900", textShadowColor: "rgba(35, 211, 239, 0.55)", textShadowRadius: 8 },
  mapCameraMarker: { width: 39, height: 39, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#FFAE20", borderWidth: 2, borderColor: "#FFF4D8", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 7, elevation: 6 },
  mapCameraMarkerDanger: { backgroundColor: "#FF8A16", borderColor: "#FFF0C7" },
  mapCameraGlyph: { color: "#10263B", fontSize: 22, fontWeight: "900" },
  mapControls: { position: "absolute", right: 14, top: "42%", gap: 8, alignItems: "flex-end" },
  mapControl: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 15 },
  mapControlGlyph: { fontSize: 24, lineHeight: 29, fontWeight: "700" },
  offCenterBadge: { paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderRadius: 10 },
  offCenterText: { fontSize: 8, fontWeight: "700" },
  gpsPromptWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  gpsPrompt: { width: "100%", maxWidth: 360, paddingHorizontal: 20, paddingVertical: 18, alignItems: "center", borderWidth: 1, borderRadius: 22 },
  gpsPromptTitle: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  gpsPromptBody: { fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 6 },
  routeButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#1260E8" },
  routeButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  retryButton: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 13, backgroundColor: "#1260E8" },
  retryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  bottomArea: { marginTop: "auto", marginHorizontal: 14, gap: 9, paddingBottom: 8 },
  cameraCard: { paddingHorizontal: 12, paddingVertical: 11, borderRadius: 19, borderWidth: 1 },
  cameraCardDanger: { borderColor: "#FFAE20", shadowColor: "#FFAE20", shadowOpacity: 0.26, shadowRadius: 12, elevation: 4 },
  demoCameraCard: { width: "100%", maxWidth: 354, borderColor: "rgba(255, 174, 32, 0.65)" },
  cameraCardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  cameraIconWrap: { width: 39, height: 39, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#23D3EF" },
  cameraIconWrapDanger: { backgroundColor: "#FFAE20" },
  cameraIcon: { color: "#0A2035", fontSize: 21, fontWeight: "900" },
  cameraTextBlock: { flex: 1, minWidth: 0 },
  cameraEyebrow: { fontSize: 9, lineHeight: 12, fontWeight: "700" },
  cameraLocation: { fontSize: 13, lineHeight: 17, fontWeight: "800" },
  cameraType: { fontSize: 9, lineHeight: 13, marginTop: 1 },
  distanceBlock: { minWidth: 69, alignItems: "flex-end" },
  distanceValue: { fontSize: 20, lineHeight: 24, fontWeight: "900" },
  warningText: { color: "#FFAE20" },
  progressTrack: { height: 3, overflow: "hidden", marginTop: 9, borderRadius: 2 },
  progressTrackNight: { backgroundColor: "rgba(175, 202, 224, 0.18)" },
  progressTrackDay: { backgroundColor: "rgba(28, 61, 91, 0.14)" },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: "#23D3EF" },
  progressFillDanger: { backgroundColor: "#FFAE20" },
  noCameraCard: { minHeight: 59, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 17, borderWidth: 1 },
  noCameraTitle: { fontSize: 12, fontWeight: "800" },
  noCameraSub: { fontSize: 9, marginTop: 2 },
  sectionNotice: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 15, borderWidth: 1 },
  sectionNoticeAmber: { backgroundColor: "rgba(255, 174, 32, 0.14)", borderColor: "rgba(255, 174, 32, 0.45)" },
  sectionNoticeCool: { backgroundColor: "rgba(35, 211, 239, 0.12)", borderColor: "rgba(35, 211, 239, 0.4)" },
  sectionNoticeGlyph: { color: "#FFAE20", fontSize: 18 },
  sectionNoticeTitle: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  sectionNoticeSub: { color: "#CAD7E7", fontSize: 8, marginTop: 2 },
  sectionNoticeTitleDay: { color: "#17324E" },
  sectionNoticeSubDay: { color: "#526A80" },
  warningTextDay: { color: "#A65B00" },
  stopButton: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "rgba(117, 34, 44, 0.94)", borderWidth: 1, borderColor: "rgba(255, 147, 147, 0.3)" },
  stopButtonPressed: { backgroundColor: "#9D2532", transform: [{ scale: 0.99 }] },
  stopButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  warningOverlay: { position: "absolute", left: 16, right: 16, top: "29%", alignItems: "center", zIndex: 15 },
  warningPanel: { width: "100%", maxWidth: 280, alignItems: "center", paddingHorizontal: 14, paddingTop: 11, paddingBottom: 7, borderRadius: 24, borderWidth: 1 },
  warningPanelNight: { backgroundColor: "rgba(7, 21, 37, 0.97)", borderColor: "rgba(255, 159, 28, 0.38)", shadowColor: "#FF9F1C", shadowOpacity: 0.18, shadowRadius: 22, elevation: 12 },
  warningPanelDay: { backgroundColor: "rgba(250, 253, 255, 0.98)", borderColor: "rgba(255, 159, 28, 0.46)", shadowColor: "#243B53", shadowOpacity: 0.2, shadowRadius: 18, elevation: 9 },
  warningHeader: { width: "100%", minHeight: 29, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  warningTitle: { fontSize: 19, lineHeight: 24, fontWeight: "900" },
  demoBadge: { position: "absolute", right: 0, maxWidth: 132, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, backgroundColor: "rgba(255, 174, 32, 0.18)" },
  demoBadgeText: { color: "#FFAE20", fontSize: 11, lineHeight: 14, fontWeight: "800", textAlign: "right" },
  warningIconGlow: { width: 76, height: 76, marginTop: 8, alignItems: "center", justifyContent: "center", borderRadius: 38, backgroundColor: "rgba(255, 159, 28, 0.14)", borderWidth: 2, borderColor: "#FF9F1C", shadowColor: "#FF9F1C", shadowOpacity: 0.55, shadowRadius: 15, elevation: 8 },
  warningIconInner: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#10263B" },
  warningIcon: { color: "#FFB020", fontSize: 32, fontWeight: "900" },
  warningDistance: { marginTop: 5, fontSize: 40, lineHeight: 45, fontWeight: "900", letterSpacing: -0.7 },
  warningCameraType: { fontSize: 12, lineHeight: 16, fontWeight: "700", textAlign: "center" },
  warningProgressTrack: { width: "100%", height: 9, marginTop: 10, overflow: "hidden", borderRadius: 5 },
  warningProgressFill: { height: "100%", borderRadius: 5, backgroundColor: "#FF9F1C" },
  warningMetrics: { width: "100%", flexDirection: "row", gap: 9, marginTop: 11 },
  warningMetric: { flex: 1, minHeight: 67, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 17, paddingHorizontal: 7, paddingVertical: 6 },
  warningMetricValue: { fontSize: 30, lineHeight: 34, fontWeight: "900" },
  warningMetricLabel: { fontSize: 9, lineHeight: 12, fontWeight: "700", textAlign: "center" },
  warningLimitSign: { width: 43, height: 43, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 4, borderColor: "#E9444E" },
  warningLimitSignOver: { borderColor: "#FF5252" },
  warningLimitValue: { color: "#152C44", fontSize: 18, fontWeight: "900" },
  warningUnknownLimit: { fontSize: 11, lineHeight: 15, fontWeight: "700", textAlign: "center" },
  warningStatus: { width: "100%", alignItems: "center", marginTop: 10, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 14, borderWidth: 1 },
  warningStatusNormal: { backgroundColor: "rgba(255, 159, 28, 0.1)", borderColor: "rgba(255, 159, 28, 0.32)" },
  warningStatusOver: { backgroundColor: "rgba(255, 82, 82, 0.12)", borderColor: "rgba(255, 82, 82, 0.45)" },
  warningStatusTitle: { color: "#FFB020", fontSize: 13, lineHeight: 17, fontWeight: "900", textAlign: "center" },
  warningStatusTitleOver: { color: "#FF5252" },
  warningStatusSub: { color: "#B8C8DA", fontSize: 10, marginTop: 2 },
  warningStatusSubOver: { color: "#FFB7B7" },
  warningDismiss: { minHeight:48, minHeight: 30, justifyContent: "center", paddingHorizontal: 12, marginTop: 2 },
  warningDismissText: { fontSize: 10, fontWeight: "700" },
});

const baseAppStyles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#f5f6f8"},
  container:{padding:18,paddingBottom:24,gap:14},
  nav:{flexShrink:0,marginHorizontal:12,marginBottom:8,backgroundColor:"#fff",borderRadius:20,flexDirection:"row",padding:6,shadowOpacity:.12,shadowRadius:15},
  navItem:{minHeight:48,minWidth:0,flex:1,alignItems:"center",justifyContent:"center",paddingVertical:6,paddingHorizontal:2,borderRadius:13},navActive:{backgroundColor:"#eef0f3"},
  navIcon:{fontSize:17},navLabel:{width:"100%",fontSize:12,lineHeight:15,marginTop:2,textAlign:"center"},
  screenHeader:{flexDirection:"row",alignItems:"center",gap:10,minHeight:52,paddingTop:6,overflow:"visible"},
  title:{fontSize:28,lineHeight:36,fontWeight:"800",marginTop:0,paddingVertical:1,color:"#10263B"},subtitle:{fontSize:14,lineHeight:20,opacity:.55},
  card:{backgroundColor:"#fff",borderRadius:24,padding:22,borderWidth:3,borderColor:"transparent"},cardDanger:{borderColor:"#ff8a00"},
  label:{fontSize:14,opacity:.55},distance:{fontSize:48,fontWeight:"900",marginTop:4},place:{fontSize:18,fontWeight:"700",marginTop:8},region:{fontSize:14,opacity:.55,marginTop:3},
  warningBox:{marginTop:14,padding:13,borderRadius:14,backgroundColor:"#fff2df"},warningText:{fontSize:18,fontWeight:"800"},warningSub:{fontSize:12,opacity:.6},
  limitRow:{flexDirection:"row",alignItems:"center",gap:14,marginTop:18},limitCircle:{width:66,height:66,borderRadius:33,borderWidth:6,borderColor:"#d32f2f",alignItems:"center",justifyContent:"center"},limitText:{fontSize:24,fontWeight:"900"},
  small:{fontSize:13,opacity:.55},value:{fontSize:18,fontWeight:"700"},empty:{fontSize:17,opacity:.6,paddingVertical:20},
  row:{flexDirection:"row",gap:12},stat:{flex:1,backgroundColor:"#fff",borderRadius:20,padding:18},statValue:{fontSize:38,fontWeight:"900"},heading:{fontSize:14,fontWeight:"800",marginTop:8,lineHeight:18},unit:{fontSize:12,opacity:.55},
  backgroundCard:{backgroundColor:"#fff",borderRadius:20,padding:16,flexDirection:"row",alignItems:"center",gap:12},backgroundTitle:{fontSize:17,fontWeight:"800"},backgroundText:{fontSize:12,opacity:.55},
  smallButton:{backgroundColor:"#111",paddingVertical:10,paddingHorizontal:13,borderRadius:12},smallButtonStop:{backgroundColor:"#8b1e1e"},smallButtonText:{color:"#fff",fontWeight:"800"},
  button:{backgroundColor:"#111",borderRadius:18,paddingVertical:17,alignItems:"center"},stop:{backgroundColor:"#8b1e1e"},buttonText:{color:"#fff",fontSize:18,fontWeight:"800"},
  action:{flex:1,backgroundColor:"#fff",borderRadius:16,padding:15,borderWidth:1,borderColor:"#ddd"},actionText:{fontWeight:"700",fontSize:13},
  testButton:{backgroundColor:"#fff",borderRadius:16,paddingVertical:15,alignItems:"center",borderWidth:2,borderColor:"#111"},testButtonText:{fontWeight:"800"},
  map:{height:560,borderRadius:22,overflow:"hidden"},list:{gap:10},listItem:{backgroundColor:"#fff",borderRadius:16,padding:15,flexDirection:"row",alignItems:"center",gap:10},listTitle:{fontSize:15,fontWeight:"700"},listSub:{fontSize:12,opacity:.55,marginTop:3},listDistance:{fontWeight:"800"},
  settingsCard:{backgroundColor:"#fff",borderRadius:22,padding:18,gap:12},sectionTitle:{fontSize:18,fontWeight:"800",marginTop:6},settingRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:9,borderBottomWidth:1,borderBottomColor:"#eee"},settingLabel:{fontSize:14,flex:1},stepper:{flexDirection:"row",alignItems:"center",gap:8},stepBtn:{minHeight:48,minWidth:48,width:34,height:34,borderRadius:10,backgroundColor:"#eee",alignItems:"center",justifyContent:"center"},stepValue:{minWidth:58,textAlign:"center",fontWeight:"700"},lang:{minHeight:48,flex:1,padding:12,backgroundColor:"#eee",borderRadius:12,alignItems:"center"},langActive:{backgroundColor:"#cfd7ff"},aboutRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:12,borderBottomWidth:1,borderBottomColor:"#eee"},aboutLabel:{fontSize:15},chev:{fontSize:24,opacity:.35},
  modalShade:{flex:1,backgroundColor:"rgba(0,0,0,.45)",justifyContent:"flex-end"},modalCard:{backgroundColor:"#fff",padding:22,borderTopLeftRadius:26,borderTopRightRadius:26,gap:14},modalTitle:{fontSize:23,fontWeight:"800"},modalText:{opacity:.6},input:{minHeight:90,borderWidth:1,borderColor:"#ddd",borderRadius:14,padding:12,textAlignVertical:"top"},cancel:{alignItems:"center",padding:12},
  typeLabel:{fontSize:12,fontWeight:"700",opacity:.5,marginTop:5},
  dataCard:{backgroundColor:"#f3f4f6",borderRadius:14,padding:14,flexDirection:"row",alignItems:"center",gap:12},
  dataCardStack:{flexDirection:"column",alignItems:"stretch"},
  dataUpdateButton:{alignSelf:"flex-start",marginTop:4},
  guideCard:{backgroundColor:"#fff",paddingHorizontal:18,paddingTop:8,paddingBottom:14,borderTopLeftRadius:22,borderTopRightRadius:22},
  guideScroll:{gap:8,paddingTop:8},
  guideTitle:{fontSize:18,lineHeight:23,fontWeight:"800",color:"#14213D"},
  guideBody:{fontSize:14,lineHeight:20,color:"#3C4C60"},
  guideStep:{fontSize:15,lineHeight:21,fontWeight:"700",color:"#14213D"},
  guideState:{fontSize:15,lineHeight:21,fontWeight:"700",color:"#176d68"},
  guideButton:{minHeight:48,borderRadius:14,backgroundColor:"#1260E8",alignItems:"center",justifyContent:"center",paddingHorizontal:16,paddingVertical:12,marginTop:6},
  guideButtonText:{color:"#fff",fontSize:16,fontWeight:"800",textAlign:"center"},
  guideLater:{minHeight:44,alignItems:"center",justifyContent:"center"},
  guideLaterText:{fontSize:15,fontWeight:"700",color:"#526A80",textAlign:"center"},
  dataLabel:{fontSize:12,opacity:.55},
  dataValue:{fontSize:13,fontWeight:"700",marginTop:3},
  driveThemeRow:{flexDirection:"row",gap:9},driveThemeOption:{flex:1,alignItems:"center",justifyContent:"center",paddingVertical:12,paddingHorizontal:8,borderRadius:13,backgroundColor:"#f0f2f5",borderWidth:1,borderColor:"#e4e8ed",minHeight:48},driveThemeOptionActive:{backgroundColor:"#10263b",borderColor:"#23d3ef"},driveThemeOptionText:{fontSize:13,lineHeight:17,fontWeight:"700",color:"#4d5e70",textAlign:"center"},driveThemeOptionTextActive:{color:"#fff"},
  alertDemoButton:{paddingHorizontal:13,paddingVertical:11,borderRadius:14,backgroundColor:"#10263b",borderWidth:1,borderColor:"#23d3ef"},alertDemoButtonTitle:{color:"#fff",fontSize:14,fontWeight:"800"},alertDemoButtonSub:{color:"#b8c9d9",fontSize:11,marginTop:3},
  alertDemoShade:{flex:1,justifyContent:"center",alignItems:"center",padding:16,backgroundColor:"rgba(0,0,0,0.72)"},alertDemoContent:{width:"100%",alignItems:"center",gap:12},alertDemoModeRow:{width:"100%",maxWidth:280,flexDirection:"row",gap:8},alertDemoMode:{flex:1,alignItems:"center",paddingVertical:10,borderRadius:12,backgroundColor:"rgba(16,38,59,0.92)",borderWidth:1,borderColor:"rgba(202,215,231,0.18)"},alertDemoModeActive:{borderColor:"#23D3EF",backgroundColor:"#10263B"},alertDemoModeText:{color:"#CAD7E7",fontSize:12,fontWeight:"700"},alertDemoModeTextActive:{color:"#fff"},
  coverageCard:{backgroundColor:"#f3f4f6",borderRadius:14,padding:14,gap:8},
  coverageLine:{fontSize:14,fontWeight:"600"},
note:{fontSize:12,lineHeight:18,opacity:.55}
});

const baseRoadStyles = StyleSheet.create({
  cameraBackButton:{width:48,height:48,borderRadius:16,backgroundColor:"#1260E8",alignItems:"center",justifyContent:"center"},
  mapBackButton:{position:"absolute",top:12,left:12,zIndex:2,elevation:5},
  cameraBackArrow:{width:12,height:12,borderLeftWidth:2,borderBottomWidth:2,borderColor:"#FFFFFF",transform:[{rotate:"45deg"}],marginLeft:5},
  screen:{gap:12,paddingBottom:20},hero:{backgroundColor:"#09253b",borderRadius:28,padding:20,overflow:"hidden"},heroTop:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  liveBadge:{flexDirection:"row",alignItems:"center",gap:7,backgroundColor:"rgba(255,255,255,.12)",borderRadius:20,paddingHorizontal:11,paddingVertical:7},demoDot:{width:7,height:7,borderRadius:4,backgroundColor:"#f6b84d"},liveBadgeText:{fontSize:10,fontWeight:"900",color:"#ffe0a1",letterSpacing:1},heroCount:{fontSize:11,color:"#c7d4df"},heroTitle:{fontSize:27,fontWeight:"900",color:"#fff",marginTop:15},heroCopy:{fontSize:13,color:"#bdceda",marginTop:3},notice:{flexDirection:"row",gap:9,backgroundColor:"rgba(255,255,255,.1)",padding:11,borderRadius:14,marginTop:15},noticeIcon:{color:"#ffd174",fontSize:15},noticeText:{flex:1,color:"#e0e9ef",fontSize:11,lineHeight:16},
  mapHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:5},sectionHeadRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:6},sectionTitle:{fontSize:18,fontWeight:"800",color:"#142536"},sectionHint:{fontSize:11,color:"#758393",marginTop:3},sectionAction:{fontSize:12,fontWeight:"800",color:"#176d68"},layerToggle:{paddingHorizontal:10,paddingVertical:8,borderRadius:14,backgroundColor:"#e8edf0"},layerToggleOn:{backgroundColor:"#dff1ec"},layerToggleText:{fontSize:10,fontWeight:"800",color:"#64717a"},layerToggleTextOn:{color:"#176d68"},
  mapFrame:{height:275,borderRadius:23,overflow:"hidden",backgroundColor:"#e3ece8",borderWidth:1,borderColor:"#dce5e1"},map:{flex:1},mapLegend:{position:"absolute",left:10,bottom:10,flexDirection:"row",alignItems:"center",gap:6,backgroundColor:"rgba(255,255,255,.94)",paddingHorizontal:10,paddingVertical:7,borderRadius:12},legendSwatch:{width:8,height:8,borderRadius:4,backgroundColor:"#187e74"},legendText:{fontSize:10,fontWeight:"700",color:"#4b5e65"},pin:{width:34,height:34,borderRadius:17,backgroundColor:"#fff",borderWidth:2,borderColor:"#247a70",alignItems:"center",justifyContent:"center",shadowColor:"#000",shadowOpacity:.2,shadowRadius:5,elevation:4},pinSelected:{backgroundColor:"#176d68",transform:[{scale:1.12}]},pinText:{fontSize:15},
  chips:{gap:7,paddingVertical:2,paddingRight:8},chip:{paddingHorizontal:15,paddingVertical:9,borderRadius:16,backgroundColor:"#fff",borderWidth:1,borderColor:"#e5e9eb"},chipActive:{backgroundColor:"#122c3f",borderColor:"#122c3f"},chipText:{fontSize:12,fontWeight:"800",color:"#5d6b73"},chipTextActive:{color:"#fff"},
  selectedCard:{backgroundColor:"#fff",borderRadius:23,padding:15,borderWidth:1,borderColor:"#e8ecee",shadowColor:"#1c3444",shadowOpacity:.06,shadowRadius:13,elevation:2},selectedTop:{flexDirection:"row",alignItems:"center",gap:8},roadPill:{backgroundColor:"#e5f3f0",paddingHorizontal:10,paddingVertical:6,borderRadius:10},roadPillText:{fontSize:12,fontWeight:"900",color:"#176d68"},demoTag:{fontSize:9,fontWeight:"900",letterSpacing:.8,color:"#a16a1d",backgroundColor:"#fff3d9",paddingHorizontal:8,paddingVertical:6,borderRadius:9},heart:{marginLeft:"auto",paddingHorizontal:7,paddingVertical:1},heartText:{fontSize:24,color:"#d45457"},cameraTitle:{fontSize:19,fontWeight:"800",color:"#172a3a",marginTop:9},cameraDirection:{fontSize:11,color:"#77848e",marginTop:3},
  demoScene:{height:190,marginTop:13,borderRadius:17,overflow:"hidden",backgroundColor:"#b7d6de",position:"relative"},sceneSky:{...StyleSheet.absoluteFillObject,backgroundColor:"#b7d6de"},sceneSun:{position:"absolute",top:19,right:34,width:29,height:29,borderRadius:16,backgroundColor:"#f7d18a"},sceneHillOne:{position:"absolute",bottom:75,left:-35,width:230,height:135,borderRadius:100,backgroundColor:"#83aaa0",transform:[{rotate:"-7deg"}]},sceneHillTwo:{position:"absolute",bottom:70,right:-38,width:240,height:125,borderRadius:100,backgroundColor:"#698f86",transform:[{rotate:"8deg"}]},sceneRoad:{position:"absolute",height:86,left:-15,right:-15,bottom:18,backgroundColor:"#46515a",transform:[{rotate:"-4deg"}]},sceneLane:{position:"absolute",left:55,right:38,bottom:61,height:3,backgroundColor:"#eed9a3",opacity:.9,transform:[{rotate:"-4deg"}]},sceneCarOne:{position:"absolute",left:"38%",bottom:70,width:41,height:20,borderRadius:7,backgroundColor:"#e8f0e9",borderWidth:2,borderColor:"#52616a",transform:[{rotate:"-4deg"}]},sceneCarTwo:{position:"absolute",right:"21%",bottom:40,width:32,height:16,borderRadius:6,backgroundColor:"#d6785b",borderWidth:2,borderColor:"#4f5a62",transform:[{rotate:"-4deg"}]},sceneStamp:{position:"absolute",top:11,left:11,backgroundColor:"rgba(12,36,50,.8)",borderRadius:8,paddingHorizontal:9,paddingVertical:6},sceneStampText:{color:"#fff1c9",fontSize:9,fontWeight:"900",letterSpacing:1.2},sceneCaption:{position:"absolute",left:12,bottom:10},sceneCaptionTitle:{color:"#fff",fontSize:11,fontWeight:"800",textShadowColor:"rgba(0,0,0,.55)",textShadowRadius:5},sceneCaptionText:{color:"#e1e9e8",fontSize:9,marginTop:2,textShadowColor:"rgba(0,0,0,.55)",textShadowRadius:5},
  frame:{height:190,marginTop:13,borderRadius:17,overflow:"hidden",backgroundColor:"#29343d",position:"relative"},cameraImage:{...StyleSheet.absoluteFillObject,width:"100%",height:"100%"},imageState:{...StyleSheet.absoluteFillObject,zIndex:2,alignItems:"center",justifyContent:"center",gap:7,backgroundColor:"rgba(25,38,48,.94)"},imageStateTitle:{color:"#fff",fontSize:14,fontWeight:"800"},imageStateText:{color:"#d5dee2",fontSize:10},staleOverlay:{position:"absolute",zIndex:3,top:9,right:9,backgroundColor:"#653e16",paddingHorizontal:9,paddingVertical:6,borderRadius:9},staleOverlayText:{color:"#fff",fontSize:9,fontWeight:"900"},staleText:{fontSize:11,color:"#a45d19",marginTop:8},
  metaRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:8,paddingVertical:11},metaLabel:{fontSize:9,fontWeight:"900",letterSpacing:.8,color:"#8b969e"},metaValue:{flexShrink:1,textAlign:"right",fontSize:11,fontWeight:"700",color:"#344653"},metaDivider:{height:1,backgroundColor:"#edf0f1"},cardBottom:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderTopWidth:1,borderTopColor:"#edf0f1",paddingTop:12,marginTop:1},nearLabel:{fontSize:10,color:"#84919a"},nearValue:{fontSize:12,fontWeight:"800",color:"#263d49",marginTop:3},refreshButton:{backgroundColor:"#122c3f",paddingHorizontal:13,paddingVertical:10,borderRadius:13},refreshText:{fontSize:11,fontWeight:"800",color:"#fff"},
  locationButton:{backgroundColor:"#e0f0ed",alignItems:"center",padding:12,borderRadius:13},locationButtonText:{fontSize:12,fontWeight:"800",color:"#176d68"},cameraList:{gap:7},cameraListRow:{flexDirection:"row",alignItems:"center",gap:9,paddingHorizontal:10,paddingVertical:10,backgroundColor:"#fff",borderRadius:16,borderWidth:1,borderColor:"#edf0f1"},cameraListSelected:{borderColor:"#86b9b0",backgroundColor:"#f5fbf9"},miniIcon:{width:34,height:34,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:"#edf5f3"},listInfo:{flex:1},listName:{fontSize:12,fontWeight:"800",color:"#1f3340"},listRoad:{fontSize:10,color:"#8a969c",marginTop:3},listDistance:{fontSize:10,fontWeight:"800",color:"#4d6570"},listHeart:{paddingHorizontal:4},footerNote:{backgroundColor:"#eef2f2",padding:12,borderRadius:14},footerNoteText:{fontSize:10,lineHeight:15,color:"#62747b"},lastCheck:{textAlign:"center",fontSize:9,color:"#95a0a5",marginTop:-4}
});

function AboutLink({label,url}) {
  const s = appThemeStyles(useContext(ThemeContext));
  const { pad } = usePadLayout();
  return (
    <Pressable onPress={()=>Linking.openURL(url)} style={[s.aboutRow, pad && { minHeight: 56 }]}>
      <Text style={[s.aboutLabel, pad && { fontSize: 18 }]}>{label}</Text>
      <Text style={s.chev}>›</Text>
    </Pressable>
  );
}
