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

  return (table[language] || table.ru)[event.state] || "";
}
