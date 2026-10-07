// Presentation only: keep datasets, persisted history and delivery logic untouched.
export const REFERENCE_COPY = {
  ru: {
    noResults: "Страны не найдены",
    search: "Поиск страны",
    all: "Все",
    popular: "Популярные",
    details: "Детали базы",
    today: "Сегодня",
    week: "7 дней",
    month: "30 дней",
    alerts: "Предупреждения",
    savedCountries: "Скачано стран",
    recent: "Последние предупреждения",
    noHistory: "Пока всё спокойно",
    historyHint: "Здесь появятся предупреждения, полученные во время поездки.",
    countryHint:
      "Выберите страну для поездки. Откройте детали стрелкой или отметьте несколько баз для скачивания.",
    driverAssistant: "Ваш помощник в дороге",
    driving: "Поездка и предупреждения",
    published: "Опубликованных камер",
    fileSize: "Размер базы",
    close: "Закрыть",
  },
  uk: {
    noResults: "Країни не знайдено",
    search: "Пошук країни",
    all: "Усі",
    popular: "Популярні",
    details: "Деталі бази",
    today: "Сьогодні",
    week: "7 днів",
    month: "30 днів",
    alerts: "Попередження",
    savedCountries: "Завантажено країн",
    recent: "Останні попередження",
    noHistory: "Поки все спокійно",
    historyHint: "Тут з’являться попередження, отримані під час поїздки.",
    countryHint:
      "Виберіть країну для поїздки. Відкрийте деталі стрілкою або позначте декілька баз для завантаження.",
    driverAssistant: "Ваш помічник у дорозі",
    driving: "Поїздка та попередження",
    published: "Опублікованих камер",
    fileSize: "Розмір бази",
    close: "Закрити",
  },
  en: {
    noResults: "No countries found",
    search: "Search countries",
    all: "All",
    popular: "Popular",
    details: "Dataset details",
    today: "Today",
    week: "7 days",
    month: "30 days",
    alerts: "Warnings",
    savedCountries: "Countries saved",
    recent: "Recent warnings",
    noHistory: "All clear so far",
    historyHint: "Warnings received during your drive will appear here.",
    countryHint:
      "Choose your driving country. Open details with the arrow or select several datasets to download.",
    driverAssistant: "Your driving assistant",
    driving: "Driving and warnings",
    published: "Published cameras",
    fileSize: "Dataset size",
    close: "Close",
  },
  pl: {
    noResults: "Nie znaleziono krajów",
    search: "Szukaj kraju",
    all: "Wszystkie",
    popular: "Popularne",
    details: "Szczegóły bazy",
    today: "Dzisiaj",
    week: "7 dni",
    month: "30 dni",
    alerts: "Ostrzeżenia",
    savedCountries: "Pobrane kraje",
    recent: "Ostatnie ostrzeżenia",
    noHistory: "Na razie spokojnie",
    historyHint: "Tutaj pojawią się ostrzeżenia otrzymane podczas jazdy.",
    countryHint:
      "Wybierz kraj jazdy. Otwórz szczegóły strzałką lub zaznacz kilka baz do pobrania.",
    driverAssistant: "Twój asystent jazdy",
    driving: "Jazda i ostrzeżenia",
    published: "Opublikowane kamery",
    fileSize: "Rozmiar bazy",
    close: "Zamknij",
  },
};
export function filterCountries(lists, query, filter, language) {
  const search = String(query || "")
    .trim()
    .toLocaleLowerCase(language);
  const popular = new Set(["UA", "PL", "DE", "FR", "US", "CA"]);
  const matches = (item) =>
    (!search || item.label.toLocaleLowerCase(language).includes(search)) &&
    (filter !== "popular" || popular.has(item.country_code));
  return {
    downloaded: lists.downloaded.filter(matches),
    available: filter === "downloaded" ? [] : lists.available.filter(matches),
  };
}
export function filterHistory(history, days, now = Date.now()) {
  const cutoff =
    days === 1
      ? new Date(new Date(now).setHours(0, 0, 0, 0)).getTime()
      : now - days * 86400000;
  return history.filter((item) => {
    const time = new Date(item.when).getTime();
    return time >= cutoff && time <= now;
  });
}
