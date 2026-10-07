
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView, View, Text, StyleSheet, Pressable, Alert, ScrollView,
  Modal, TextInput, Switch, Vibration, Linking
} from "react-native";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapView, { Marker, Circle } from "react-native-maps";
import { StatusBar } from "expo-status-bar";
import data from "./cameras.json";
import plData from "./cameras-pl.json";
import { nearestPolandPoint, detectAverageSpeedSection, averageSectionSpeech } from "./poland-engine";
import { cameraPoints, countryFeed, loadCameraCache, saveCameraCache } from "./camera-data";
import { COUNTRY_NAMES } from "./countries";
import { refreshCountryDelivery } from "./camera-delivery";

const BACKGROUND_LOCATION_TASK = "camera-background-location-v060";
const MIN_MOVING_SPEED_KMH = 8;
const FORWARD_ANGLE_DEGREES = 45;
const HISTORY_KEY = "camera_history_v060";
const SETTINGS_KEY = "camera_settings_v060";
const REPORTS_KEY = "camera_reports_v060";
const HIDDEN_KEY = "camera_hidden_v060";

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
    reportHelp: "Как сообщить о камере", website: "Сайт приложения", coverage: "Покрытие", dataUpdate: "Обновление базы", lastUpdate: "Последнее обновление", updateNow: "Обновить сейчас", updated: "База обновлена", reportSent: "Сообщение отправлено на проверку", reportFailed: "Не удалось отправить, сохранено на телефоне", country: "Страна", ukraine: "Украина", poland: "Польша", languageLabel: "Язык", voiceLabel: "Голос", vibrationLabel: "Вибрация", smartDistanceLabel: "Умная дистанция по скорости", distancesLabel: "Дистанции предупреждения", band1: "До 60 км/ч", band2: "60–89 км/ч", band3: "90–119 км/ч", band4: "120+ км/ч"
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
    reportHelp: "Як повідомити про камеру", website: "Сайт застосунку", coverage: "Покриття", dataUpdate: "Оновлення бази", lastUpdate: "Останнє оновлення", updateNow: "Оновити зараз", updated: "Базу оновлено", reportSent: "Повідомлення надіслано на перевірку", reportFailed: "Не вдалося надіслати, збережено на телефоні", country: "Країна", ukraine: "Україна", poland: "Польща", languageLabel: "Мова", voiceLabel: "Голос", vibrationLabel: "Вібрація", smartDistanceLabel: "Розумна дистанція за швидкістю", distancesLabel: "Дистанції попередження", band1: "До 60 км/год", band2: "60–89 км/год", band3: "90–119 км/год", band4: "120+ км/год"
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
    reportHelp: "How to report a camera", website: "App website", coverage: "Coverage", dataUpdate: "Database update", lastUpdate: "Last update", updateNow: "Update now", updated: "Database updated", reportSent: "Report sent for review", reportFailed: "Could not send; saved on this phone", country: "Country", ukraine: "Ukraine", poland: "Poland", languageLabel: "Language", voiceLabel: "Voice", vibrationLabel: "Vibration", smartDistanceLabel: "Smart distance by speed", distancesLabel: "Alert distances", band1: "Up to 60 km/h", band2: "60–89 km/h", band3: "90–119 km/h", band4: "120+ km/h"
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
    website: "Strona aplikacji", coverage: "Zasięg", dataUpdate: "Aktualizacja bazy", lastUpdate: "Ostatnia aktualizacja", updateNow: "Aktualizuj teraz", updated: "Baza zaktualizowana", reportSent: "Zgłoszenie wysłano do weryfikacji", reportFailed: "Nie udało się wysłać; zapisano na telefonie",
    country: "Kraj", languageLabel: "Język", voiceLabel: "Głos", vibrationLabel: "Wibracje", smartDistanceLabel: "Inteligentna odległość według prędkości", distancesLabel: "Odległości ostrzegania", band1: "Do 60 km/h", band2: "60–89 km/h", band3: "90–119 km/h", band4: "120+ km/h",
    ukraine: "Ukraina",
    poland: "Polska"
  },
};

const DEFAULT_SETTINGS = {
  language: "ru",
  country: "ua",
  voice: true,
  vibration: true,
  smartDistance: true,
  cityDistance: 600,
  roadDistance: 900,
  highwayDistance: 1200,
  fastDistance: 1500,

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

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data: taskData, error }) => {
  if (error || !taskData?.locations?.length) return;
  try {
    const sraw = await AsyncStorage.getItem(SETTINGS_KEY);
    bgSettings = sraw ? { ...DEFAULT_SETTINGS, ...JSON.parse(sraw) } : DEFAULT_SETTINGS;
    const hraw = await AsyncStorage.getItem(HIDDEN_KEY);
    bgHiddenIds = new Set(hraw ? JSON.parse(hraw).map(String) : []);
    const cache = await loadCameraCache(AsyncStorage,REMOTE_CACHE_KEY);
    if (cache) {
      bgCameraFeeds = cache.feeds || {UA:cache.ua,PL:cache.pl};
    }
  } catch {}

  const pos = taskData.locations[taskData.locations.length - 1];
  const { latitude, longitude, speed: rawSpeed, heading: rawHeading } = pos.coords;
  const speedKmh = typeof rawSpeed === "number" && rawSpeed >= 0 ? Math.round(rawSpeed * 3.6) : 0;
  const heading = typeof rawHeading === "number" && rawHeading >= 0 ? norm(rawHeading) : null;
  if (speedKmh < MIN_MOVING_SPEED_KMH || heading == null) return;

  const threshold = alertDistanceForSpeed(speedKmh, bgSettings);
  const cam = findNearestAhead(latitude, longitude, heading, Math.max(5000, threshold + 1000));
  if (!cam || cam.distance > threshold) return;

  const now = Date.now();
  if (bgLastAlert.id === cam.id && now - bgLastAlert.at < 45000 && bgLastAlert.distance - cam.distance < 250) return;
  bgLastAlert = { id: cam.id, at: now, distance: cam.distance };

  const over = cam.speed_limit != null && speedKmh > Number(cam.speed_limit);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Камера через ${cam.distance < 1000 ? `${cam.distance} м` : `${(cam.distance/1000).toFixed(1)} км`}`,
      body: cam.speed_limit == null ? "Камера впереди." : over ? `Скорость ${speedKmh}. Ограничение ${cam.speed_limit}.` : `Ограничение ${cam.speed_limit} км/ч.`,
      sound: "default",
    },
    trigger: null,
  });
});

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const t = I18N[settings.language] || I18N.ru;

  const [coords, setCoords] = useState(null);
  const [nearest, setNearest] = useState(null);
  const [ahead, setAhead] = useState(null);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [heading, setHeading] = useState(null);
  const [plSectionId, setPlSectionId] = useState(null);
  const plLastSectionState = useRef(null);
  const [active, setActive] = useState(false);
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);
  const [history, setHistory] = useState([]);
  const [hiddenIds, setHiddenIds] = useState([]);
  const [reports, setReports] = useState([]);
  const [remoteFeeds,setRemoteFeeds]=useState({});
  const [countryCoverage,setCountryCoverage]=useState([]);
  const remoteFeedsRef=useRef({});
  const countryVersionsRef=useRef({});
  const selectedCountry=String(settings.country||"ua").toUpperCase();
  const activeUAData=countryFeed(remoteFeeds,"UA",data,plData);
  const activePLData=countryFeed(remoteFeeds,selectedCountry==="UA"?"PL":selectedCountry,data,plData);
  const activeCountryFeedRef=useRef(activePLData);
  activeCountryFeedRef.current=activePLData;
  const [coverage,setCoverage]=useState(null);
  const [lastDataUpdate,setLastDataUpdate]=useState(null);
  const [tab, setTab] = useState("drive");
  const [modal, setModal] = useState(null);
  const [reportNote, setReportNote] = useState("");
  const sub = useRef(null);
  const timer = useRef(null);
  const lastSpoken = useRef({ id: null, distance: Infinity });

  useEffect(() => {
    (async () => {
      try {
        const s = await AsyncStorage.getItem(SETTINGS_KEY);
        if (s) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(s) });
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
          setCountryCoverage(saved.countries||[]);setCoverage(saved.cov||null);setLastDataUpdate(saved.stamp||null);
        }
        await refreshRemoteData(true);
        const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        setBackgroundEnabled(started);
      } catch {}
    })();

    return () => {
      if (sub.current) sub.current.remove();
      if (timer.current) clearInterval(timer.current);
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(()=>{});
    bgSettings = settings;
  }, [settings]);

  useEffect(() => {
    if (active) stopTracking();
    setNearest(null);setAhead(null);setPlSectionId(null);plLastSectionState.current=null;
    refreshRemoteData(true,selectedCountry);
  }, [selectedCountry]);

  async function refreshRemoteData(silent=false,country=selectedCountry) {
    try {
      const result=await refreshCountryDelivery({country,feeds:remoteFeedsRef.current,versions:countryVersionsRef.current,countries:countryCoverage});
      if (!result.feed || result.source==='offline' || result.source==='bundled') return false;
      const feeds={...remoteFeedsRef.current,[country]:result.feed};
      const countryVersions={...countryVersionsRef.current};
      if(result.version)countryVersions[country]=result.version;else delete countryVersions[country];
      const countries=result.countries;
      const coverageFor=code=>countries.find(entry=>entry.country_code===code);
      const ua=feeds.UA,pl=feeds.PL;
      const cov={UA:{speed_cameras:ua?.count??ua?.cameras?.length??coverageFor('UA')?.speed_cameras??0},PL:pl?.counts||coverageFor('PL')||{}};
      remoteFeedsRef.current=feeds;countryVersionsRef.current=countryVersions;bgCameraFeeds=feeds;
      setRemoteFeeds(feeds);setCountryCoverage(countries);setCoverage(cov);
      const stamp = new Date().toISOString();
      setLastDataUpdate(stamp);
      await saveCameraCache(AsyncStorage,REMOTE_CACHE_KEY,{feeds,countries,cov,stamp,countryVersions},country).catch(()=>{});
      if (!silent) Alert.alert(t.updated);
      return true;

    } catch {
      return false;
    }
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

  function speakWarning(cam, threshold) {
    if (!cam || cam.distance > threshold) return;
    const last = lastSpoken.current;
    if (last.id === cam.id && last.distance - cam.distance < 250) return;

    const over = speedKmh > Number(cam.speed_limit);
    if (settings.vibration) {
      Vibration.vibrate(over ? [0, 250, 120, 250] : [0, 250]);
      Haptics.notificationAsync(over ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success).catch(()=>{});
    }
    if (settings.voice) {
      const rounded = Math.max(100, Math.round(cam.distance / 100) * 100);
      Speech.stop();
      Speech.speak(
        over
          ? `Камера впереди через ${rounded} метров. Снизьте скорость. Ограничение ${cam.speed_limit}.`
          : `Камера впереди через ${rounded} метров. Ограничение ${cam.speed_limit}.`,
        { language: settings.language === "uk" ? "uk-UA" : settings.language === "en" ? "en-US" : "ru-RU", rate: 0.95 }
      );
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
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") {
      Alert.alert("GPS", "Разреши приложению использовать местоположение.");
      return;
    }
    if (sub.current) sub.current.remove();
    sub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 5 },
      pos => {
        const { latitude, longitude, speed: rs, heading: rh } = pos.coords;
        const kmh = typeof rs === "number" && rs >= 0 ? Math.round(rs * 3.6) : 0;
        const h = typeof rh === "number" && rh >= 0 ? norm(rh) : null;
        setCoords({ latitude, longitude });
        setSpeedKmh(kmh);
        setHeading(h);

        bgHiddenIds = new Set(hiddenIds.map(String));

        if (selectedCountry !== "UA") {
          const point =
            kmh >= MIN_MOVING_SPEED_KMH && h != null
              ? nearestPolandPoint(activeCountryFeedRef.current, latitude, longitude, h, 5000)
              : null;

          setNearest(point);
          setAhead(point);

          if (point) {
            const threshold = alertDistanceForSpeed(kmh, settings);

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

          const sectionEvent =
            h != null
              ? detectAverageSpeedSection(
                  activeCountryFeedRef.current,
                  latitude,
                  longitude,
                  h,
                  plSectionId
                )
              : null;

          if (sectionEvent) {
            const key = `${sectionEvent.section.id}:${sectionEvent.state}`;

            if (plLastSectionState.current !== key) {
              plLastSectionState.current = key;

              if (sectionEvent.state === "entering") {
                setPlSectionId(String(sectionEvent.section.id));
              }

              if (sectionEvent.state === "ending") {
                setPlSectionId(null);
              }

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
          } else if (plSectionId == null) {
            plLastSectionState.current = null;
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
          speakWarning(a, alertDistanceForSpeed(kmh, settings));
        }
      }
    );
    setActive(true);
  }

  function stopTracking() {
    if (sub.current) { sub.current.remove(); sub.current = null; }
    Speech.stop();
    setActive(false); setAhead(null); setHeading(null);
  }

  async function toggleBackground() {
    if (backgroundEnabled) {
      if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
      setBackgroundEnabled(false);
      return;
    }
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") return;
    await Notifications.requestPermissionsAsync();
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== "granted") {
      Alert.alert("Фоновый режим", "Для фоновых предупреждений выбери доступ к геолокации «Всегда».");
      return;
    }
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 20,
      deferredUpdatesDistance: 20,
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
    setBackgroundEnabled(true);
  }

  function nearbyList() {
    if (!coords) return [];
    bgHiddenIds = new Set(hiddenIds.map(String));
    return visibleCameras()
      .map(c => ({...c, distance: Math.round(distanceMeters(coords.latitude, coords.longitude, c.latitude, c.longitude))}))
      .sort((a,b)=>a.distance-b.distance)
      .slice(0,20);
  }

  async function reportNewCamera() {
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

  const nav = [
    ["drive","🚗","Поездка"], ["map","🗺️",t.map], ["nearby","📍",t.nearby],
    ["history","🕘",t.history], ["settings","⚙️",t.settings]
  ];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="auto" />
      <View style={s.nav}>
        {nav.map(([key,icon,label]) => (
          <Pressable key={key} onPress={()=>setTab(key)} style={[s.navItem, tab===key && s.navActive]}>
            <Text style={s.navIcon}>{icon}</Text><Text style={s.navLabel}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>{t.title}</Text>
        <Text style={s.subtitle}>{COUNTRY_NAMES[selectedCountry]||selectedCountry} · {visibleCameras().length} камер</Text>

        {tab === "drive" && <>
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
            <View style={s.stat}><Text style={s.small}>{t.direction}</Text><Text style={s.heading}>{heading==null?t.waitMove:`${Math.round(heading)}°`}</Text><Text style={s.unit}>{coords?t.gpsWorks:t.gpsWait}</Text></View>
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
            <Pressable onPress={()=>setModal("new")} style={s.action}><Text style={s.actionText}>＋ {t.report}</Text></Pressable>
            <Pressable onPress={()=>shownCam?setModal("removed"):null} style={s.action}><Text style={s.actionText}>− {t.removed}</Text></Pressable>
          </View>
        </>}

        {tab === "map" && (
          coords ?
          <MapView style={s.map} initialRegion={{latitude:coords.latitude, longitude:coords.longitude, latitudeDelta:0.18, longitudeDelta:0.18}} showsUserLocation followsUserLocation>
            {nearbyList().slice(0,50).map(cam => (
              <Marker key={String(cam.id)} coordinate={{latitude:cam.latitude,longitude:cam.longitude}} title={cam.location || cam.region} description={cam.speed_limit != null ? `${cam.speed_limit} км/ч` : undefined} />
            ))}
            <Circle center={{latitude:coords.latitude,longitude:coords.longitude}} radius={currentThreshold} />
          </MapView>
          : <Text style={s.empty}>Включи поездку, чтобы открыть карту вокруг тебя.</Text>
        )}

        {tab === "nearby" && (
          <View style={s.list}>
            {nearbyList().map(cam => (
              <View key={String(cam.id)} style={s.listItem}>
                <View style={{flex:1}}>
                  <Text style={s.listTitle}>{cam.location || cam.road_index || cam.region}</Text>
                  <Text style={s.listSub}>{cam.region}{cam.speed_limit != null ? ` · ${cam.speed_limit} км/ч` : ""}</Text>
                </View>
                <Text style={s.listDistance}>{cam.distance>=1000?`${(cam.distance/1000).toFixed(1)} км`:`${cam.distance} м`}</Text>
              </View>
            ))}
            {!coords && <Text style={s.empty}>Сначала включи поездку.</Text>}
          </View>
        )}

        {tab === "history" && (
          <View style={s.list}>
            {history.map(h => (
              <View key={h.id} style={s.listItem}>
                <View style={{flex:1}}>
                  <Text style={s.listTitle}>{h.location}</Text>
                  <Text style={s.listSub}>{new Date(h.when).toLocaleString()} · {h.speed} км/ч</Text>
                </View>
                <Text style={s.listDistance}>{h.limit}</Text>
              </View>
            ))}
            {!history.length && <Text style={s.empty}>Предупреждений пока не было.</Text>}
          </View>
        )}

        {tab === "settings" && (
          <View style={s.settingsCard}>
            <Text style={s.sectionTitle}>{t.country}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[...new Set(["UA","PL",...countryCoverage.map(x=>x.country_code)])].map(code=>(
                <Pressable key={code} accessibilityRole="radio" accessibilityState={{selected:selectedCountry===code}}
                  onPress={()=>setSettings({...settings,country:code.toLowerCase()})}
                  style={[s.lang,selectedCountry===code&&s.langActive]}>
                  <Text>{COUNTRY_NAMES[code]||code}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={s.sectionTitle}>{t.languageLabel}</Text>
            <View style={s.row}>
              {["ru","uk","en","pl"].map(l => <Pressable key={l} onPress={()=>setSettings({...settings,language:l})} style={[s.lang,settings.language===l&&s.langActive]}><Text>{l==="uk"?"UA":l.toUpperCase()}</Text></Pressable>)}
            </View>
            <SettingSwitch label={t.voiceLabel} value={settings.voice} onChange={v=>setSettings({...settings,voice:v})}/>
            <SettingSwitch label={t.vibrationLabel} value={settings.vibration} onChange={v=>setSettings({...settings,vibration:v})}/>
            <SettingSwitch label={t.smartDistanceLabel} value={settings.smartDistance} onChange={v=>setSettings({...settings,smartDistance:v})}/>
            <Text style={s.sectionTitle}>{t.distancesLabel}</Text>
            {[
              [t.band1,"cityDistance"],[t.band2,"roadDistance"],
              [t.band3,"highwayDistance"],[t.band4,"fastDistance"]
            ].map(([label,key]) => <DistanceRow key={key} label={label} value={settings[key]} setValue={v=>setSettings({...settings,[key]:v})}/>)}
            <Text style={s.sectionTitle}>{t.dataUpdate}</Text>
            <View style={s.dataCard}>
              <View style={{flex:1}}>
                <Text style={s.dataLabel}>{t.lastUpdate}</Text>
                <Text style={s.dataValue}>{lastDataUpdate ? new Date(lastDataUpdate).toLocaleString() : "—"}</Text>
              </View>
              <Pressable onPress={()=>refreshRemoteData(false)} style={s.smallButton}>
                <Text style={s.smallButtonText}>{t.updateNow}</Text>
              </Pressable>
            </View>

            <Text style={s.sectionTitle}>{t.coverage}</Text>
            <View style={s.coverageCard}>
              {countryCoverage.map(item=><Text key={item.country_code} style={s.coverageLine}>{COUNTRY_NAMES[item.country_code]||item.country_code}: {item.total}</Text>)}
              <Pressable onPress={()=>Linking.openURL("https://www.openstreetmap.org/copyright")}><Text style={s.coverageLine}>© OpenStreetMap contributors · ODbL 1.0</Text></Pressable>
            </View>

            <Text style={s.sectionTitle}>{t.about}</Text>
            <AboutLink label={t.privacy} url={URLS.privacy}/>
            <AboutLink label={t.safety} url={URLS.safety}/>
            <AboutLink label={t.sources} url={URLS.sources}/>
            <AboutLink label={t.reportHelp} url={URLS.reportHelp}/>
            <AboutLink label={t.support} url={URLS.support}/>
            <AboutLink label={t.terms} url={URLS.terms}/>
            <AboutLink label={t.website} url={URLS.home}/>
            <Text style={s.note}>Локальных сообщений: {reports.length}. Скрытых камер: {hiddenIds.length}.</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={modal==="new"} transparent animationType="slide">
        <View style={s.modalShade}><View style={s.modalCard}>
          <Text style={s.modalTitle}>{t.reportTitle}</Text>
          <Text style={s.modalText}>{coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : "GPS недоступен"}</Text>
          <TextInput style={s.input} value={reportNote} onChangeText={setReportNote} placeholder="Комментарий, например направление или тип камеры" multiline />
          <Pressable onPress={reportNewCamera} style={s.button}><Text style={s.buttonText}>{t.send}</Text></Pressable>
          <Pressable onPress={()=>setModal(null)} style={s.cancel}><Text>{t.cancel}</Text></Pressable>
        </View></View>
      </Modal>

      <Modal visible={modal==="removed"} transparent animationType="slide">
        <View style={s.modalShade}><View style={s.modalCard}>
          <Text style={s.modalTitle}>{t.removedTitle}</Text>
          <Text style={s.modalText}>{shownCam?.location || shownCam?.region}</Text>
          <Pressable onPress={()=>reportRemovedCamera(shownCam)} style={[s.button,s.stop]}><Text style={s.buttonText}>{t.removed}</Text></Pressable>
          <Pressable onPress={()=>setModal(null)} style={s.cancel}><Text>{t.cancel}</Text></Pressable>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
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

function SettingSwitch({label,value,onChange}) {
  return <View style={s.settingRow}><Text style={s.settingLabel}>{label}</Text><Switch value={value} onValueChange={onChange}/></View>
}
function DistanceRow({label,value,setValue}) {
  return <View style={s.settingRow}>
    <Text style={s.settingLabel}>{label}</Text>
    <View style={s.stepper}>
      <Pressable onPress={()=>setValue(Math.max(200,value-100))} style={s.stepBtn}><Text>−</Text></Pressable>
      <Text style={s.stepValue}>{value} м</Text>
      <Pressable onPress={()=>setValue(Math.min(3000,value+100))} style={s.stepBtn}><Text>＋</Text></Pressable>
    </View>
  </View>
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#f5f6f8"},
  container:{padding:18,paddingBottom:150,gap:14},
  nav:{position:"absolute",left:12,right:12,bottom:10,zIndex:20,backgroundColor:"#fff",borderRadius:20,flexDirection:"row",padding:6,shadowOpacity:.12,shadowRadius:15},
  navItem:{flex:1,alignItems:"center",paddingVertical:5,borderRadius:13},navActive:{backgroundColor:"#eef0f3"},
  navIcon:{fontSize:17},navLabel:{fontSize:9,marginTop:1},
  title:{fontSize:30,fontWeight:"800",marginTop:8},subtitle:{fontSize:14,opacity:.55},
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
  settingsCard:{backgroundColor:"#fff",borderRadius:22,padding:18,gap:12},sectionTitle:{fontSize:18,fontWeight:"800",marginTop:6},settingRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:9,borderBottomWidth:1,borderBottomColor:"#eee"},settingLabel:{fontSize:14,flex:1},stepper:{flexDirection:"row",alignItems:"center",gap:8},stepBtn:{width:34,height:34,borderRadius:10,backgroundColor:"#eee",alignItems:"center",justifyContent:"center"},stepValue:{minWidth:58,textAlign:"center",fontWeight:"700"},lang:{flex:1,padding:12,backgroundColor:"#eee",borderRadius:12,alignItems:"center"},langActive:{backgroundColor:"#cfd7ff"},aboutRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:12,borderBottomWidth:1,borderBottomColor:"#eee"},aboutLabel:{fontSize:15},chev:{fontSize:24,opacity:.35},
  modalShade:{flex:1,backgroundColor:"rgba(0,0,0,.45)",justifyContent:"flex-end"},modalCard:{backgroundColor:"#fff",padding:22,borderTopLeftRadius:26,borderTopRightRadius:26,gap:14},modalTitle:{fontSize:23,fontWeight:"800"},modalText:{opacity:.6},input:{minHeight:90,borderWidth:1,borderColor:"#ddd",borderRadius:14,padding:12,textAlignVertical:"top"},cancel:{alignItems:"center",padding:12},
  typeLabel:{fontSize:12,fontWeight:"700",opacity:.5,marginTop:5},
  dataCard:{backgroundColor:"#f3f4f6",borderRadius:14,padding:14,flexDirection:"row",alignItems:"center",gap:12},
  dataLabel:{fontSize:12,opacity:.55},
  dataValue:{fontSize:13,fontWeight:"700",marginTop:3},
  coverageCard:{backgroundColor:"#f3f4f6",borderRadius:14,padding:14,gap:8},
  coverageLine:{fontSize:14,fontWeight:"650"},
note:{fontSize:12,lineHeight:18,opacity:.55}
});function AboutLink({label,url}) {
  return (
    <Pressable onPress={()=>Linking.openURL(url)} style={s.aboutRow}>
      <Text style={s.aboutLabel}>{label}</Text>
      <Text style={s.chev}>›</Text>
    </Pressable>
  );
}
