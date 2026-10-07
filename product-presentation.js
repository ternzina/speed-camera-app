export const CONTROL_ICONS = {
  speed_camera: "camera",
  red_light_camera: "stop-circle",
  mobile_control: "shield",
  average_speed_start: "activity",
  average_speed_end: "activity",
};
export const PRODUCT_COPY = {
  ru: {
    countries: "Страны",
    report: "Сообщить",
    noticed: "Что вы заметили?",
    gps: "GPS активен",
    gpsReady: "GPS доступен",
    gpsWaiting: "Ожидание GPS",
    voiceOn: "Голос включён",
    voiceOff: "Голос выключен",
    loaded: "База загружена",
    notLoaded: "База не скачана",
    cameraCount: "камер в базе",
    updated: "Обновлено",
    today: "Обновлено сегодня",
    unknownDate: "Дата обновления неизвестна",
    locate: "Моё местоположение",
    nearby: "Камеры рядом",
    nearest: "Ближайшая камера",
    noCameras: "Рядом нет камер",
    calm: "Можно ехать спокойно",
    enableGPS: "Где вы сейчас?",
    mapHint: "Камеры выбранной страны",
    locationError: "Не удалось определить местоположение",
    locationPermission: "Разрешите доступ к геолокации в настройках телефона.", close:"Закрыть",
  },
  uk: {
    countries: "Країни",
    report: "Повідомити",
    noticed: "Що ви помітили?",
    gps: "GPS активний",
    gpsReady: "GPS доступний",
    gpsWaiting: "Очікування GPS",
    voiceOn: "Голос увімкнено",
    voiceOff: "Голос вимкнено",
    loaded: "База завантажена",
    notLoaded: "База не завантажена",
    cameraCount: "камер у базі",
    updated: "Оновлено",
    today: "Оновлено сьогодні",
    unknownDate: "Дата оновлення невідома",
    locate: "Моє місцеположення",
    nearby: "Камери поруч",
    nearest: "Найближча камера",
    noCameras: "Поруч немає камер",
    calm: "Можна їхати спокійно",
    enableGPS: "Де ви зараз?",
    mapHint: "Камери вибраної країни",
    locationError: "Не вдалося визначити місцеположення",
    locationPermission: "Дозвольте геолокацію в налаштуваннях телефона.", close:"Закрити",
  },
  en: {
    countries: "Countries",
    report: "Report",
    noticed: "What did you notice?",
    gps: "GPS active",
    gpsReady: "GPS available",
    gpsWaiting: "Waiting for GPS",
    voiceOn: "Voice on",
    voiceOff: "Voice off",
    loaded: "Dataset downloaded",
    notLoaded: "Dataset not downloaded",
    cameraCount: "cameras in dataset",
    updated: "Updated",
    today: "Updated today",
    unknownDate: "Update date unavailable",
    locate: "My location",
    nearby: "Nearby cameras",
    nearest: "Nearest camera",
    noCameras: "No cameras nearby",
    calm: "All clear nearby",
    enableGPS: "Where are you?",
    mapHint: "Cameras in your selected country",
    locationError: "Could not find your location",
    locationPermission: "Allow location access in your phone settings.", close:"Close",
  },
  pl: {
    countries: "Kraje",
    report: "Zgłoś",
    noticed: "Co zauważyłeś?",
    gps: "GPS aktywny",
    gpsReady: "GPS dostępny",
    gpsWaiting: "Oczekiwanie na GPS",
    voiceOn: "Głos włączony",
    voiceOff: "Głos wyłączony",
    loaded: "Baza pobrana",
    notLoaded: "Baza niepobrana",
    cameraCount: "kamer w bazie",
    updated: "Zaktualizowano",
    today: "Zaktualizowano dzisiaj",
    unknownDate: "Data aktualizacji niedostępna",
    locate: "Moja lokalizacja",
    nearby: "Kamery w pobliżu",
    nearest: "Najbliższa kamera",
    noCameras: "Brak kamer w pobliżu",
    calm: "W pobliżu spokojnie",
    enableGPS: "Gdzie jesteś?",
    mapHint: "Kamery wybranego kraju",
    locationError: "Nie udało się ustalić lokalizacji",
    locationPermission: "Zezwól na lokalizację w ustawieniach telefonu.", close:"Zamknij",
  },
};
export function datasetDate(value, language, copy) {
  if (!value || !Number.isFinite(new Date(value).getTime()))
    return copy.unknownDate;
  return new Date(value).toDateString() === new Date().toDateString()
    ? copy.today
    : `${copy.updated} ${new Date(value).toLocaleDateString(language)}`;
}
// Clusters are presentation-only; original camera objects and driving selection remain intact.
export function mapClusters(points, region) {
  const cells = new Map(),
    latStep = region.latitudeDelta / 7,
    lonStep = region.longitudeDelta / 5;
  for (const p of points) {
    if (
      Math.abs(p.latitude - region.latitude) > region.latitudeDelta * 0.75 ||
      Math.abs(p.longitude - region.longitude) > region.longitudeDelta * 0.75
    )
      continue;
    const key = `${Math.floor((p.latitude - region.latitude + region.latitudeDelta / 2) / latStep)}:${Math.floor((p.longitude - region.longitude + region.longitudeDelta / 2) / lonStep)}`;
    const cell = cells.get(key) || [];
    cell.push(p);
    cells.set(key, cell);
  }
  return [...cells.entries()].map(([id, items]) => ({
    id,
    items,
    latitude: items.reduce((n, p) => n + p.latitude, 0) / items.length,
    longitude: items.reduce((n, p) => n + p.longitude, 0) / items.length,
  }));
}
