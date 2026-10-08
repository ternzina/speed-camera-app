import {
  canonicalType,
  usablePoint,
  usableCameraRecordCount,
  distanceBetween,
} from "./driver-engine";
import { compactFeed } from "./camera-data";
import { utf8Bytes } from "./sha256";
export const PREMIUM_COPY = {
  ru: {
    title: "Speed Camera",
    subtitle: "Путешествуйте безопасно",
    start: "Начать",
    save: "Сохранить",
    speed: "Камеры скорости",
    red: "Камеры на светофорах",
    average: "Средняя скорость",
    world: "База по странам",
    published: "Опубликовано",
    candidates: "Кандидаты",
    found: "Найдено всего",
    types: "Типы камер",
    combined: "Скорость и светофор",
    other: "Другие",
    version: "Версия базы",
    offline: "Сохранено офлайн",
    download: "Скачать для офлайн",
    checking: "Проверяем и сохраняем базу",
    loading: "Скачивание",
    left: "Осталось",
    storage: "Локальные данные камер",
    remove: "Удалить выбранные",
    confirmRemove: "Удалить базы с устройства?",
    removeHint: "Их можно скачать снова. Во время поездки удаление недоступно.",
    filters: "Фильтры карты",
    limits: "Показывать ограничения",
    sounds: "Звуки и уведомления",
    units: "Единицы экрана",
    theme: "Тема",
    system: "Система",
    dark: "Тёмная",
    light: "Светлая",
    support: "Поддержка",
    app: "Приложение",
    road: "Дорога",
    direction: "По направлению движения",
    ahead: "Камера через",
    route: "Трек текущей поездки",
    km: "км",
    meters: "м",
    mph: "миль/ч",
    feet: "футов",
    miles: "миль",
    voice: "Голосовые предупреждения",
    vibration: "Вибрация",
    noMetric: "Нет данных",
    kilometres: "Путь в приложении",
    historyDistance: "Путь",
    countries: "Страны",
    mapOnly:
      "Типы фильтруют карту. Предупреждения о камерах остаются активными.",
    intro: "Стартовый экран",
    back: "Назад",
  },
  uk: {
    title: "Speed Camera",
    subtitle: "Подорожуйте безпечно",
    start: "Почати",
    save: "Зберегти",
    speed: "Камери швидкості",
    red: "Камери на світлофорах",
    average: "Середня швидкість",
    world: "База за країнами",
    published: "Опубліковано",
    candidates: "Кандидати",
    found: "Знайдено всього",
    types: "Типи камер",
    combined: "Швидкість і світлофор",
    other: "Інші",
    version: "Версія бази",
    offline: "Збережено офлайн",
    download: "Завантажити офлайн",
    checking: "Перевіряємо та зберігаємо базу",
    loading: "Завантаження",
    left: "Залишилось",
    storage: "Локальні дані камер",
    remove: "Видалити вибрані",
    confirmRemove: "Видалити бази з пристрою?",
    removeHint:
      "Їх можна завантажити знову. Під час поїздки видалення недоступне.",
    filters: "Фільтри карти",
    limits: "Показувати обмеження",
    sounds: "Звуки та сповіщення",
    units: "Одиниці екрана",
    theme: "Тема",
    system: "Система",
    dark: "Темна",
    light: "Світла",
    support: "Підтримка",
    app: "Застосунок",
    road: "Дорога",
    direction: "За напрямком руху",
    ahead: "Камера через",
    route: "Трек поточної поїздки",
    km: "км",
    meters: "м",
    mph: "миль/год",
    feet: "футів",
    miles: "миль",
    voice: "Голосові попередження",
    vibration: "Вібрація",
    noMetric: "Немає даних",
    kilometres: "Шлях у застосунку",
    historyDistance: "Шлях",
    countries: "Країни",
    mapOnly:
      "Типи фільтрують карту. Попередження про камери залишаються активними.",
    intro: "Стартовий екран",
    back: "Назад",
  },
  en: {
    title: "Speed Camera",
    subtitle: "Travel safely",
    start: "Get started",
    save: "Save",
    speed: "Speed cameras",
    red: "Red-light cameras",
    average: "Average speed",
    world: "Worldwide camera data",
    published: "Published",
    candidates: "Candidates",
    found: "Total found",
    types: "Camera types",
    combined: "Speed and red light",
    other: "Other",
    version: "Dataset version",
    offline: "Saved offline",
    download: "Download for offline",
    checking: "Verifying and saving dataset",
    loading: "Downloading",
    left: "Remaining",
    storage: "Local camera data",
    remove: "Remove selected",
    confirmRemove: "Remove datasets from this device?",
    removeHint:
      "You can download them again. Removal is unavailable while driving.",
    filters: "Map filters",
    limits: "Show speed limits",
    sounds: "Sounds and notifications",
    units: "Display units",
    theme: "Theme",
    system: "System",
    dark: "Dark",
    light: "Light",
    support: "Support",
    app: "Application",
    road: "Road",
    direction: "In your direction",
    ahead: "Camera in",
    route: "Current drive track",
    km: "km",
    meters: "m",
    mph: "mph",
    feet: "ft",
    miles: "mi",
    voice: "Voice warnings",
    vibration: "Vibration",
    noMetric: "Unavailable",
    kilometres: "Distance in app",
    historyDistance: "Distance",
    countries: "Countries",
    mapOnly: "Types filter the map. Camera warnings stay active.",
    intro: "Welcome screen",
    back: "Back",
  },
  pl: {
    title: "Speed Camera",
    subtitle: "Podróżuj bezpiecznie",
    start: "Zacznij",
    save: "Zapisz",
    speed: "Fotoradary",
    red: "Kamery na światłach",
    average: "Średnia prędkość",
    world: "Baza według krajów",
    published: "Opublikowane",
    candidates: "Kandydaci",
    found: "Znalezione",
    types: "Typy kamer",
    combined: "Prędkość i światła",
    other: "Inne",
    version: "Wersja bazy",
    offline: "Zapisano offline",
    download: "Pobierz offline",
    checking: "Sprawdzanie i zapisywanie bazy",
    loading: "Pobieranie",
    left: "Pozostało",
    storage: "Lokalne dane kamer",
    remove: "Usuń wybrane",
    confirmRemove: "Usunąć bazy z urządzenia?",
    removeHint:
      "Można je pobrać ponownie. Usuwanie jest niedostępne podczas jazdy.",
    filters: "Filtry mapy",
    limits: "Pokaż ograniczenia",
    sounds: "Dźwięki i powiadomienia",
    units: "Jednostki ekranu",
    theme: "Motyw",
    system: "System",
    dark: "Ciemny",
    light: "Jasny",
    support: "Wsparcie",
    app: "Aplikacja",
    road: "Droga",
    direction: "W kierunku jazdy",
    ahead: "Kamera za",
    route: "Ślad bieżącej jazdy",
    km: "km",
    meters: "m",
    mph: "mph",
    feet: "stóp",
    miles: "mil",
    voice: "Ostrzeżenia głosowe",
    vibration: "Wibracje",
    noMetric: "Brak danych",
    kilometres: "Dystans w aplikacji",
    historyDistance: "Dystans",
    countries: "Kraje",
    mapOnly: "Typy filtrują mapę. Ostrzeżenia pozostają aktywne.",
    intro: "Ekran startowy",
    back: "Wstecz",
  },
};
export const FILTER_TYPES = [
  "speed_camera",
  "red_light_camera",
  "average_speed",
  "combined",
  "mobile_control",
  "other",
];
export function displayType(point) {
  if (
    ["speed_and_red_light", "combined"].includes(
      point.camera_type || point.type,
    )
  )
    return "combined";
  const type = canonicalType(point);
  return type.startsWith("average_speed") ? "average_speed" : type;
}
export function typeCounts(feed, entry) {
  const counts = Object.fromEntries(FILTER_TYPES.map((type) => [type, 0]));
  if (!feed)
    return entry
      ? {
          speed_camera: entry.speed_cameras ?? null,
          red_light_camera: entry.red_light_cameras ?? null,
          average_speed: entry.average_speed_sections ?? null,
          mobile_control: entry.checkpoints ?? null,
          combined: null,
          other: null,
        }
      : null;
  const groups = feed.cameras
    ? [["", feed.cameras]]
    : [
        ["speed_camera", feed.speed_cameras],
        ["red_light_camera", feed.red_light_cameras],
        ["mobile_control", feed.checkpoints],
      ];
  for (const [fallback, items] of groups)
    for (const point of items || []) {
      if (!usablePoint(point)) continue;
      const type = displayType({ ...point, type: point.type || fallback });
      counts[type in counts ? type : "other"]++;
    }
  counts.average_speed += (feed.average_speed_sections || []).filter(
    (p) => !p._example_only && usablePoint(p.start) && usablePoint(p.end),
  ).length;
  return counts;
}
export function countryMetrics(entry, feed) {
  const number = (value) =>
    Number.isFinite(value) && value >= 0 ? value : null;
  return {
    published:
      entry?.publishedCount ??
      entry?.record_count ??
      (feed ? usableCameraRecordCount(feed) : null),
    candidates: number(entry?.candidate_count ?? entry?.candidates_count),
    found: number(entry?.found_count ?? entry?.total_found),
  };
}
export function localBytes(feed) {
  return feed ? utf8Bytes(JSON.stringify(compactFeed(feed))).length : 0;
}
export function displaySpeed(value, units) {
  return units === "imperial"
    ? Math.round(value * 0.621371)
    : Math.round(value);
}
export function displayDistance(value, units, copy) {
  if (units === "imperial")
    return value < 1609
      ? `${Math.round(value * 3.28084)} ${copy.feet}`
      : `${(value / 1609.344).toFixed(1)} ${copy.miles}`;
  return value < 1000
    ? `${Math.round(value)} ${copy.meters}`
    : `${(value / 1000).toFixed(1)} ${copy.km}`;
}
// Only valid foreground movement contributes; gaps, GPS jumps and stationary jitter do not fabricate mileage.
export function trackStep(previous, position, time, accuracy = 0) {
  if (!position || accuracy > 50) return { point: null, metres: 0 };
  if (!previous) return { point: { ...position, time }, metres: 0 };
  const elapsed = (time - previous.time) / 1000,
    metres = distanceBetween(previous, position);
  return {
    point: { ...position, time },
    metres:
      elapsed > 0 && elapsed <= 15 && metres >= 8 && metres / elapsed < 60
        ? metres
        : 0,
  };
}
