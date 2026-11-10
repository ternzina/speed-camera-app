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
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDegrees(lat1, lon1, lat2, lon2) {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const l1 = toRad(lon1);
  const l2 = toRad(lon2);
  const y = Math.sin(l2 - l1) * Math.cos(p2);
  const x =
    Math.cos(p1) * Math.sin(p2) -
    Math.sin(p1) * Math.cos(p2) * Math.cos(l2 - l1);
  return norm(toDeg(Math.atan2(y, x)));
}

function isAhead(lat, lon, heading, target, cone = 50) {
  if (heading == null) return false;
  const b = bearingDegrees(lat, lon, target.latitude, target.longitude);
  return angleDiff(heading, b) <= cone;
}

function flattenPoints(plData) {
  const groups = [
    ["speed_camera", plData.speed_cameras || []],
    ["red_light", plData.red_light_cameras || []],
    ["checkpoint", plData.checkpoints || []],
  ];
  const out = [];
  for (const [type, items] of groups) {
    for (const item of items) {
      if (item._example_only) continue;
      out.push({
        ...item,
        type,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        speed_limit: item.speed_limit != null ? Number(item.speed_limit) : null,
      });
    }
  }
  return out;
}

export function nearestPolandPoint(plData, latitude, longitude, heading, maxDistance = 5000) {
  let best = null;
  let bestDistance = Infinity;
  for (const p of flattenPoints(plData)) {
    const d = distanceMeters(latitude, longitude, p.latitude, p.longitude);
    if (d > maxDistance) continue;
    if (!isAhead(latitude, longitude, heading, p)) continue;
    if (p.direction != null && /^\d+(\.\d+)?$/.test(String(p.direction)) && angleDiff(heading, Number(p.direction)) > 60) continue;
    if (d < bestDistance) {
      bestDistance = d;
      best = { ...p, distance: Math.round(d) };
    }
  }
  return best;
}

export function detectAverageSpeedSection(plData, latitude, longitude, heading, activeSectionId = null) {
  const sections = (plData.average_speed_sections || []).filter(x => !x._example_only);

  if (activeSectionId) {
    const active = sections.find(s => String(s.id) === String(activeSectionId));
    if (active) {
      const d = distanceMeters(
        latitude, longitude,
        Number(active.end.latitude), Number(active.end.longitude)
      );
      return {
        state: d <= 180 ? "ending" : "inside",
        section: active,
        distance: Math.round(d),
      };
    }
  }

  let best = null;
  let bestDistance = Infinity;
  for (const s of sections) {
    const start = {
      latitude: Number(s.start.latitude),
      longitude: Number(s.start.longitude),
    };
    const d = distanceMeters(latitude, longitude, start.latitude, start.longitude);
    if (d > 2500) continue;
    if (s.direction != null && /^\d+(\.\d+)?$/.test(String(s.direction)) && angleDiff(heading,Number(s.direction))>60) continue;
    if (!isAhead(latitude, longitude, heading, start, 55)) continue;
    if (d < bestDistance) {
      bestDistance = d;
      best = s;
    }
  }

  if (!best) return null;

  return {
    state: bestDistance <= 180 ? "entering" : "approaching",
    section: best,
    distance: Math.round(bestDistance),
  };
}

function sectionLengthMeters(section) {
  const published = Number(section?.length_km);
  if (Number.isFinite(published) && published > 0) return published * 1000;
  const start = section?.start;
  const end = section?.end;
  if (start?.latitude == null || end?.latitude == null) return null;
  const length = distanceMeters(Number(start.latitude), Number(start.longitude), Number(end.latitude), Number(end.longitude));
  return Number.isFinite(length) && length > 0 ? length : null;
}

export function measureSectionProgress(section, latitude, longitude) {
  const length = sectionLengthMeters(section);
  const end = section?.end;
  if (end?.latitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { progress: null, remaining: null, length: length == null ? null : Math.round(length) };
  }
  const remaining = distanceMeters(latitude, longitude, Number(end.latitude), Number(end.longitude));
  const progress = length ? Math.min(1, Math.max(0, 1 - remaining / length)) : null;
  return {
    progress,
    remaining: Math.round(remaining),
    length: length == null ? null : Math.round(length),
  };
}

export function advanceSectionPace(pace, point, now) {
  if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || !Number.isFinite(now)) return pace;
  if (!pace) return { distance: 0, startedAt: now, last: point, averageKmh: null };
  const step = distanceMeters(pace.last.latitude, pace.last.longitude, point.latitude, point.longitude);
  const distance = pace.distance + (step >= 0 && step <= 300 ? step : 0);
  const elapsed = (now - pace.startedAt) / 1000;
  const averageKmh = elapsed >= 5 && distance >= 20 ? Math.round((distance / elapsed) * 3.6) : null;
  return { distance, startedAt: pace.startedAt, last: point, averageKmh };
}

function publishedSpeedLimit(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function averageSectionSpeech(event, language = "pl") {
  if (!event) return "";
  const limit = event.section?.speed_limit;
  const d = Math.max(100, Math.round((event.distance || 0) / 100) * 100);

  const limitText = {
    pl: limit != null ? ` Ograniczenie ${limit}.` : "",
    uk: limit != null ? ` Обмеження ${limit}.` : "",
    en: limit != null ? ` Speed limit ${limit}.` : "",
    ru: limit != null ? ` Ограничение ${limit}.` : "",
  };

  const table = {
    pl: {
      approaching: `Odcinkowy pomiar prędkości za ${d} metrów.${limitText.pl}`,
      entering: `Rozpoczyna się odcinkowy pomiar prędkości.${limitText.pl}`,
      ending: "Koniec odcinkowego pomiaru prędkości.",
    },
    uk: {
      approaching: `Ділянка контролю середньої швидкості через ${d} метрів.${limitText.uk}`,
      entering: `Починається ділянка контролю середньої швидкості.${limitText.uk}`,
      ending: "Ділянка контролю середньої швидкості завершена.",
    },
    en: {
      approaching: `Average speed control in ${d} meters.${limitText.en}`,
      entering: `Average speed control starts now.${limitText.en}`,
      ending: "Average speed control ended.",
    },
    ru: {
      approaching: `Участок контроля средней скорости через ${d} метров.${limitText.ru}`,
      entering: `Начинается участок контроля средней скорости.${limitText.ru}`,
      ending: "Участок контроля средней скорости завершён.",
    },
  };

  if (event.state === "over") {
    const average = Number(event.averageKmh);
    const limit = publishedSpeedLimit(event.section?.speed_limit);
    if (!Number.isFinite(average) || limit == null) return "";
    const over = {
      pl: `Średnia prędkość ${average} kilometrów na godzinę. Ograniczenie ${limit}.`,
      uk: `Середня швидкість ${average} кілометрів на годину. Обмеження ${limit}.`,
      en: `Average speed ${average} kilometers per hour. Limit ${limit}.`,
      ru: `Средняя скорость ${average} километров в час. Ограничение ${limit}.`,
    };
    return (over[language] || over.ru);
  }

  return (table[language] || table.ru)[event.state] || "";
}

const SECTION_MAX_STEP_M = 300;
const SECTION_ENTRY_M = 180;

function recordedPoints(value) {
  if (!Array.isArray(value)) return [];
  return value.map(finitePoint).filter(Boolean);
}

// A stored road line has to already be on the record. Start and end are not one.
export function recordedSectionGeometry(section) {
  for (const key of ["polyline", "geometry", "road_geometry"]) {
    const points = recordedPoints(section?.[key]);
    if (points.length >= 3) return points;
  }
  return null;
}

export function midsectionRecognition(section) {
  return recordedSectionGeometry(section) ? "geometry" : "silent";
}

function opposedToEndpoints(section, heading) {
  if (heading == null || !Number.isFinite(Number(heading))) return false;
  const start = finitePoint(section?.start);
  const end = finitePoint(section?.end);
  if (!start || !end) return true;
  const bearing = bearingDegrees(start.latitude, start.longitude, end.latitude, end.longitude);
  return angleDiff(Number(heading), bearing) >= 90;
}

function emptyNavtestSection() {
  return { sectionId: null, pace: null, saidEntry: false, saidOver: false, saidEnd: false, closed: null };
}

function finitePoint(point) {
  const latitude = Number(point?.latitude);
  const longitude = Number(point?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function continueSectionPace(pace, point, now) {
  if (!pace) {
    return { distance: 0, startedAt: now, last: point, lastAt: now, averageKmh: null, reliable: true };
  }
  const step = distanceMeters(pace.last.latitude, pace.last.longitude, point.latitude, point.longitude);
  const lastAt = Number.isFinite(pace.lastAt) ? pace.lastAt : pace.startedAt;
  const gap = now - lastAt;
  if (!(step >= 0 && step <= SECTION_MAX_STEP_M) || gap < 0) {
    const startedAt = gap > 0 ? pace.startedAt + gap : pace.startedAt;
    return { distance: pace.distance, startedAt, last: point, lastAt: now, averageKmh: null, reliable: false };
  }
  const next = advanceSectionPace(pace, point, now);
  return { ...next, lastAt: now, reliable: true };
}

export function stepNavtestSection(state, input = {}) {
  const current = { ...emptyNavtestSection(), ...(state && typeof state === "object" ? state : {}) };
  const now = Number(input.now);
  const point = finitePoint(input);
  const hold = { state: current, say: [], stateIfUnsaid: current, event: null, pace: current.pace };
  if (!point || !Number.isFinite(now)) return hold;
  if (input.timestamp != null && Number.isFinite(Number(input.timestamp)) && now - Number(input.timestamp) > 60000) return hold;
  const accuracy = Number(input.accuracy);
  if (Number.isFinite(accuracy) && (accuracy < 0 || accuracy > SECTION_ENTRY_M)) return hold;

  if (current.closed) {
    const end = finitePoint(current.closed.end);
    const start = finitePoint(current.closed.start);
    const nearEnd = end && distanceMeters(point.latitude, point.longitude, end.latitude, end.longitude) <= 250;
    const nearStart = start && distanceMeters(point.latitude, point.longitude, start.latitude, start.longitude) <= 250;
    if (nearEnd || nearStart) return hold;
    current.closed = null;
    current.saidEnd = false;
  }

  const event = detectAverageSpeedSection(input.feed || {}, point.latitude, point.longitude, input.heading ?? null, current.sectionId);
  // Two endpoints cannot show that the car is on the section. The straight line
  // between them is not a road, so an unobserved middle stays silent.
  if (!current.sectionId && midsectionRecognition(event?.section) !== "geometry") {
    if (!event || (event.state !== "entering" && event.state !== "approaching")) {
      return { state: current, say: [], stateIfUnsaid: current, event: null, pace: null };
    }
    if (opposedToEndpoints(event.section, input.heading)) {
      return { state: current, say: [], stateIfUnsaid: current, event: null, pace: null };
    }
  }
  if (!event || event.state === "approaching") return { ...hold, state: current, stateIfUnsaid: current, event };
  const id = String(event.section.id);
  let saidEntry = current.sectionId === id ? current.saidEntry : false;
  let saidOver = current.sectionId === id ? current.saidOver : false;
  const pace = continueSectionPace(current.sectionId === id ? current.pace : null, point, now);
  const language = input.language || "pl";
  const base = { sectionId: id, pace, saidEntry, saidOver, saidEnd: false, closed: null };

  if (event.state === "ending") {
    const say = current.sectionId === id && current.saidEnd ? [] : [averageSectionSpeech({ ...event, state: "ending" }, language)].filter(Boolean);
    const next = {
      ...emptyNavtestSection(),
      saidEnd: true,
      closed: { id, start: finitePoint(event.section.start), end: finitePoint(event.section.end) },
    };
    return { state: next, say, stateIfUnsaid: base, event, pace };
  }

  const say = [];
  if (!saidEntry) {
    say.push(averageSectionSpeech({ ...event, state: "entering" }, language));
    saidEntry = true;
  }
  const limit = publishedSpeedLimit(event.section?.speed_limit);
  if (pace.reliable && limit != null && pace.averageKmh != null && pace.averageKmh > limit) {
    if (!saidOver) {
      say.push(averageSectionSpeech({ ...event, state: "over", averageKmh: pace.averageKmh }, language));
      saidOver = true;
    }
  } else if (pace.reliable && pace.averageKmh != null && Number.isFinite(limit) && pace.averageKmh <= limit) {
    saidOver = false;
  }
  const next = { ...base, saidEntry, saidOver };
  return { state: next, say: say.filter(Boolean), stateIfUnsaid: base, event, pace };
}
