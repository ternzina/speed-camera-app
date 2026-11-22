// Short voice-setup screen. It does not request a permission itself.
// "Enable background mode" calls the existing settings toggle.

const COPY = {
  ru: {
    settingsTitle: "Разрешения и голос",
    back: "Назад",
    continue: "Продолжить",
    next: "Дальше",
    enableBackground: "Включить фоновый режим",
    backgroundOn: "Фоновый режим включён.",
    backgroundOff: "Фоновый режим выключен.",
    brandLead: "Cam",
    brandAccent: "Alert",
    title: "Настройка голосовых предупреждений",
    body: "Для фоновой работы понадобится геолокация «Всегда».",
    voiceReady: "Голосовые предупреждения включены.",
    hint: "Для полноценной фоновой работы CamAlert настройте геолокацию",
    more: "Подробнее",
  },
  uk: {
    settingsTitle: "Дозволи та голос",
    back: "Назад",
    continue: "Продовжити",
    next: "Далі",
    enableBackground: "Увімкнути фоновий режим",
    backgroundOn: "Фоновий режим увімкнено.",
    backgroundOff: "Фоновий режим вимкнено.",
    brandLead: "Cam",
    brandAccent: "Alert",
    title: "Налаштування голосових попереджень",
    body: "Для фонової роботи знадобиться геолокація «Завжди».",
    voiceReady: "Голосові попередження ввімкнено.",
    hint: "Для повноцінної фонової роботи CamAlert налаштуйте геолокацію",
    more: "Докладніше",
  },
  en: {
    settingsTitle: "Permissions and voice",
    back: "Back",
    continue: "Continue",
    next: "Next",
    enableBackground: "Turn on background mode",
    backgroundOn: "Background mode is on.",
    backgroundOff: "Background mode is off.",
    brandLead: "Cam",
    brandAccent: "Alert",
    title: "Set up voice warnings",
    body: "Background use needs Always location.",
    voiceReady: "Voice warnings are on.",
    hint: "For CamAlert's full background operation, set up location",
    more: "Details",
  },
  pl: {
    settingsTitle: "Uprawnienia i głos",
    back: "Wstecz",
    continue: "Kontynuuj",
    next: "Dalej",
    enableBackground: "Włącz tryb w tle",
    backgroundOn: "Tryb w tle jest włączony.",
    backgroundOff: "Tryb w tle jest wyłączony.",
    brandLead: "Cam",
    brandAccent: "Alert",
    title: "Ustawienie ostrzeżeń głosowych",
    body: "Do działania w tle potrzebna jest lokalizacja „Zawsze”.",
    voiceReady: "Ostrzeżenia głosowe są włączone.",
    hint: "Aby CamAlert w pełni działał w tle, ustaw lokalizację",
    more: "Szczegóły",
  },
};

export function locationPermissionCopy(language = "ru") {
  return COPY[language] || COPY.ru;
}

export function backgroundModeStatus(language, enabled) {
  const pack = COPY[language] || COPY.ru;
  return enabled ? pack.backgroundOn : pack.backgroundOff;
}

export function voiceReadyLine(language, { voiceEnabled = false, granted = false } = {}) {
  if (!voiceEnabled || !granted) return "";
  return (COPY[language] || COPY.ru).voiceReady;
}

export function shouldShowTripLocationHint(access) {
  return access === "when-in-use" || access === "denied" || access === "missing";
}
