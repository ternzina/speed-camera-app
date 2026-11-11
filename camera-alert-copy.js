// Shared wording for visual notifications and TTS. A camera warning is not
// a speeding warning unless a valid current speed exceeds a positive limit.
function ukrainianPlural(value, one, few, many) {
  const n = Math.abs(Math.round(Number(value)));
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

// Spoken only. The on-screen warning keeps «м» and «км/год».
function ukrainianCameraSpeech(distance, limit, hasLimit, over) {
  const meters = ukrainianPlural(distance, "метр", "метри", "метрів");
  const lead = `Камера через ${distance} ${meters}.`;
  if (!hasLimit) return `${lead} Камера попереду.`;
  const unit = ukrainianPlural(limit, "кілометра", "кілометрів", "кілометрів");
  const speed = `${limit} ${unit} на годину`;
  const detail = over ? `Знизьте швидкість до ${speed}.` : `Обмеження ${speed}.`;
  return `${lead} ${detail}`;
}

export function cameraAlertCopy(language, camera, speedKmh, speedAvailable = true) {
  const distance = Math.max(1, Math.round(camera.distance));
  const limit = Number(camera.speed_limit);
  const hasLimit = Number.isFinite(limit) && limit > 0;
  const over = speedAvailable && Number.isFinite(speedKmh) && hasLimit && speedKmh > limit;
  const copy = {
    ru: { locale: 'ru-RU', title: `Камера через ${distance} м`, ahead: 'Камера впереди.', limit: `Ограничение ${limit} км/ч.`, slow: `Снизьте скорость до ${limit} км/ч.` },
    uk: { locale: 'uk-UA', title: `Камера через ${distance} м`, ahead: 'Камера попереду.', limit: `Обмеження ${limit} км/год.`, slow: `Знизьте швидкість до ${limit} км/год.` },
    pl: { locale: 'pl-PL', title: `Kamera za ${distance} m`, ahead: 'Kamera przed Tobą.', limit: `Ograniczenie ${limit} km/h.`, slow: `Zwolnij do ${limit} km/h.` },
    en: { locale: 'en-US', title: `Camera in ${distance} m`, ahead: 'Camera ahead.', limit: `Speed limit ${limit} km/h.`, slow: `Slow down to ${limit} km/h.` },
  };
  const c = copy[language] || copy.en;
  const body = hasLimit ? (over ? c.slow : c.limit) : c.ahead;
  const speech = language === "uk" ? ukrainianCameraSpeech(distance, limit, hasLimit, over) : `${c.title}. ${body}`;
  return { title: c.title, body, speech, locale: c.locale, over };
}
