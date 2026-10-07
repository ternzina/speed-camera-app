import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  Modal,
  TextInput,
  Switch,
  Vibration,
  Linking,
} from "react-native";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import data from "./cameras.json";
import plData from "./cameras-pl.json";
import { averageSectionSpeech } from "./poland-engine";
import {
  cameraPoints,
  countryFeed,
  loadCameraCache,
  saveCameraCache,
} from "./camera-data";
import { countryLabel, buildCountryLists } from "./countries";
import { refreshCountryDelivery } from "./camera-delivery";
import {
  drivingPoints,
  nearestDrivingPoint,
  warningDistances,
  warningDecision,
  warningPhrase,
  voiceLocale,
  advanceAverageTrip,
  distanceBetween,
  bearingBetween,
} from "./driver-engine";
import { DRIVER_COPY, drivingLabel } from "./driver-copy";
import {
  REFERENCE_COPY,
  filterCountries,
  filterHistory,
} from "./reference-presentation";
import { Icon, CameraMap } from "./product-ui";
import {
  PRODUCT_COPY,
  CONTROL_ICONS,
  datasetDate,
} from "./product-presentation";
import { usableCameraRecordCount } from "./driver-engine";

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
    title: "Камеры на дорогах",
    start: "Начать поездку",
    stop: "Остановить",
    nearest: "Ближайшая камера",
    ahead: "Камера впереди по ходу движения",
    waitMove: "Ждёт движения",
    speed: "Текущая скорость",
    direction: "Направление",
    background: "Фоновый режим",
    on: "Включён",
    off: "Выключен",
    enable: "Включить",
    disable: "Выключить",
    map: "Карта",
    nearby: "Рядом",
    settings: "Настройки",
    history: "История",
    report: "Сообщить о камере",
    removed: "Камеры больше нет",
    limit: "Ограничение",
    aheadWarn: "Впереди камера",
    gpsWorks: "GPS работает",
    gpsWait: "GPS ждёт",
    saved: "Сохранено",
    cancel: "Отмена",
    send: "Сохранить сообщение",
    reportTitle: "Новая камера",
    removedTitle: "Камеры больше нет",
    note: "Сообщения пока сохраняются на телефоне. Сервер синхронизации подключим отдельно.",
    about: "О приложении",
    privacy: "Политика конфиденциальности",
    safety: "Безопасность",
    sources: "Источники данных",
    support: "Поддержка",
    terms: "Условия использования",
    reportHelp: "Как сообщить о камере",
    website: "Сайт приложения",
    coverage: "Покрытие",
    dataUpdate: "Обновление базы",
    lastUpdate: "Последнее обновление",
    updateNow: "Обновить сейчас",
    updated: "База обновлена",
    reportSent: "Сообщение отправлено на проверку",
    reportFailed: "Не удалось отправить, сохранено на телефоне",
    country: "Страна",
    ukraine: "Украина",
    poland: "Польша",
    languageLabel: "Язык",
    voiceLabel: "Голос",
    vibrationLabel: "Вибрация",
    smartDistanceLabel: "Умная дистанция по скорости",
    distancesLabel: "Дистанции предупреждения",
    band1: "До 60 км/ч",
    band2: "60–89 км/ч",
    band3: "90–119 км/ч",
    band4: "120+ км/ч",
  },
  uk: {
    title: "Камери на дорогах",
    start: "Почати поїздку",
    stop: "Зупинити",
    nearest: "Найближча камера",
    ahead: "Камера попереду за напрямком руху",
    waitMove: "Очікує руху",
    speed: "Поточна швидкість",
    direction: "Напрямок",
    background: "Фоновий режим",
    on: "Увімкнено",
    off: "Вимкнено",
    enable: "Увімкнути",
    disable: "Вимкнути",
    map: "Карта",
    nearby: "Поруч",
    settings: "Налаштування",
    history: "Історія",
    report: "Повідомити про камеру",
    removed: "Камери більше немає",
    limit: "Обмеження",
    aheadWarn: "Попереду камера",
    gpsWorks: "GPS працює",
    gpsWait: "GPS очікує",
    saved: "Збережено",
    cancel: "Скасувати",
    send: "Зберегти повідомлення",
    reportTitle: "Нова камера",
    removedTitle: "Камери більше немає",
    note: "Повідомлення поки зберігаються на телефоні. Сервер синхронізації підключимо окремо.",
    about: "Про застосунок",
    privacy: "Політика конфіденційності",
    safety: "Безпека",
    sources: "Джерела даних",
    support: "Підтримка",
    terms: "Умови використання",
    reportHelp: "Як повідомити про камеру",
    website: "Сайт застосунку",
    coverage: "Покриття",
    dataUpdate: "Оновлення бази",
    lastUpdate: "Останнє оновлення",
    updateNow: "Оновити зараз",
    updated: "Базу оновлено",
    reportSent: "Повідомлення надіслано на перевірку",
    reportFailed: "Не вдалося надіслати, збережено на телефоні",
    country: "Країна",
    ukraine: "Україна",
    poland: "Польща",
    languageLabel: "Мова",
    voiceLabel: "Голос",
    vibrationLabel: "Вібрація",
    smartDistanceLabel: "Розумна дистанція за швидкістю",
    distancesLabel: "Дистанції попередження",
    band1: "До 60 км/год",
    band2: "60–89 км/год",
    band3: "90–119 км/год",
    band4: "120+ км/год",
  },
  en: {
    title: "Road Cameras",
    start: "Start trip",
    stop: "Stop",
    nearest: "Nearest camera",
    ahead: "Camera ahead",
    waitMove: "Waiting for movement",
    speed: "Current speed",
    direction: "Direction",
    background: "Background mode",
    on: "On",
    off: "Off",
    enable: "Enable",
    disable: "Disable",
    map: "Map",
    nearby: "Nearby",
    settings: "Settings",
    history: "History",
    report: "Report camera",
    removed: "Camera is gone",
    limit: "Speed limit",
    aheadWarn: "Camera ahead",
    gpsWorks: "GPS active",
    gpsWait: "GPS waiting",
    saved: "Saved",
    cancel: "Cancel",
    send: "Save report",
    reportTitle: "New camera",
    removedTitle: "Camera is gone",
    note: "Reports are stored on this phone for now. Server sync will be connected separately.",
    about: "About",
    privacy: "Privacy Policy",
    safety: "Safety",
    sources: "Data sources",
    support: "Support",
    terms: "Terms of Use",
    reportHelp: "How to report a camera",
    website: "App website",
    coverage: "Coverage",
    dataUpdate: "Database update",
    lastUpdate: "Last update",
    updateNow: "Update now",
    updated: "Database updated",
    reportSent: "Report sent for review",
    reportFailed: "Could not send; saved on this phone",
    country: "Country",
    ukraine: "Ukraine",
    poland: "Poland",
    languageLabel: "Language",
    voiceLabel: "Voice",
    vibrationLabel: "Vibration",
    smartDistanceLabel: "Smart distance by speed",
    distancesLabel: "Alert distances",
    band1: "Up to 60 km/h",
    band2: "60–89 km/h",
    band3: "90–119 km/h",
    band4: "120+ km/h",
  },
  pl: {
    title: "Kamery drogowe",
    drive: "Jazda",
    map: "Mapa",
    nearby: "W pobliżu",
    history: "Historia",
    settings: "Ustawienia",
    start: "Rozpocznij jazdę",
    stop: "Zatrzymaj",
    nearest: "Najbliższy fotoradar",
    ahead: "Fotoradar przed Tobą",
    waitMove: "Czeka na ruch",
    speed: "Aktualna prędkość",
    direction: "Kierunek",
    gpsWorks: "GPS działa",
    gpsWait: "GPS czeka",
    background: "Tryb w tle",
    on: "Włączony",
    off: "Wyłączony",
    enable: "Włącz",
    disable: "Wyłącz",
    limit: "Ograniczenie",
    aheadWarn: "Fotoradar przed Tobą",
    report: "Zgłoś fotoradar",
    removed: "Fotoradaru już nie ma",
    saved: "Zapisano",
    cancel: "Anuluj",
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
    website: "Strona aplikacji",
    coverage: "Zasięg",
    dataUpdate: "Aktualizacja bazy",
    lastUpdate: "Ostatnia aktualizacja",
    updateNow: "Aktualizuj teraz",
    updated: "Baza zaktualizowana",
    reportSent: "Zgłoszenie wysłano do weryfikacji",
    reportFailed: "Nie udało się wysłać; zapisano na telefonie",
    country: "Kraj",
    languageLabel: "Język",
    voiceLabel: "Głos",
    vibrationLabel: "Wibracje",
    smartDistanceLabel: "Inteligentna odległość według prędkości",
    distancesLabel: "Odległości ostrzegania",
    band1: "Do 60 km/h",
    band2: "60–89 km/h",
    band3: "90–119 km/h",
    band4: "120+ km/h",
    ukraine: "Ukraina",
    poland: "Polska",
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

const toRad = (v) => (v * Math.PI) / 180;
const toDeg = (v) => (v * 180) / Math.PI;
const norm = (a) => ((a % 360) + 360) % 360;

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
  const p1 = toRad(lat1),
    p2 = toRad(lat2);
  const l1 = toRad(lon1),
    l2 = toRad(lon2);
  const y = Math.sin(l2 - l1) * Math.cos(p2);
  const x =
    Math.cos(p1) * Math.sin(p2) -
    Math.sin(p1) * Math.cos(p2) * Math.cos(l2 - l1);
  return norm(toDeg(Math.atan2(y, x)));
}
function alertDistanceForSpeed(speedKmh, settings) {
  return warningDistances(speedKmh, settings).first;
}
function visibleCameras() {
  return drivingPoints(
    countryFeed(bgCameraFeeds, bgSettings.country, data, plData),
  ).filter((c) => !bgHiddenIds.has(String(c.id)));
}
function findNearestAny(latitude, longitude, max = Infinity) {
  let best = null,
    bestDistance = Infinity;
  for (const cam of visibleCameras()) {
    const d = distanceMeters(latitude, longitude, cam.latitude, cam.longitude);
    if (d < bestDistance && d <= max) {
      bestDistance = d;
      best = cam;
    }
  }
  return best ? { ...best, distance: Math.round(bestDistance) } : null;
}
function findNearestAhead(
  latitude,
  longitude,
  movementHeading,
  maxDistance = 5000,
  accuracy = 0,
) {
  return nearestDrivingPoint(
    visibleCameras(),
    { latitude, longitude },
    movementHeading,
    maxDistance,
    accuracy,
  );
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

TaskManager.defineTask(
  BACKGROUND_LOCATION_TASK,
  async ({ data: taskData, error }) => {
    if (error || !taskData?.locations?.length) return;
    try {
      const sraw = await AsyncStorage.getItem(SETTINGS_KEY);
      bgSettings = sraw
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(sraw) }
        : DEFAULT_SETTINGS;
      const hraw = await AsyncStorage.getItem(HIDDEN_KEY);
      bgHiddenIds = new Set(hraw ? JSON.parse(hraw).map(String) : []);
      const cache = await loadCameraCache(AsyncStorage, REMOTE_CACHE_KEY);
      if (cache) {
        bgCameraFeeds = cache.feeds || { UA: cache.ua, PL: cache.pl };
      }
    } catch {}

    const pos = taskData.locations[taskData.locations.length - 1];
    const {
      latitude,
      longitude,
      speed: rawSpeed,
      heading: rawHeading,
    } = pos.coords;
    const speedKmh =
      typeof rawSpeed === "number" && rawSpeed >= 0
        ? Math.round(rawSpeed * 3.6)
        : 0;
    const heading =
      typeof rawHeading === "number" && rawHeading >= 0
        ? norm(rawHeading)
        : null;
    if (
      speedKmh < MIN_MOVING_SPEED_KMH ||
      heading == null ||
      pos.coords.accuracy > 80
    )
      return;

    const threshold = alertDistanceForSpeed(speedKmh, bgSettings);
    const cam = findNearestAhead(
      latitude,
      longitude,
      heading,
      Math.max(5000, threshold + 1000),
    );
    if (!cam || cam.distance > threshold) return;

    const result = warningDecision(bgLastAlert, cam, speedKmh, bgSettings);
    bgLastAlert = result.memory;
    if (!result.event) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: drivingLabel(
          cam,
          DRIVER_COPY[bgSettings.language] || DRIVER_COPY.ru,
        ),
        body: warningPhrase(
          cam,
          result.event,
          result.over,
          bgSettings.language,
        ),
        sound: bgSettings.voice ? "default" : null,
      },
      trigger: null,
    });
  },
);

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const t = I18N[settings.language] || I18N.ru;

  const [coords, setCoords] = useState(null);
  const [nearest, setNearest] = useState(null);
  const [ahead, setAhead] = useState(null);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [heading, setHeading] = useState(null);
  const [averageTrip, setAverageTrip] = useState(null);
  const plLastSectionState = useRef(null);
  const [active, setActive] = useState(false);
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);
  const [history, setHistory] = useState([]);
  const [hiddenIds, setHiddenIds] = useState([]);
  const [reports, setReports] = useState([]);
  const [remoteFeeds, setRemoteFeeds] = useState({});
  const [countryCoverage, setCountryCoverage] = useState([]);
  const countryCoverageRef = useRef([]);
  const [cacheReady, setCacheReady] = useState(false);
  const [downloadSelection, setDownloadSelection] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("");
  const deliveryQueue = useRef(Promise.resolve());
  const offlineText = {
    ru: {
      explanation:
        "Скачанные камеры и предупреждения доступны без интернета при включённой геолокации. Карта загружается отдельно.",
      downloaded: "Скачанные",
      available: "Доступные страны",
      territories: "Территории",
      none: "Пока нет скачанных стран",
      cameras: "камер",
      hint: "Нажмите название для выбора страны. Отметьте страны справа для офлайн-загрузки.",
      title: "Страны офлайн",
      download: "Скачать выбранные",
      update: "Доступно обновление",
      ready: "Сохранено офлайн",
      missing: "Не скачано",
      busy: "Загрузка",
      failed: "Не удалось скачать или сохранить",
      done: "Сохранено",
      empty:
        "Нет локальных данных. Подключитесь к интернету и скачайте страну.",
    },
    uk: {
      explanation:
        "Завантажені камери й попередження доступні без інтернету, якщо геолокацію ввімкнено. Карта завантажується окремо.",
      downloaded: "Завантажені",
      available: "Доступні країни",
      territories: "Території",
      none: "Поки немає завантажених країн",
      cameras: "камер",
      hint: "Натисніть назву, щоб вибрати країну. Позначте країни праворуч для офлайн-завантаження.",
      title: "Країни офлайн",
      download: "Завантажити вибрані",
      update: "Доступне оновлення",
      ready: "Збережено офлайн",
      missing: "Не завантажено",
      busy: "Завантаження",
      failed: "Не вдалося завантажити або зберегти",
      done: "Збережено",
      empty:
        "Немає локальних даних. Підключіться до інтернету й завантажте країну.",
    },
    en: {
      explanation:
        "Downloaded cameras and alerts work without internet when location is enabled. Map tiles load separately.",
      downloaded: "Downloaded",
      available: "Available countries",
      territories: "Territories",
      none: "No countries downloaded yet",
      cameras: "cameras",
      hint: "Tap a name to choose your driving country. Check countries on the right to download for offline use.",
      title: "Offline countries",
      download: "Download selected",
      update: "Update available",
      ready: "Saved offline",
      missing: "Not downloaded",
      busy: "Downloading",
      failed: "Could not download or save",
      done: "Saved",
      empty:
        "No local data. Connect to the internet and download this country.",
    },
    pl: {
      explanation:
        "Pobrane kamery i ostrzeżenia działają bez internetu przy włączonej lokalizacji. Mapa pobiera się osobno.",
      downloaded: "Pobrane",
      available: "Dostępne kraje",
      territories: "Terytoria",
      none: "Nie pobrano jeszcze krajów",
      cameras: "kamer",
      hint: "Dotknij nazwy, aby wybrać kraj. Zaznacz kraje po prawej stronie, aby pobrać je offline.",
      title: "Kraje offline",
      download: "Pobierz wybrane",
      update: "Dostępna aktualizacja",
      ready: "Zapisano offline",
      missing: "Nie pobrano",
      busy: "Pobieranie",
      failed: "Nie udało się pobrać lub zapisać",
      done: "Zapisano",
      empty: "Brak danych lokalnych. Połącz się z internetem i pobierz kraj.",
    },
  }[settings.language] || {
    explanation:
      "Downloaded cameras and alerts work without internet when location is enabled. Map tiles load separately.",
    downloaded: "Downloaded",
    available: "Available countries",
    territories: "Territories",
    none: "No countries downloaded yet",
    cameras: "cameras",
    hint: "Tap a name to choose your driving country. Check countries on the right to download for offline use.",
    title: "Offline countries",
    download: "Download selected",
    update: "Update available",
    ready: "Saved offline",
    missing: "Not downloaded",
    busy: "Downloading",
    failed: "Could not download or save",
    done: "Saved",
    empty: "No local data. Connect and download this country.",
  };
  const remoteFeedsRef = useRef({});
  const countryVersionsRef = useRef({});
  const selectedCountry = String(settings.country || "ua").toUpperCase();
  const activeUAData = countryFeed(remoteFeeds, "UA", data, plData);
  const activePLData = countryFeed(remoteFeeds, selectedCountry, data, plData);
  const activeCountryFeedRef = useRef(activePLData);
  activeCountryFeedRef.current = activePLData;
  const [coverage, setCoverage] = useState(null);
  const [lastDataUpdate, setLastDataUpdate] = useState(null);
  const [tab, setTab] = useState("drive");
  const [modal, setModal] = useState(null);
  const [reportNote, setReportNote] = useState("");
  const sub = useRef(null);
  const timer = useRef(null);
  const lastSpoken = useRef(null);
  const gpsPrevious = useRef(null);
  const averageOverspeedSpoken = useRef(null);
  const countryLists = useMemo(
    () => buildCountryLists(countryCoverage, remoteFeeds, settings.language),
    [countryCoverage, remoteFeeds, settings.language],
  );

  const [reportType, setReportType] = useState("speed_camera");
  const historyRef = useRef(history);
  historyRef.current = history;
  const drivingRef = useRef({});
  drivingRef.current = {
    settings,
    hiddenIds,
    feed: activePLData,
    country: selectedCountry,
  };
  const dcopy = DRIVER_COPY[settings.language] || DRIVER_COPY.ru;

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
        const saved = await loadCameraCache(AsyncStorage, REMOTE_CACHE_KEY);
        if (saved) {
          const feeds = saved.feeds || { UA: saved.ua, PL: saved.pl };
          remoteFeedsRef.current = feeds;
          countryVersionsRef.current = saved.countryVersions || {};
          bgCameraFeeds = feeds;
          setRemoteFeeds(feeds);
          countryCoverageRef.current = saved.countries || [];
          setCountryCoverage(saved.countries || []);
          setCoverage(saved.cov || null);
          setLastDataUpdate(saved.stamp || null);
        }
        setCacheReady(true);
        const started = await Location.hasStartedLocationUpdatesAsync(
          BACKGROUND_LOCATION_TASK,
        );
        setBackgroundEnabled(started);
      } catch {
        setCacheReady(true);
      }
    })();

    return () => {
      if (sub.current) sub.current.remove();
      if (timer.current) clearInterval(timer.current);
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (cacheReady)
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(
        () => {},
      );
    bgSettings = settings;
  }, [settings, cacheReady]);

  useEffect(() => {
    if (active) stopTracking();
    setNearest(null);
    setAhead(null);
    setAverageTrip(null);
    plLastSectionState.current = null;
    if (cacheReady) refreshRemoteData(true, selectedCountry);
  }, [selectedCountry, cacheReady]);

  function refreshRemoteData(silent = false, country = selectedCountry) {
    const run = () => performRefresh(silent, country);
    deliveryQueue.current = deliveryQueue.current.catch(() => {}).then(run);
    return deliveryQueue.current;
  }

  async function performRefresh(silent, country) {
    try {
      const result = await refreshCountryDelivery({
        country,
        feeds: remoteFeedsRef.current,
        versions: countryVersionsRef.current,
        countries: countryCoverageRef.current,
      });
      countryCoverageRef.current = result.countries;
      setCountryCoverage(result.countries);
      if (
        !result.feed ||
        result.source === "offline" ||
        result.source === "bundled"
      ) {
        await saveCameraCache(AsyncStorage, REMOTE_CACHE_KEY, {
          feeds: remoteFeedsRef.current,
          countries: result.countries,
          cov: coverage,
          stamp: lastDataUpdate,
          countryVersions: countryVersionsRef.current,
        });
        if (!silent) Alert.alert(offlineText.failed);
        return false;
      }
      const feeds = { ...remoteFeedsRef.current, [country]: result.feed };
      const countryVersions = { ...countryVersionsRef.current };
      if (result.version) countryVersions[country] = result.version;
      else delete countryVersions[country];
      const countries = result.countries;
      const coverageFor = (code) =>
        countries.find((entry) => entry.country_code === code);
      const ua = feeds.UA,
        pl = feeds.PL;
      const cov = {
        UA: {
          speed_cameras:
            ua?.count ??
            ua?.cameras?.length ??
            coverageFor("UA")?.speed_cameras ??
            0,
        },
        PL: pl?.counts || coverageFor("PL") || {},
      };
      const stamp = new Date().toISOString();
      await saveCameraCache(
        AsyncStorage,
        REMOTE_CACHE_KEY,
        { feeds, countries, cov, stamp, countryVersions },
        country,
      );
      remoteFeedsRef.current = feeds;
      countryVersionsRef.current = countryVersions;
      bgCameraFeeds = feeds;
      setRemoteFeeds(feeds);
      setCountryCoverage(countries);
      setCoverage(cov);
      setLastDataUpdate(stamp);
      if (!silent) Alert.alert(t.updated);
      return true;
    } catch {
      if (!silent) Alert.alert(offlineText.failed);
      return false;
    }
  }

  async function downloadCountries() {
    setDownloading(true);
    const failed = [];
    for (const code of downloadSelection) {
      setDownloadStatus(
        `${offlineText.busy}: ${countryLabel(code, settings.language)}`,
      );
      if (!(await refreshRemoteData(true, code))) failed.push(code);
    }
    setDownloadStatus(
      failed.length
        ? `${offlineText.failed}: ${failed.map((code) => countryLabel(code, settings.language)).join(", ")}`
        : offlineText.done,
    );
    setDownloading(false);
  }

  function renderCountryRow(item) {
    const code = item.country_code,
      checked = downloadSelection.includes(code),
      saved = !!remoteFeeds[code];
    const update =
      saved &&
      item.version &&
      countryVersionsRef.current[code] !== item.version;
    const bytes =
      item.size_bytes || item.export_size_bytes || item.byte_size || item.bytes;
    const updated =
      remoteFeeds[code]?.generated_at || remoteFeeds[code]?.updated_at;
    return (
      <View
        key={code}
        style={[
          s.dataCard,
          selectedCountry === code && {
            borderColor: "#2685e3",
            borderWidth: 1,
          },
        ]}
      >
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: selectedCountry === code }}
          accessibilityLabel={item.label}
          onPress={() =>
            setSettings((previous) => ({
              ...previous,
              country: code.toLowerCase(),
            }))
          }
          style={{ flex: 1, paddingVertical: 6 }}
        >
          <Text style={[s.dataLabel, { fontSize: 16 }]}>{item.label}</Text>
          <Text style={s.note}>
            {item.publishedCount.toLocaleString(settings.language)}{" "}
            {offlineText.cameras} ·{" "}
            {bytes
              ? `${(bytes / 1000000).toLocaleString(settings.language, { maximumFractionDigits: 1 })} МБ`
              : dcopy.sizeUnknown}
          </Text>
          {saved && <Text style={s.savedLabel}>{dcopy.saved}</Text>}
          {saved && updated && (
            <Text style={s.note}>
              {new Date(updated).toDateString() === new Date().toDateString()
                ? dcopy.today
                : `${dcopy.updated} ${new Date(updated).toLocaleDateString(settings.language)}`}
            </Text>
          )}
          {!!update && <Text style={s.note}>{offlineText.update}</Text>}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            item.label +
            " · " +
            (REFERENCE_COPY[settings.language] || REFERENCE_COPY.ru).details
          }
          onPress={() => setCountryDetail(item)}
          style={s.countryDetailButton}
        >
          <Icon name="chevron-right" color="#007aff" size={20} />
        </Pressable>
        {(!saved || update) && (
          <Pressable
            accessibilityRole="button"
            disabled={downloading}
            accessibilityLabel={`${update ? dcopy.update : dcopy.download}: ${item.label}`}
            onPress={() => refreshRemoteData(false, code)}
            style={s.countryDownload}
          >
            <Icon
              name={update ? "refresh-cw" : "download-cloud"}
              color="#007aff"
              size={22}
            />
          </Pressable>
        )}
        <Pressable
          disabled={downloading}
          accessibilityRole="checkbox"
          accessibilityLabel={`${offlineText.download}: ${item.label}`}
          accessibilityState={{ checked, disabled: downloading }}
          onPress={() =>
            setDownloadSelection((previous) =>
              previous.includes(code)
                ? previous.filter((x) => x !== code)
                : [...previous, code],
            )
          }
          style={[
            s.lang,
            {
              flex: 0,
              width: 44,
              minWidth: 44,
              minHeight: 44,
              paddingHorizontal: 0,
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
        >
          <Icon
            name={checked ? "check-square" : "square"}
            color={checked ? "#007aff" : "#9ba7b7"}
            size={21}
          />
        </Pressable>
      </View>
    );
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
    const next = [item, ...historyRef.current].slice(0, 100);
    historyRef.current = next;
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

  function speakWarning(cam, kmh, currentSettings) {
    const result = warningDecision(
      lastSpoken.current,
      cam,
      kmh,
      currentSettings,
    );
    lastSpoken.current = result.memory;
    if (!result.event) return;
    if (currentSettings.vibration) {
      Vibration.vibrate(result.over ? [0, 200, 100, 200] : [0, 120]);
      Haptics.notificationAsync(
        result.over
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    }
    if (currentSettings.voice)
      Speech.speak(
        warningPhrase(cam, result.event, result.over, currentSettings.language),
        { language: voiceLocale(currentSettings.language), rate: 0.95 },
      );
    if (result.event === "first")
      saveHistory({
        id: `${Date.now()}-${cam.id}`,
        cameraId: cam.id,
        when: new Date().toISOString(),
        distance: cam.distance,
        speed: kmh,
        limit: cam.speed_limit,
        location: drivingLabel(
          cam,
          DRIVER_COPY[currentSettings.language] || DRIVER_COPY.ru,
        ),
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
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 5,
      },
      (pos) => {
        const { latitude, longitude, speed: rs, heading: rh } = pos.coords;
        const kmh =
          typeof rs === "number" && rs >= 0 ? Math.round(rs * 3.6) : 0;
        const previous = gpsPrevious.current;
        const position = { latitude, longitude };
        const h =
          pos.coords.accuracy > 80
            ? null
            : typeof rh === "number" && rh >= 0
              ? norm(rh)
              : previous && distanceBetween(previous, position) >= 8
                ? bearingBetween(previous, position)
                : null;
        gpsPrevious.current = position;
        setCoords({ latitude, longitude });
        setSpeedKmh(kmh);
        setHeading(h);

        const current = drivingRef.current;
        const points = drivingPoints(current.feed).filter(
          (p) => !current.hiddenIds.map(String).includes(String(p.id)),
        );
        const point =
          kmh >= MIN_MOVING_SPEED_KMH && h != null
            ? nearestDrivingPoint(
                points,
                { latitude, longitude },
                h,
                5000,
                pos.coords.accuracy,
              )
            : null;
        setNearest(null);
        setAhead(point);
        const progress = advanceAverageTrip(
          plLastSectionState.current,
          current.feed,
          { latitude, longitude },
          h,
          pos.timestamp || Date.now(),
          pos.coords.accuracy,
        );
        plLastSectionState.current = progress.trip;
        setAverageTrip(progress.trip);
        if (
          point &&
          progress.event !== "entering" &&
          progress.event !== "ending"
        )
          speakWarning(point, kmh, current.settings);
        if (!progress.trip) averageOverspeedSpoken.current = null;
        if (
          progress.trip &&
          progress.trip.section.speed_limit > 0 &&
          progress.trip.average > progress.trip.section.speed_limit + 3 &&
          progress.trip.lastAt - progress.trip.startedAt >= 15000 &&
          averageOverspeedSpoken.current !== progress.trip.section.id
        ) {
          averageOverspeedSpoken.current = progress.trip.section.id;
          if (current.settings.voice)
            Speech.speak(
              warningPhrase(
                { ...progress.trip.section, distance: 0 },
                "over",
                true,
                current.settings.language,
              ),
              { language: voiceLocale(current.settings.language), rate: 0.95 },
            );
        }
        if (progress.event === "entering" || progress.event === "ending") {
          const phrase = averageSectionSpeech(
            { state: progress.event, section: progress.section },
            current.settings.language,
          );
          if (current.settings.voice && phrase)
            Speech.speak(phrase, {
              language: voiceLocale(current.settings.language),
              rate: 0.95,
            });
        }
      },
    );
    lastSpoken.current = null;
    gpsPrevious.current = null;
    averageOverspeedSpoken.current = null;
    bgLastAlert = null;
    setActive(true);
  }

  function stopTracking() {
    if (sub.current) {
      sub.current.remove();
      sub.current = null;
    }
    Speech.stop();
    setActive(false);
    setSpeedKmh(0);
    setAhead(null);
    setHeading(null);
    setAverageTrip(null);
    plLastSectionState.current = null;
    lastSpoken.current = null;
  }

  async function toggleBackground() {
    if (backgroundEnabled) {
      if (
        await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)
      ) {
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
      Alert.alert(
        "Фоновый режим",
        "Для фоновых предупреждений выбери доступ к геолокации «Всегда».",
      );
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
      .map((c) => ({
        ...c,
        distance: Math.round(
          distanceMeters(
            coords.latitude,
            coords.longitude,
            c.latitude,
            c.longitude,
          ),
        ),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20);
  }

  async function reportNewCamera() {
    if (!coords) {
      Alert.alert(
        "GPS",
        "Сначала включи поездку, чтобы приложение знало координаты.",
      );
      return;
    }
    const item = {
      id: `new-${Date.now()}`,
      type: "new",
      camera_type: reportType,
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

    Alert.alert(t.saved, sent ? t.reportSent : t.reportFailed);
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

    Alert.alert(t.saved, sent ? t.reportSent : t.reportFailed);
  }

  const shownCam = ahead;
  const shownDistance = ahead?.distance;
  const currentThreshold = alertDistanceForSpeed(speedKmh, settings);
  const danger =
    shownDistance != null && shownDistance <= currentThreshold && !!ahead;

  const drivingLimit =
    averageTrip?.section?.speed_limit || shownCam?.speed_limit;
  const overLimit = drivingLimit > 0 && speedKmh > drivingLimit + 3;
  const closeStage = shownDistance <= Math.max(250, (speedKmh / 3.6) * 12);
  const nearStage =
    shownDistance <= warningDistances(speedKmh, settings).second;
  const pcopy = PRODUCT_COPY[settings.language] || PRODUCT_COPY.ru;
  const mapPoints = useMemo(() => {
    const hidden = new Set(hiddenIds.map(String));
    return drivingPoints(activePLData).filter((p) => !hidden.has(String(p.id)));
  }, [activePLData, hiddenIds]);
  const datasetCount = useMemo(
    () => usableCameraRecordCount(activePLData),
    [activePLData],
  );
  const publishedDate = activePLData?.generated_at || activePLData?.updated_at;
  async function locateOnMap() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") return null;
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const position = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      };
      setCoords(position);
      return position;
    } catch {
      Alert.alert(pcopy.locationError);
      return null;
    }
  }
  const [countrySearch, setCountrySearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [countryDetail, setCountryDetail] = useState(null);
  const [historyPeriod, setHistoryPeriod] = useState(30);
  const [viewportHeight, setViewportHeight] = useState(650);
  const [headerHeight, setHeaderHeight] = useState(44);
  const ui = REFERENCE_COPY[settings.language] || REFERENCE_COPY.ru;
  const visibleHistory = filterHistory(history, historyPeriod);
  const listedCountries = filterCountries(
    countryLists,
    countrySearch,
    countryFilter,
    settings.language,
  );
  const detailFeed = countryDetail
    ? remoteFeeds[countryDetail.country_code]
    : null;
  const detailSize =
    countryDetail &&
    (countryDetail.size_bytes ||
      countryDetail.export_size_bytes ||
      countryDetail.byte_size ||
      countryDetail.bytes);
  const nav = [
    ["drive", "navigation", dcopy.drive],
    ["map", "map", t.map],
    ["offline", "globe", pcopy.countries],
    ["history", "clock", t.history],
    ["settings", "settings", dcopy.settings],
  ];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <ScrollView
        style={{ flex: 1 }}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        scrollEnabled={tab !== "map"}
        contentContainerStyle={[
          s.container,
          { flexGrow: 1 },
          tab === "map" && { flex: 1, padding: 12, paddingBottom: 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={s.topBar}
          onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        >
          <Text
            style={[s.brand, { flex: 1 }, tab === "drive" && { fontSize: 26 }]}
          >
            {tab === "drive"
              ? "CamAlert"
              : tab === "offline"
                ? pcopy.countries
                : tab === "settings"
                  ? dcopy.settings
                  : tab === "history"
                    ? t.history
                    : t.map}
          </Text>
          {["drive", "map"].includes(tab) && (
            <Text style={s.countryPill}>
              {countryLabel(selectedCountry, settings.language)}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dcopy.settings}
            onPress={() => setTab("settings")}
            style={s.headerSettings}
          >
            <Icon name="settings" />
          </Pressable>
        </View>

        {tab === "drive" && (
          <View style={s.driver}>
            <View style={s.speedPanel}>
              <View
                style={[
                  s.speedRing,
                  (shownCam || averageTrip) && s.speedRingCompact,
                  overLimit && { borderColor: "#edb5ad" },
                ]}
              >
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={[
                    s.heroSpeed,
                    (shownCam || averageTrip) && {
                      fontSize: 72,
                      lineHeight: 86,
                    },
                    overLimit && s.speedOver,
                  ]}
                >
                  {speedKmh}
                </Text>
                <Text style={s.speedUnit}>{dcopy.unit}</Text>
              </View>
              {(averageTrip?.section?.speed_limit || shownCam?.speed_limit) >
                0 && (
                <View style={s.driverLimit}>
                  <Text style={s.limitCaption}>{dcopy.limit}</Text>
                  <Text style={s.driverLimitNumber}>
                    {averageTrip?.section?.speed_limit || shownCam.speed_limit}
                  </Text>
                </View>
              )}
            </View>
            {averageTrip ? (
              <View
                style={[
                  s.driverAlert,
                  averageTrip.section.speed_limit > 0 &&
                    averageTrip.average > averageTrip.section.speed_limit + 3 &&
                    s.driverAlertOver,
                ]}
              >
                <Text style={s.alertTitle}>{dcopy.average}</Text>
                <Text style={s.averageNumber}>
                  {dcopy.averageValue}: {Math.round(averageTrip.average)}{" "}
                  {dcopy.unit}
                </Text>
                <Text style={s.alertDetail}>
                  {dcopy.limit} {averageTrip.section.speed_limit || "—"} ·{" "}
                  {dcopy.remaining} ≈{" "}
                  {(averageTrip.remaining / 1000).toLocaleString(
                    settings.language,
                    { maximumFractionDigits: 1 },
                  )}{" "}
                  {dcopy.km}
                </Text>
              </View>
            ) : shownCam ? (
              <View
                accessibilityLiveRegion="polite"
                style={[
                  s.driverAlert,
                  closeStage && s.driverAlertClose,
                  nearStage && s.driverAlertNear,
                  overLimit && s.driverAlertOver,
                ]}
              >
                <View
                  style={[
                    s.warningBadge,
                    overLimit && {
                      backgroundColor: "#fff1f0",
                      borderColor: "#f04438",
                    },
                  ]}
                >
                  <Icon
                    name={CONTROL_ICONS[shownCam.type] || "camera"}
                    size={34}
                    color={overLimit ? "#f04438" : "#007aff"}
                  />
                </View>
                <Text style={s.alertTitle}>
                  {drivingLabel(shownCam, dcopy)}
                </Text>
                <Text style={s.alertDistance}>
                  {shownDistance} {dcopy.meters}
                </Text>
                <Text style={s.alertDetail}>
                  {overLimit
                    ? dcopy.slow
                    : shownCam.speed_limit
                      ? `${dcopy.limit} ${shownCam.speed_limit}`
                      : ""}
                </Text>
              </View>
            ) : (
              <View style={s.clearCard}>
                <Text style={s.clearTitle}>
                  {active &&
                  coords &&
                  heading != null &&
                  speedKmh >= MIN_MOVING_SPEED_KMH
                    ? dcopy.clear
                    : active
                      ? dcopy.heading
                      : dcopy.idle}
                </Text>
                <View style={s.statusLines}>
                  <View style={s.statusLine}>
                    <Icon name="map-pin" size={15} />
                    <Text style={s.statusText}>
                      {coords
                        ? active
                          ? pcopy.gps
                          : pcopy.gpsReady
                        : pcopy.gpsWaiting}
                    </Text>
                  </View>
                  <View style={s.statusLine}>
                    <Icon
                      name={settings.voice ? "volume-2" : "volume-x"}
                      size={15}
                    />
                    <Text style={s.statusText}>
                      {settings.voice ? pcopy.voiceOn : pcopy.voiceOff}
                    </Text>
                  </View>
                  <View style={s.statusLine}>
                    <Icon
                      name={
                        remoteFeeds[selectedCountry]
                          ? "check-circle"
                          : "download"
                      }
                      size={15}
                    />
                    <Text style={s.statusText}>
                      {remoteFeeds[selectedCountry]
                        ? pcopy.loaded
                        : pcopy.notLoaded}
                    </Text>
                  </View>
                </View>
              </View>
            )}
            {!shownCam && !averageTrip && (
              <View style={s.datasetMini}>
                <View style={s.datasetBadge}>
                  <Icon name="database" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.datasetCount}>
                    {datasetCount.toLocaleString(settings.language)}{" "}
                    {pcopy.cameraCount}
                  </Text>
                  <Text style={s.datasetDate}>
                    {datasetDate(publishedDate, settings.language, pcopy)}
                  </Text>
                </View>
              </View>
            )}
            <View style={s.tripActions}>
              <Pressable
                accessibilityRole="button"
                onPress={active ? stopTracking : startTracking}
                style={[s.tripButton, active && s.tripStop]}
              >
                <Text
                  style={[s.tripButtonText, active && { color: "#101828" }]}
                >
                  {active ? t.stop : t.start}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={pcopy.report}
                onPress={() => setModal("add")}
                style={s.addButton}
              >
                <Icon name="plus" color="#007aff" size={20} />
                <Text style={s.reportButtonText}>{pcopy.report}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {tab === "map" && (
          <CameraMap
            height={Math.max(240, viewportHeight - headerHeight - 58)}
            points={mapPoints}
            coords={coords}
            copy={pcopy}
            driverCopy={dcopy}
            language={settings.language}
            warning={
              shownCam
                ? { camera: shownCam, distance: shownDistance, over: overLimit }
                : null
            }
            onLocate={locateOnMap}
            onReport={() => setModal("add")}
          />
        )}

        {tab === "nearby" && (
          <View style={s.list}>
            {nearbyList().map((cam) => (
              <View key={String(cam.id)} style={s.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={s.listTitle}>
                    {cam.location ||
                      cam.road_index ||
                      cam.region ||
                      drivingLabel(cam, dcopy)}
                  </Text>
                  <Text style={s.listSub}>
                    {cam.region}
                    {cam.speed_limit != null
                      ? ` · ${cam.speed_limit} км/ч`
                      : ""}
                  </Text>
                </View>
                <Text style={s.listDistance}>
                  {cam.distance >= 1000
                    ? `${(cam.distance / 1000).toFixed(1)} км`
                    : `${cam.distance} м`}
                </Text>
              </View>
            ))}
            {!coords && <Text style={s.empty}>Сначала включи поездку.</Text>}
          </View>
        )}

        {tab === "history" && (
          <View style={{ gap: 16 }}>
            <View style={s.segment}>
              {[1, 7, 30].map((days) => (
                <Pressable
                  key={days}
                  accessibilityRole="button"
                  accessibilityState={{ selected: historyPeriod === days }}
                  onPress={() => setHistoryPeriod(days)}
                  style={[
                    s.segmentItem,
                    historyPeriod === days && s.segmentActive,
                  ]}
                >
                  <Text
                    style={[
                      s.segmentText,
                      historyPeriod === days && s.segmentTextActive,
                    ]}
                  >
                    {days === 1 ? ui.today : days === 7 ? ui.week : ui.month}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={s.row}>
              <View style={s.stat}>
                <Text style={s.listSub}>{ui.alerts}</Text>
                <Text style={s.summaryNumber}>{visibleHistory.length}</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.listSub}>{ui.savedCountries}</Text>
                <Text style={s.summaryNumber}>
                  {countryLists.downloaded.length}
                </Text>
              </View>
            </View>
            <Text style={s.sectionTitle}>{ui.recent}</Text>
            {visibleHistory.map((h) => (
              <View key={h.id} style={s.listItem}>
                <View style={s.timelineIcon}>
                  <Icon name="camera" color="#007aff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.listTitle}>{h.location || dcopy.camera}</Text>
                  <Text style={s.listSub}>
                    {new Date(h.when).toLocaleString(settings.language)} ·{" "}
                    {h.speed} {dcopy.unit}
                  </Text>
                </View>
                {h.limit > 0 && <Text style={s.historyLimit}>{h.limit}</Text>}
              </View>
            ))}
            {!visibleHistory.length && (
              <View style={s.emptyCard}>
                <Icon name="clock" size={32} color="#007aff" />
                <Text style={s.sectionTitle}>{ui.noHistory}</Text>
                <Text style={s.emptyCopy}>{ui.historyHint}</Text>
              </View>
            )}
          </View>
        )}

        {tab === "offline" && (
          <View style={s.countryScreen}>
            <View style={s.searchBox}>
              <Icon name="search" size={18} />
              <TextInput
                accessibilityLabel={ui.search}
                placeholder={ui.search}
                value={countrySearch}
                onChangeText={setCountrySearch}
                style={s.searchInput}
                placeholderTextColor="#8c96a5"
              />
            </View>
            <View style={s.segment}>
              {[
                ["all", ui.all],
                ["downloaded", offlineText.downloaded],
                ["popular", ui.popular],
              ].map(([key, label]) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: countryFilter === key }}
                  onPress={() => setCountryFilter(key)}
                  style={[
                    s.segmentItem,
                    countryFilter === key && s.segmentActive,
                  ]}
                >
                  <Text
                    style={[
                      s.segmentText,
                      countryFilter === key && s.segmentTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {!remoteFeeds[selectedCountry] &&
              !["UA", "PL"].includes(selectedCountry) && (
                <Text style={s.note}>{offlineText.empty}</Text>
              )}
            <Text style={s.note}>{ui.countryHint}</Text>
            <View>
              <Text style={s.sectionTitle}>{offlineText.downloaded}</Text>
              {!listedCountries.downloaded.length && (
                <Text style={s.note}>{offlineText.none}</Text>
              )}
              {listedCountries.downloaded.map(renderCountryRow)}
              {countryFilter !== "downloaded" && (
                <Text style={s.sectionTitle}>
                  {countryFilter === "popular"
                    ? ui.popular
                    : offlineText.available}{" "}
                  ({listedCountries.available.length})
                </Text>
              )}
              {listedCountries.available.map(renderCountryRow)}
              {!!countrySearch &&
                !listedCountries.downloaded.length &&
                !listedCountries.available.length && (
                  <Text style={s.empty}>{ui.noResults}</Text>
                )}
            </View>
            {countryFilter !== "downloaded" &&
              !!countryLists.territories.length && (
                <Pressable
                  onPress={() => setModal("territories")}
                  style={s.smallButton}
                >
                  <Text style={s.smallButtonText}>
                    {offlineText.territories} ({countryLists.territories.length}
                    )
                  </Text>
                </Pressable>
              )}
            <Pressable
              disabled={downloading || !downloadSelection.length}
              onPress={downloadCountries}
              style={[
                s.smallButton,
                { opacity: downloading || !downloadSelection.length ? 0.5 : 1 },
              ]}
            >
              <Text style={s.smallButtonText}>
                {offlineText.download} ({downloadSelection.length})
              </Text>
            </Pressable>
            <View style={s.offlineNotice}>
              <Icon name="wifi-off" color="#007aff" />
              <Text style={[s.note, { flex: 1 }]}>
                {offlineText.explanation}
              </Text>
            </View>
            {!!downloadStatus && (
              <Text accessibilityLiveRegion="polite" style={s.note}>
                {downloadStatus}
              </Text>
            )}
          </View>
        )}
        {tab === "settings" && (
          <View style={s.settingsCard}>
            <View style={s.profileCard}>
              <View style={s.timelineIcon}>
                <Icon name="shield" color="#007aff" size={26} />
              </View>
              <View>
                <Text style={s.dataLabel}>CamAlert</Text>
                <Text style={s.listSub}>{ui.driverAssistant}</Text>
              </View>
            </View>
            <Text style={s.sectionTitle}>{ui.driving}</Text>
            <Pressable onPress={() => setTab("offline")} style={s.dataCard}>
              <Icon name="download-cloud" color="#007aff" />
              <Text style={[s.dataLabel, { flex: 1, fontSize: 16 }]}>
                {dcopy.offline}
              </Text>
              <Icon name="chevron-right" size={18} />
            </Pressable>
            <Pressable onPress={() => setTab("nearby")} style={s.dataCard}>
              <Icon name="map-pin" color="#007aff" />
              <Text style={[s.dataLabel, { flex: 1, fontSize: 16 }]}>
                {t.nearby}
              </Text>
              <Icon name="chevron-right" size={18} />
            </Pressable>
            <Pressable onPress={() => setTab("history")} style={s.dataCard}>
              <Icon name="clock" color="#007aff" />
              <Text style={[s.dataLabel, { flex: 1, fontSize: 16 }]}>
                {t.history}
              </Text>
              <Icon name="chevron-right" size={18} />
            </Pressable>
            <View style={s.backgroundCard}>
              <Icon name="moon" color="#007aff" />
              <Text style={[s.dataLabel, { flex: 1, fontSize: 14 }]}>
                {dcopy.background}
              </Text>
              <Switch
                value={backgroundEnabled}
                onValueChange={() =>
                  toggleBackground().catch(() =>
                    Alert.alert(dcopy.background, dcopy.gps),
                  )
                }
              />
            </View>
            <Text style={s.sectionTitle}>{t.languageLabel}</Text>
            <View style={s.row}>
              {["ru", "uk", "en", "pl"].map((l) => (
                <Pressable
                  key={l}
                  onPress={() => setSettings({ ...settings, language: l })}
                  style={[s.lang, settings.language === l && s.langActive]}
                >
                  <Text>
                    {
                      {
                        ru: "Русский",
                        uk: "Українська",
                        en: "English",
                        pl: "Polski",
                      }[l]
                    }
                  </Text>
                </Pressable>
              ))}
            </View>
            <SettingSwitch
              icon="volume-2"
              label={t.voiceLabel}
              value={settings.voice}
              onChange={(v) => setSettings({ ...settings, voice: v })}
            />
            <SettingSwitch
              icon="smartphone"
              label={t.vibrationLabel}
              value={settings.vibration}
              onChange={(v) => setSettings({ ...settings, vibration: v })}
            />
            <SettingSwitch
              icon="navigation"
              label={t.smartDistanceLabel}
              value={settings.smartDistance}
              onChange={(v) => setSettings({ ...settings, smartDistance: v })}
            />
            {!settings.smartDistance && (
              <>
                <Text style={s.sectionTitle}>{t.distancesLabel}</Text>
                {[
                  [t.band1, "cityDistance"],
                  [t.band2, "roadDistance"],
                  [t.band3, "highwayDistance"],
                  [t.band4, "fastDistance"],
                ].map(([label, key]) => (
                  <DistanceRow
                    key={key}
                    label={label}
                    value={settings[key]}
                    setValue={(v) => setSettings({ ...settings, [key]: v })}
                  />
                ))}
              </>
            )}
            <Text style={s.sectionTitle}>{t.dataUpdate}</Text>
            <View style={s.dataCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.dataLabel}>{t.lastUpdate}</Text>
                <Text style={s.dataValue}>
                  {lastDataUpdate
                    ? new Date(lastDataUpdate).toLocaleString()
                    : "—"}
                </Text>
              </View>
              <Pressable
                onPress={() => refreshRemoteData(false)}
                style={s.smallButton}
              >
                <Text style={s.smallButtonText}>{t.updateNow}</Text>
              </Pressable>
            </View>

            <View style={s.coverageCard}>
              <Pressable
                onPress={() =>
                  Linking.openURL("https://www.openstreetmap.org/copyright")
                }
              >
                <Text style={s.coverageLine}>
                  © OpenStreetMap contributors · ODbL 1.0
                </Text>
              </Pressable>
            </View>

            <Text style={s.sectionTitle}>{t.about}</Text>
            <AboutLink label={t.privacy} url={URLS.privacy} />
            <AboutLink label={t.safety} url={URLS.safety} />
            <AboutLink label={t.sources} url={URLS.sources} />
            <AboutLink label={t.reportHelp} url={URLS.reportHelp} />
            <AboutLink label={t.support} url={URLS.support} />
            <AboutLink label={t.terms} url={URLS.terms} />
            <AboutLink label={t.website} url={URLS.home} />
          </View>
        )}
      </ScrollView>
      <View style={s.nav}>
        {nav.map(([key, icon, label]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)}
            style={[s.navItem, tab === key && s.navActive]}
          >
            <Icon
              name={icon}
              size={20}
              color={tab === key ? "#007aff" : "#8292a2"}
            />
            <Text
              style={[
                s.navLabel,
                tab === key && { color: "#007aff", fontWeight: "700" },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Modal
        visible={!!countryDetail}
        animationType="slide"
        onRequestClose={() => setCountryDetail(null)}
      >
        <SafeAreaView style={s.safe}>
          <ScrollView contentContainerStyle={s.container}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setCountryDetail(null)}
              style={s.detailBack}
            >
              <Icon name="chevron-left" color="#007aff" />
              <Text style={{ color: "#007aff", fontSize: 17 }}>
                {pcopy.countries}
              </Text>
            </Pressable>
            <View style={s.detailHero}>
              <Text style={s.detailFlag}>
                {countryDetail?.label?.split(" ")[0]}
              </Text>
              <Text style={s.detailName}>
                {countryDetail?.label?.split(" ").slice(1).join(" ")}
              </Text>
              <Text style={s.summaryNumber}>
                {countryDetail?.publishedCount?.toLocaleString(
                  settings.language,
                )}
              </Text>
              <Text style={s.listSub}>{ui.published}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={downloading}
              onPress={() =>
                countryDetail &&
                refreshRemoteData(false, countryDetail.country_code)
              }
              style={[
                s.tripButton,
                { flex: 0, opacity: downloading ? 0.6 : 1 },
              ]}
            >
              <Text style={s.tripButtonText}>
                {downloading
                  ? offlineText.busy
                  : detailFeed
                    ? dcopy.update
                    : dcopy.download}
              </Text>
            </Pressable>
            {detailFeed && (
              <View style={s.offlineNotice}>
                <Icon name="check-circle" color="#007aff" />
                <Text style={s.dataLabel}>{dcopy.saved}</Text>
              </View>
            )}
            {!!downloadStatus && (
              <Text accessibilityLiveRegion="polite" style={s.note}>
                {downloadStatus}
              </Text>
            )}
            <View style={s.settingsCard}>
              <View style={s.settingRow}>
                <Text>{ui.fileSize}</Text>
                <Text>
                  {detailSize
                    ? `${(detailSize / 1000000).toLocaleString(settings.language, { maximumFractionDigits: 1 })} MB`
                    : dcopy.sizeUnknown}
                </Text>
              </View>
              <View style={s.settingRow}>
                <Text>{pcopy.updated}</Text>
                <Text style={[s.note, { maxWidth: "58%", textAlign: "right" }]}>
                  {datasetDate(
                    detailFeed?.generated_at || detailFeed?.updated_at,
                    settings.language,
                    pcopy,
                  )}
                </Text>
              </View>
            </View>
            <View style={s.offlineNotice}>
              <Icon name="wifi-off" color="#007aff" />
              <Text style={[s.note, { flex: 1 }]}>
                {offlineText.explanation}
              </Text>
            </View>
          </ScrollView>
          <Pressable
            onPress={() => setCountryDetail(null)}
            style={s.sheetCancel}
          >
            <Text>{t.close || ui.close}</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={modal === "territories"}
        transparent
        animationType="slide"
        onRequestClose={() => setModal(null)}
      >
        <View style={s.modalShade}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{offlineText.territories}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {countryLists.territories.map(renderCountryRow)}
            </ScrollView>
            <Pressable onPress={() => setModal(null)} style={s.smallButton}>
              <Text style={s.smallButtonText}>✓</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modal === "add"}
        transparent
        animationType="slide"
        onRequestClose={() => setModal(null)}
      >
        <View style={s.modalShade}>
          <View style={s.modalCard}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>{pcopy.noticed}</Text>
            {[
              ["speed_camera", "camera", dcopy.camera],
              ["mobile_control", "shield", dcopy.mobile],
              ["red_light_camera", "stop-circle", dcopy.red],
              ["average_speed_start", "activity", dcopy.average],
            ].map(([type, icon, label]) => (
              <Pressable
                key={type}
                accessibilityRole="button"
                onPress={() => {
                  setReportType(type);
                  setModal("new");
                }}
                style={s.reportChoice}
              >
                <View style={s.choiceIcon}>
                  <Icon name={icon} size={21} />
                </View>
                <Text style={s.reportChoiceText}>{label}</Text>
                <Icon name="chevron-right" size={17} color="#a0adba" />
              </Pressable>
            ))}
            {shownCam && (
              <Pressable
                onPress={() => setModal("removed")}
                style={s.sheetCancel}
              >
                <Text>{t.removed}</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setModal(null)} style={s.sheetCancel}>
              <Text>{t.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        visible={modal === "new"}
        transparent
        animationType="slide"
        onRequestClose={() => setModal(null)}
      >
        <View style={s.modalShade}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t.reportTitle}</Text>
            <Text style={s.modalText}>
              {drivingLabel({ type: reportType }, dcopy)}
            </Text>
            <Text style={s.modalText}>
              {coords ? dcopy.position : dcopy.noPosition}
            </Text>
            <TextInput
              style={s.input}
              value={reportNote}
              onChangeText={setReportNote}
              placeholder="Комментарий, например направление или тип камеры"
              multiline
            />
            <Pressable onPress={reportNewCamera} style={s.button}>
              <Text style={s.buttonText}>{t.send}</Text>
            </Pressable>
            <Pressable onPress={() => setModal(null)} style={s.cancel}>
              <Text>{t.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={modal === "removed"} transparent animationType="slide">
        <View style={s.modalShade}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t.removedTitle}</Text>
            <Text style={s.modalText}>
              {shownCam?.location || shownCam?.region}
            </Text>
            <Pressable
              onPress={() => reportRemovedCamera(shownCam)}
              style={[s.button, s.stop]}
            >
              <Text style={s.buttonText}>{t.removed}</Text>
            </Pressable>
            <Pressable onPress={() => setModal(null)} style={s.cancel}>
              <Text>{t.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function cameraTypeLabel(cam, language = "ru") {
  if (!cam) return "";
  const type =
    {
      fixed_speed: "speed_camera",
      average_speed_section: "average_speed",
      average_speed_start: "average_speed",
      average_speed_end: "average_speed",
      other_enforcement: "checkpoint",
    }[cam.camera_type] ||
    cam.camera_type ||
    cam.type ||
    "speed_camera";
  const labels = {
    ru: {
      speed_and_red_light: "Скорость и красный свет",
      speed_camera: "Камера скорости",
      red_light: "Контроль красного света",
      checkpoint: "Контрольная точка",
      average_speed: "Средняя скорость",
    },
    uk: {
      speed_and_red_light: "Швидкість і червоне світло",
      speed_camera: "Камера швидкості",
      red_light: "Контроль червоного світла",
      checkpoint: "Контрольна точка",
      average_speed: "Середня швидкість",
    },
    en: {
      speed_and_red_light: "Speed and red-light camera",
      speed_camera: "Speed camera",
      red_light: "Red-light camera",
      checkpoint: "Checkpoint",
      average_speed: "Average-speed control",
    },
    pl: {
      speed_and_red_light: "Prędkość i czerwone światło",
      speed_camera: "Fotoradar",
      red_light: "Kontrola czerwonego światła",
      checkpoint: "Punkt kontroli",
      average_speed: "Odcinkowy pomiar prędkości",
    },
  };
  return (labels[language] || labels.ru)[type] || type;
}

function SettingSwitch({ label, value, onChange, icon }) {
  return (
    <View style={s.settingRow}>
      {icon && <Icon name={icon} color="#007aff" size={20} />}
      <Text style={s.settingLabel}>{label}</Text>
      <Switch
        trackColor={{ true: "#007aff" }}
        value={value}
        onValueChange={onChange}
      />
    </View>
  );
}
function DistanceRow({ label, value, setValue }) {
  return (
    <View style={s.settingRow}>
      <Text style={s.settingLabel}>{label}</Text>
      <View style={s.stepper}>
        <Pressable
          onPress={() => setValue(Math.max(200, value - 100))}
          style={s.stepBtn}
        >
          <Text>−</Text>
        </Pressable>
        <Text style={s.stepValue}>{value} м</Text>
        <Pressable
          onPress={() => setValue(Math.min(3000, value + 100))}
          style={s.stepBtn}
        >
          <Text>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  headerSettings: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  speedRingCompact: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 8,
  },
  speedRing: {
    width: 224,
    height: 224,
    borderRadius: 112,
    borderWidth: 11,
    borderColor: "#dcecff",
    backgroundColor: "#f9fbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  statusLines: { marginTop: 14, gap: 9 },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 9 },
  statusText: { fontSize: 13, color: "#587365" },
  datasetMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
  },
  datasetBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#eef3fa",
    alignItems: "center",
    justifyContent: "center",
  },
  datasetCount: { fontSize: 15, fontWeight: "700", color: "#182230" },
  datasetDate: { fontSize: 12, color: "#8090a0", marginTop: 4 },
  reportButtonText: { fontSize: 13, fontWeight: "700", color: "#007aff" },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d6dee7",
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 23,
    fontWeight: "700",
    color: "#101828",
    marginBottom: 8,
  },
  choiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#eef3fa",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCancel: {
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#eff3f7",
    marginTop: 4,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  brand: { fontSize: 32, fontWeight: "800", color: "#101828" },
  countryPill: {
    fontSize: 14,
    color: "#42586b",
    backgroundColor: "#e8eef3",
    padding: 10,
    borderRadius: 18,
  },
  driver: { flex: 1, justifyContent: "space-between", gap: 16 },
  protection: {
    fontSize: 14,
    fontWeight: "600",
    color: "#467566",
    textAlign: "center",
  },
  speedPanel: { alignItems: "center", paddingVertical: 12 },
  heroSpeed: {
    fontSize: 88,
    lineHeight: 100,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    color: "#101828",
    letterSpacing: -4,
    maxWidth: "100%",
  },
  speedOver: { color: "#bb3535" },
  speedUnit: { fontSize: 18, color: "#738495" },
  driverLimit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 22,
  },
  limitCaption: {
    fontSize: 13,
    fontWeight: "700",
    color: "#738495",
    letterSpacing: 1,
  },
  driverLimitNumber: {
    fontSize: 26,
    fontWeight: "800",
    borderWidth: 3,
    borderColor: "#cc5353",
    borderRadius: 30,
    minWidth: 60,
    minHeight: 60,
    textAlign: "center",
    textAlignVertical: "center",
    paddingTop: 10,
    paddingHorizontal: 8,
    color: "#101828",
  },
  driverAlert: {
    borderRadius: 28,
    backgroundColor: "#fff",
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cfdef2",
    gap: 8,
  },
  driverAlertClose: { backgroundColor: "#edf1f8", borderColor: "#b3c7e3" },
  driverAlertNear: {
    backgroundColor: "#fff0d8",
    borderColor: "#e7c88b",
    borderWidth: 2,
  },
  driverAlertOver: { backgroundColor: "#ffe8e5", borderColor: "#dd7970" },
  warningBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 8,
    borderColor: "#dcecff",
    backgroundColor: "#eaf3ff",
    alignItems: "center",
    justifyContent: "center",
  },
  alertIcon: { fontSize: 30 },
  alertTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#182230",
    textAlign: "center",
  },
  alertDistance: {
    fontSize: 52,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    color: "#101828",
  },
  alertDetail: { fontSize: 16, color: "#526779", textAlign: "center" },
  averageNumber: {
    fontSize: 30,
    fontWeight: "800",
    color: "#101828",
    textAlign: "center",
  },

  tripActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  tripButton: {
    flex: 1,
    minHeight: 60,
    backgroundColor: "#007aff",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  tripStop: { backgroundColor: "#e7edf3" },
  tripButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },

  addGlyph: { fontSize: 36, color: "#fff" },

  savedLabel: {
    color: "#267653",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  countryDownload: {
    backgroundColor: "#e6efff",
    padding: 12,
    borderRadius: 14,
    minHeight: 44,
    justifyContent: "center",
  },
  countryDownloadText: { color: "#007aff", fontWeight: "700" },

  safe: { flex: 1, backgroundColor: "#f3f5f8" },
  container: { padding: 20, paddingBottom: 24, gap: 14 },
  nav: {
    marginHorizontal: 0,
    marginBottom: 0,
    backgroundColor: "#fff",
    borderRadius: 0,
    borderTopWidth: 1,
    borderTopColor: "#e8ecf1",
    flexDirection: "row",
    padding: 6,
    shadowOpacity: 0.12,
    shadowRadius: 15,
  },
  countryScreen: { gap: 14 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#e8ecf2",
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 12, color: "#101828" },
  segment: {
    flexDirection: "row",
    backgroundColor: "#e8ecf2",
    borderRadius: 13,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 4,
  },
  segmentActive: { backgroundColor: "#007aff" },
  segmentText: { fontSize: 12, fontWeight: "600", color: "#596579" },
  segmentTextActive: { color: "#fff" },
  countryDetailButton: {
    minWidth: 30,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  offlineNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    backgroundColor: "#eaf3ff",
    borderRadius: 18,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
  },
  timelineIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#eaf3ff",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryNumber: {
    fontSize: 30,
    fontWeight: "800",
    color: "#101828",
    marginTop: 5,
  },
  historyLimit: {
    borderWidth: 2,
    borderColor: "#f04438",
    borderRadius: 24,
    padding: 9,
    fontSize: 18,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: "#fff",
    padding: 28,
    borderRadius: 22,
    alignItems: "center",
    gap: 12,
  },
  emptyCopy: {
    color: "#667085",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
  },
  detailBack: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  detailHero: { alignItems: "center", paddingVertical: 24, gap: 10 },
  detailFlag: { fontSize: 64 },
  detailName: {
    fontSize: 34,
    fontWeight: "800",
    color: "#101828",
    textAlign: "center",
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    minHeight: 52,
    borderRadius: 13,
  },
  navActive: { backgroundColor: "#eaf3ff" },
  navIcon: { fontSize: 17 },

  title: { fontSize: 30, fontWeight: "800", marginTop: 8 },
  subtitle: { fontSize: 14, opacity: 0.55 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 22,
    borderWidth: 3,
    borderColor: "transparent",
  },
  cardDanger: { borderColor: "#ff8a00" },
  label: { fontSize: 14, opacity: 0.55 },
  distance: { fontSize: 48, fontWeight: "900", marginTop: 4 },
  place: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  region: { fontSize: 14, opacity: 0.55, marginTop: 3 },
  warningBox: {
    marginTop: 14,
    padding: 13,
    borderRadius: 14,
    backgroundColor: "#fff2df",
  },
  warningText: { fontSize: 18, fontWeight: "800" },
  warningSub: { fontSize: 12, opacity: 0.6 },
  limitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 18,
  },
  limitCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 6,
    borderColor: "#d32f2f",
    alignItems: "center",
    justifyContent: "center",
  },
  limitText: { fontSize: 24, fontWeight: "900" },
  small: { fontSize: 13, opacity: 0.55 },
  value: { fontSize: 18, fontWeight: "700" },
  empty: { fontSize: 17, opacity: 0.6, paddingVertical: 20 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  stat: { flex: 1, backgroundColor: "#fff", borderRadius: 20, padding: 18 },
  statValue: { fontSize: 38, fontWeight: "900" },
  heading: { fontSize: 14, fontWeight: "800", marginTop: 8, lineHeight: 18 },
  unit: { fontSize: 12, opacity: 0.55 },
  backgroundCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backgroundTitle: { fontSize: 17, fontWeight: "800" },
  backgroundText: { fontSize: 12, opacity: 0.55 },
  smallButton: {
    backgroundColor: "#007aff",
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 12,
  },
  smallButtonStop: { backgroundColor: "#8b1e1e" },
  smallButtonText: { color: "#fff", fontWeight: "800" },
  button: {
    backgroundColor: "#007aff",
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: "center",
  },
  stop: { backgroundColor: "#8b1e1e" },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  action: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  actionText: { fontWeight: "700", fontSize: 13 },
  testButton: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#111",
  },
  testButtonText: { fontWeight: "800" },
  map: { height: 560, borderRadius: 22, overflow: "hidden" },
  list: { gap: 10 },
  listItem: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  listTitle: { fontSize: 15, fontWeight: "700" },
  listSub: { fontSize: 12, opacity: 0.55, marginTop: 3 },
  listDistance: { fontWeight: "800" },
  settingsCard: {
    backgroundColor: "transparent",
    borderRadius: 22,
    padding: 0,
    gap: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: 6 },
  settingRow: {
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  settingLabel: { fontSize: 14, flex: 1 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: { minWidth: 58, textAlign: "center", fontWeight: "700" },
  lang: {
    flex: 1,
    padding: 12,
    backgroundColor: "#eee",
    borderRadius: 12,
    alignItems: "center",
  },
  langActive: { backgroundColor: "#cfd7ff" },
  aboutRow: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  aboutLabel: { fontSize: 15 },
  chev: { fontSize: 24, opacity: 0.35 },
  modalShade: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    padding: 22,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    gap: 14,
  },
  modalTitle: { fontSize: 23, fontWeight: "800" },
  modalText: { opacity: 0.6 },
  input: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 14,
    padding: 12,
    textAlignVertical: "top",
  },
  cancel: { alignItems: "center", padding: 12 },
  typeLabel: { fontSize: 12, fontWeight: "700", opacity: 0.5, marginTop: 5 },
  dataCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dataLabel: { fontSize: 17, fontWeight: "700", color: "#182230" },
  dataValue: { fontSize: 13, fontWeight: "700", marginTop: 3 },
  coverageCard: {
    backgroundColor: "#f3f4f6",
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  coverageLine: { fontSize: 14, fontWeight: "650" },
  note: { fontSize: 12, lineHeight: 18, opacity: 0.55 },
  addButton: {
    minWidth: 104,
    minHeight: 60,
    borderRadius: 20,
    backgroundColor: "#e5eefb",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 12,
  },
  reportChoice: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#edf1f5",
  },
  reportChoiceText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#182230",
    flex: 1,
  },
  navLabel: { fontSize: 11, marginTop: 5, color: "#8292a2" },
  clearCard: { padding: 20, borderRadius: 24, backgroundColor: "#fff" },
  clearTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#007aff",
    textAlign: "left",
  },
});
function AboutLink({ label, url }) {
  return (
    <Pressable onPress={() => Linking.openURL(url)} style={s.aboutRow}>
      <Icon name="info" color="#007aff" size={18} />
      <Text style={[s.aboutLabel, { flex: 1, marginLeft: 12 }]}>{label}</Text>
      <Text style={s.chev}>›</Text>
    </Pressable>
  );
}
