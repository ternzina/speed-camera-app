// On-device driving decisions. No delivery, storage or network dependencies.
const rad = (x) => (x * Math.PI) / 180;
export const normalizeHeading = (x) => ((x % 360) + 360) % 360;
export const angleDifference = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
export function distanceBetween(a, b) {
  const p = rad(b.latitude - a.latitude),
    q = rad(b.longitude - a.longitude);
  return (
    6371000 *
    2 *
    Math.atan2(
      Math.sqrt(
        Math.sin(p / 2) ** 2 +
          Math.cos(rad(a.latitude)) *
            Math.cos(rad(b.latitude)) *
            Math.sin(q / 2) ** 2,
      ),
      Math.sqrt(
        1 -
          (Math.sin(p / 2) ** 2 +
            Math.cos(rad(a.latitude)) *
              Math.cos(rad(b.latitude)) *
              Math.sin(q / 2) ** 2),
      ),
    )
  );
}
export function bearingBetween(a, b) {
  const p = rad(a.latitude),
    q = rad(b.latitude),
    l = rad(b.longitude - a.longitude);
  return normalizeHeading(
    (Math.atan2(
      Math.sin(l) * Math.cos(q),
      Math.cos(p) * Math.sin(q) - Math.sin(p) * Math.cos(q) * Math.cos(l),
    ) *
      180) /
      Math.PI,
  );
}
export function usablePoint(p) {
  return !p
    ? false
    : p.latitude != null &&
        p.longitude != null &&
        p.latitude !== "" &&
        p.longitude !== "" &&
        !p._example_only &&
        Number.isFinite(Number(p.latitude)) &&
        Number.isFinite(Number(p.longitude)) &&
        Math.abs(Number(p.latitude)) <= 90 &&
        Math.abs(Number(p.longitude)) <= 180 &&
        !(Number(p.latitude) === 0 && Number(p.longitude) === 0);
}
export function canonicalType(p = {}) {
  const type = p.camera_type || p.type;
  return (
    {
      fixed_speed: "speed_camera",
      speed_and_red_light: "red_light_camera",
      red_light: "red_light_camera",
      checkpoint: "mobile_control",
      other_enforcement: "mobile_control",
      mobile: "mobile_control",
      average_speed_section: "average_speed_start",
    }[type] ||
    ([
      "speed_camera",
      "red_light_camera",
      "average_speed_start",
      "average_speed_end",
      "mobile_control",
    ].includes(type)
      ? type
      : "speed_camera")
  );
}
export function drivingPoints(feed = {}) {
  const groups = Array.isArray(feed.cameras)
    ? [[null, feed.cameras]]
    : [
        ["speed_camera", feed.speed_cameras || []],
        ["red_light_camera", feed.red_light_cameras || []],
        ["mobile_control", feed.checkpoints || []],
      ];
  const points = groups.flatMap(([type, items]) =>
    items.filter(usablePoint).map((p) => ({
      ...p,
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      type: canonicalType({ ...p, type: type || p.type }),
      speed_limit: Number(p.speed_limit) > 0 ? Number(p.speed_limit) : null,
    })),
  );
  for (const section of feed.average_speed_sections || []) {
    if (section._example_only) continue;
    for (const gate of ["start", "end"])
      if (usablePoint(section[gate]))
        points.push({
          ...section[gate],
          id: `${section.id}:${gate}`,
          sectionId: String(section.id),
          type: `average_speed_${gate}`,
          direction: section.direction,
          speed_limit:
            Number(section.speed_limit) > 0
              ? Number(section.speed_limit)
              : null,
        });
  }
  return points;
}
// A section is one published record, even though driving uses two gates.
export function usableCameraRecordCount(feed = {}) {
  const sections = (feed.average_speed_sections || []).filter(
    (s) => !s._example_only,
  );
  const gates = sections.reduce(
    (n, s) => n + Number(usablePoint(s.start)) + Number(usablePoint(s.end)),
    0,
  );
  const validSections = sections.filter(
    (s) => usablePoint(s.start) && usablePoint(s.end),
  ).length;
  return drivingPoints(feed).length - gates + validSections;
}
export function directionMatches(value, heading) {
  if (value == null || value === "") return null;
  const compass = {
    N: 0,
    NNE: 22.5,
    NE: 45,
    ENE: 67.5,
    E: 90,
    ESE: 112.5,
    SE: 135,
    SSE: 157.5,
    S: 180,
    SSW: 202.5,
    SW: 225,
    WSW: 247.5,
    W: 270,
    WNW: 292.5,
    NW: 315,
    NNW: 337.5,
  };
  const raw = String(value).trim().toUpperCase();
  if (["BOTH", "BIDIRECTIONAL", "ALL"].includes(raw)) return true;
  const directions = raw
    .split(/[;,/|]/)
    .map((x) => x.trim())
    .map((x) =>
      x in compass
        ? compass[x]
        : /^\d+(\.\d+)?$/.test(x)
          ? normalizeHeading(Number(x))
          : null,
    )
    .filter((x) => x != null);
  return directions.length
    ? directions.some((d) => angleDifference(heading, d) <= 55)
    : null;
}
export function isDrivingAhead(position, heading, point, accuracy = 0) {
  if (!usablePoint(point) || heading == null || !Number.isFinite(heading))
    return false;
  const d = distanceBetween(position, point),
    angle = angleDifference(heading, bearingBetween(position, point)),
    direction = directionMatches(
      point.direction ?? point.direction_code,
      heading,
    );
  if (direction === false || angle > 40) return false;
  const lateral = d * Math.sin(rad(angle)); // Tighten the corridor when direction metadata are absent.
  return (
    lateral <=
    Math.min(
      direction == null ? 40 : 65,
      Math.max(direction == null ? 22 : 35, Number(accuracy) || 0),
    )
  );
}
export function nearestDrivingPoint(
  points,
  position,
  heading,
  maxDistance = 5000,
  accuracy = 0,
) {
  let best = null;
  for (const p of points) {
    if (!isDrivingAhead(position, heading, p, accuracy)) continue;
    const d = distanceBetween(position, p);
    if (d <= maxDistance && (!best || d < best.distance))
      best = { ...p, distance: Math.round(d) };
  }
  return best;
}
export function warningDistances(kmh, settings = {}) {
  const mps = Math.max(0, kmh) / 3.6;
  return {
    first:
      settings.smartDistance === false
        ? Math.min(
            1500,
            Math.max(
              150,
              settings[
                kmh <= 60
                  ? "cityDistance"
                  : kmh <= 90
                    ? "roadDistance"
                    : kmh <= 120
                      ? "highwayDistance"
                      : "fastDistance"
              ] || 600,
            ),
          )
        : Math.min(1500, Math.max(150, mps * 22)),
    second: Math.min(500, Math.max(60, mps * 8)),
  };
}
export function warningDecision(
  previous,
  cam,
  kmh,
  settings,
  now = Date.now(),
) {
  if (!cam) return { memory: previous, event: null };
  const thresholds = warningDistances(kmh, settings);
  if (cam.distance > thresholds.first) return { memory: previous, event: null };
  const key = String(cam.id ?? `${cam.latitude}:${cam.longitude}:${cam.type}`);
  const seen = Object.fromEntries(
    Object.entries(previous?.seen || {}).filter(
      ([, value]) => now - value.lastAt < 180000,
    ),
  );
  const existing = previous?.key === key ? previous : seen[key];
  let memory =
    existing && now - existing.lastAt < 180000
      ? {
          key,
          first: existing.first,
          second: existing.second,
          over: existing.over,
          lastAt: existing.lastAt,
        }
      : { key, first: false, second: false, over: false, lastAt: 0 };
  const over = cam.speed_limit > 0 && kmh > Number(cam.speed_limit) + 3;
  let event = null;
  if (!memory.first) {
    event = "first";
    memory.first = true;
    if (cam.distance <= thresholds.second) memory.second = true;
  } else if (
    now - memory.lastAt >= 5000 &&
    !memory.second &&
    cam.distance <= thresholds.second
  ) {
    event = "second";
    memory.second = true;
  } else if (now - memory.lastAt >= 8000 && over && !memory.over) {
    event = "over";
  }
  if (event) {
    memory.lastAt = now;
    if (over) memory.over = true;
  }
  return {
    memory: { ...memory, seen: { ...seen, [key]: memory } },
    event,
    over,
  };
}
export const voiceLocale = (language) =>
  ({ ru: "ru-RU", uk: "uk-UA", en: "en-US", pl: "pl-PL" })[language] || "ru-RU";
export function warningPhrase(cam, event, over, language = "ru") {
  const n = Math.max(50, Math.round(cam.distance / 50) * 50),
    limit = cam.speed_limit > 0 ? cam.speed_limit : null;
  const words = {
    ru: {
      first: `Камера скорости через ${n} метров.`,
      second: `Камера через ${n} метров.`,
      over: "Снизьте скорость.",
      limit: ` Ограничение ${limit}.`,
      red: "Камера красного света",
      mobile: "Мобильный контроль",
      average: "Контроль средней скорости",
    },
    uk: {
      first: `Камера швидкості через ${n} метрів.`,
      second: `Камера через ${n} метрів.`,
      over: "Знизьте швидкість.",
      limit: ` Обмеження ${limit}.`,
      red: "Камера червоного світла",
      mobile: "Мобільний контроль",
      average: "Контроль середньої швидкості",
    },
    en: {
      first: `Speed camera in ${n} meters.`,
      second: `Camera in ${n} meters.`,
      over: "Reduce your speed.",
      limit: ` Speed limit ${limit}.`,
      red: "Red-light camera",
      mobile: "Mobile control",
      average: "Average-speed control",
    },
    pl: {
      first: `Fotoradar za ${n} metrów.`,
      second: `Fotoradar za ${n} metrów.`,
      over: "Zwolnij.",
      limit: ` Ograniczenie ${limit}.`,
      red: "Kontrola czerwonego światła",
      mobile: "Kontrola mobilna",
      average: "Odcinkowy pomiar prędkości",
    },
  };
  const w = words[language] || words.ru;
  let phrase = w[event] || w.first;
  if (event === "first") {
    const type = canonicalType(cam);
    if (type === "red_light_camera")
      phrase = phrase.replace(
        language === "en"
          ? "Speed camera"
          : language === "pl"
            ? "Fotoradar"
            : language === "uk"
              ? "Камера швидкості"
              : "Камера скорости",
        w.red,
      );
    if (type === "mobile_control" || type.startsWith("average_speed"))
      phrase = phrase.replace(
        language === "en"
          ? "Speed camera"
          : language === "pl"
            ? "Fotoradar"
            : language === "uk"
              ? "Камера швидкості"
              : "Камера скорости",
        type === "mobile_control" ? w.mobile : w.average,
      );
  }
  return (
    phrase +
    (over && event !== "over" ? ` ${w.over}` : "") +
    (limit && (event === "first" || event === "over" || over) ? w.limit : "")
  );
}
function along(start, end, p) {
  const d = distanceBetween(start, p);
  return (
    d *
    Math.cos(
      rad(
        angleDifference(bearingBetween(start, end), bearingBetween(start, p)),
      ),
    )
  );
}
// Trip odometer starts at the actual start gate, never at the approach warning.
export function advanceAverageTrip(
  previous,
  feed,
  position,
  heading,
  now = Date.now(),
  accuracy = 0,
) {
  if (!usablePoint(position) || Number(accuracy) > 80)
    return { trip: null, event: previous ? "lost" : null };
  let trip = previous;
  if (trip) {
    const section = trip.section;
    if (!usablePoint(section.end)) return { trip: null, event: null };
    const delta = distanceBetween(trip.lastPosition, position),
      dt = (now - trip.lastAt) / 1000;
    if (dt <= 0) return { trip, event: null };
    if (dt > 30 || delta / dt > 75) return { trip: null, event: "lost" };
    const traveled =
        trip.traveled +
        (delta > Math.max(2, Number(accuracy) || 0) * 0.35 ? delta : 0),
      elapsed = (now - trip.startedAt) / 1000,
      remaining = distanceBetween(position, section.end);
    const passedEnd =
      along(section.start, section.end, position) >=
      distanceBetween(section.start, section.end);
    if (remaining < 40 || (passedEnd && remaining < 100))
      return { trip: null, event: "ending", section };
    const reverse =
      heading != null &&
      angleDifference(heading, bearingBetween(section.start, section.end)) >
        130;
    if (reverse && delta > 10) return { trip: null, event: "lost" };
    return {
      trip: {
        ...trip,
        lastPosition: position,
        lastAt: now,
        traveled,
        average: elapsed > 0 ? (traveled / elapsed) * 3.6 : 0,
        remaining,
      },
      event: null,
    };
  }
  if (heading == null) return { trip: null, event: null };
  for (const section of feed.average_speed_sections || []) {
    if (
      section._example_only ||
      !usablePoint(section.start) ||
      !usablePoint(section.end) ||
      directionMatches(section.direction, heading) === false
    )
      continue;
    const d = distanceBetween(position, section.start);
    if (
      d > 40 ||
      along(section.start, section.end, position) <
        -Math.max(5, Math.min(15, Number(accuracy) || 5)) ||
      angleDifference(heading, bearingBetween(section.start, section.end)) > 55
    )
      continue;
    return {
      trip: {
        section,
        startedAt: now,
        lastAt: now,
        lastPosition: position,
        traveled: 0,
        average: 0,
        remaining: distanceBetween(position, section.end),
      },
      event: "entering",
      section,
    };
  }
  return { trip: null, event: null };
}
