const LOCALES = { ru: "ru-RU", uk: "uk-UA", en: "en-US", pl: "pl-PL" };

export function finiteDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

// Publication time comes from the R2 manifest. A successful check records the
// device clock separately and never relabels an unchanged catalog as published today.
export function catalogTimestamps({ source, generatedAt, previousPublishedAt = null, previousCheckedAt = null, now }) {
  const publishedAt = finiteDate(generatedAt)
    ? generatedAt
    : finiteDate(previousPublishedAt) ? previousPublishedAt : null;
  const checked = source === "r2" || source === "cache-current";
  const checkedAt = checked
    ? (finiteDate(now) ? now : null)
    : (finiteDate(previousCheckedAt) ? previousCheckedAt : null);
  return { publishedAt, checkedAt, stamp: publishedAt };
}

export function shouldShowBackgroundGuide({ backgroundGranted, postponed }) {
  return backgroundGranted !== true && postponed !== true;
}

export function describeLocationAccess({ foreground, background } = {}) {
  const scope = background && background.ios ? background.ios.scope : null;
  if (background && (background.granted || background.status === "granted" || scope === "always")) return "always";
  if (scope === "whenInUse" || (foreground && (foreground.granted || foreground.status === "granted"))) return "when-in-use";
  if ((background && background.status === "denied") || (foreground && foreground.status === "denied")) return "denied";
  return "missing";
}

export function formatCatalogDate(value, language = "ru", withTime = false) {
  if (!finiteDate(value)) return null;
  const locale = LOCALES[language] || LOCALES.ru;
  const date = new Date(value);
  return withTime ? date.toLocaleString(locale) : date.toLocaleDateString(locale);
}

const COPY = {
  ru: {
    title: "Предупреждения в фоне",
    body: "Чтобы предупреждать при заблокированном экране, включите геолокацию «Всегда». Карта и каталог работают без этого.",
    iosSteps: ["1. Нажмите «Открыть настройки»", "2. Геопозиция → Всегда"],
    androidSteps: ["1. Нажмите «Открыть настройки»", "2. Разрешения → Местоположение → В любом режиме"],
    openSettings: "Открыть настройки",
    later: "Позже",
    always: "Доступ «Всегда» включён.",
    whenInUse: "Сейчас геолокация только при использовании. Фон выключен.",
    denied: "Доступ к геолокации не включён. Фон выключен.",
    missing: "Доступ «Всегда» не выбран. Фон выключен.",
    failures: {
      title: "Фоновый режим не включён",
      close: "Закрыть",
      openSettings: "Открыть настройки",
      database: "Сначала загрузите базу выбранной страны.",
      services: "Включите геолокацию телефона.",
      task: "Для фонового режима нужна установленная сборка CamAlert.",
      foreground: "Разрешите геолокацию во время использования приложения.",
      notifications: "Разрешите уведомления CamAlert.",
      start: "Не удалось запустить фоновую сессию.",
    },
  },
  uk: {
    title: "Попередження у фоні",
    body: "Щоб попереджати при заблокованому екрані, увімкніть геолокацію «Завжди». Карта й каталог працюють без цього.",
    iosSteps: ["1. Натисніть «Відкрити налаштування»", "2. Геопозиція → Завжди"],
    androidSteps: ["1. Натисніть «Відкрити налаштування»", "2. Дозволи → Місцезнаходження → У будь-якому режимі"],
    openSettings: "Відкрити налаштування",
    later: "Пізніше",
    always: "Доступ «Завжди» ввімкнено.",
    whenInUse: "Зараз геолокація лише під час використання. Фон вимкнено.",
    denied: "Доступ до геолокації не ввімкнено. Фон вимкнено.",
    missing: "Доступ «Завжди» не вибрано. Фон вимкнено.",
    failures: {
      title: "Фоновий режим не ввімкнено",
      close: "Закрити",
      openSettings: "Відкрити налаштування",
      database: "Спочатку завантажте базу вибраної країни.",
      services: "Увімкніть геолокацію телефона.",
      task: "Для фонового режиму потрібна встановлена збірка CamAlert.",
      foreground: "Дозвольте геолокацію під час використання застосунку.",
      notifications: "Дозвольте сповіщення CamAlert.",
      start: "Не вдалося запустити фонову сесію.",
    },
  },
  en: {
    title: "Background warnings",
    body: "To warn while the screen is locked, set location to Always. The map and catalog work without it.",
    iosSteps: ["1. Tap Open Settings", "2. Location → Always"],
    androidSteps: ["1. Tap Open Settings", "2. Permissions → Location → Allow all the time"],
    openSettings: "Open Settings",
    later: "Later",
    always: "Always access is on.",
    whenInUse: "Location is allowed only while using the app. Background is off.",
    denied: "Location access is off. Background is off.",
    missing: "Always access is not selected. Background is off.",
    failures: {
      title: "Background mode is off",
      close: "Close",
      openSettings: "Open Settings",
      database: "Download the selected country’s database first.",
      services: "Turn on the phone’s location services.",
      task: "Background mode needs an installed CamAlert build.",
      foreground: "Allow location while using the app.",
      notifications: "Allow CamAlert notifications.",
      start: "Could not start the background session.",
    },
  },
  pl: {
    title: "Ostrzeżenia w tle",
    body: "Aby ostrzegać przy zablokowanym ekranie, ustaw lokalizację na Zawsze. Mapa i katalog działają bez tego.",
    iosSteps: ["1. Stuknij Otwórz ustawienia", "2. Lokalizacja → Zawsze"],
    androidSteps: ["1. Stuknij Otwórz ustawienia", "2. Uprawnienia → Lokalizacja → Zezwól cały czas"],
    openSettings: "Otwórz ustawienia",
    later: "Później",
    always: "Dostęp Zawsze jest włączony.",
    whenInUse: "Lokalizacja działa tylko podczas używania aplikacji. Tło jest wyłączone.",
    denied: "Brak dostępu do lokalizacji. Tło jest wyłączone.",
    missing: "Nie wybrano dostępu Zawsze. Tło jest wyłączone.",
    failures: {
      title: "Tryb w tle jest wyłączony",
      close: "Zamknij",
      openSettings: "Otwórz ustawienia",
      database: "Najpierw pobierz bazę wybranego kraju.",
      services: "Włącz lokalizację telefonu.",
      task: "Tryb w tle wymaga zainstalowanej wersji CamAlert.",
      foreground: "Zezwól na lokalizację podczas używania aplikacji.",
      notifications: "Zezwól na powiadomienia CamAlert.",
      start: "Nie udało się uruchomić sesji w tle.",
    },
  },
};

export function backgroundGuideCopy(language = "ru", platform = "ios") {
  const pack = COPY[language] || COPY.ru;
  return {
    title: pack.title,
    body: pack.body,
    steps: platform === "android" ? pack.androidSteps : pack.iosSteps,
    openSettings: pack.openSettings,
    later: pack.later,
  };
}

export function backgroundAccessMessage(language, access) {
  const pack = COPY[language] || COPY.ru;
  if (access === "always") return pack.always;
  if (access === "when-in-use") return pack.whenInUse;
  if (access === "denied") return pack.denied;
  return pack.missing;
}

export function backgroundFailureCopy(language = "ru") {
  return (COPY[language] || COPY.ru).failures;
}
