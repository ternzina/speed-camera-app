// Pure route math for the iOS MapKit layer.
// No network, no speech engine, no camera-warning decisions.
// A missing polyline is a no-op so the trip without a route stays unchanged.

export const ROUTE_CORRIDOR_METERS = 150;
export const REROUTE_OFF_ROUTE_METERS = 60;
export const REROUTE_MIN_INTERVAL_MS = 25000;
export const REROUTE_WINDOW_MS = 10 * 60 * 1000;
export const REROUTE_MAX_CALLS = 4;
export const REROUTE_MIN_SPEED_MPS = 8 / 3.6;

const EARTH_METERS = 6371000;
const EARLY_SECONDS = 22;
const NOW_SECONDS = 8;
const NOW_MIN_METERS = 45;
const EARLY_MIN_METERS = 120;

function toRad(value) {
  return (value * Math.PI) / 180;
}

export function distanceMeters(a, b) {
  if (!a || !b || !Number.isFinite(a.latitude) || !Number.isFinite(a.longitude)) return Infinity;
  if (!Number.isFinite(b.latitude) || !Number.isFinite(b.longitude)) return Infinity;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

function localMeters(origin, point) {
  const latRad = toRad(origin.latitude);
  return {
    x: (point.longitude - origin.longitude) * Math.cos(latRad) * 111320,
    y: (point.latitude - origin.latitude) * 110540,
  };
}

function distanceToSegmentMeters(point, start, end) {
  const origin = point;
  const a = localMeters(origin, start);
  const b = localMeters(origin, end);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.01) return Math.hypot(a.x, a.y);
  const raw = ((0 - a.x) * dx + (0 - a.y) * dy) / lengthSq;
  const t = Math.max(0, Math.min(1, raw));
  return Math.hypot(a.x + dx * t, a.y + dy * t);
}

export function distanceToPolylineMeters(point, polyline) {
  if (!point || !Array.isArray(polyline) || polyline.length === 0) return Infinity;
  if (polyline.length === 1) return distanceMeters(point, polyline[0]);
  let best = Infinity;
  for (let index = 1; index < polyline.length; index += 1) {
    best = Math.min(best, distanceToSegmentMeters(point, polyline[index - 1], polyline[index]));
  }
  return best;
}

function segmentFraction(point, start, end) {
  const a = localMeters(point, start);
  const b = localMeters(point, end);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.01) return 0;
  return Math.max(0, Math.min(1, ((-a.x) * dx + (-a.y) * dy) / lengthSq));
}

export function polylineLengthMeters(polyline) {
  if (!Array.isArray(polyline) || polyline.length < 2) return 0;
  let walked = 0;
  for (let index = 1; index < polyline.length; index += 1) walked += distanceMeters(polyline[index - 1], polyline[index]);
  return walked;
}

export function distanceAlongPolyline(point, polyline) {
  if (!point || !Array.isArray(polyline) || polyline.length < 2) return 0;
  let best = Infinity;
  let along = 0;
  let walked = 0;
  for (let index = 1; index < polyline.length; index += 1) {
    const start = polyline[index - 1];
    const end = polyline[index];
    const segment = distanceMeters(start, end);
    const fraction = segmentFraction(point, start, end);
    const closest = {
      latitude: start.latitude + (end.latitude - start.latitude) * fraction,
      longitude: start.longitude + (end.longitude - start.longitude) * fraction,
    };
    const offset = distanceMeters(point, closest);
    if (offset < best) {
      best = offset;
      along = walked + segment * fraction;
    }
    walked += segment;
  }
  return along;
}

export function narrowCamerasToRoute(cameras, polyline, meters = ROUTE_CORRIDOR_METERS) {
  if (!Array.isArray(cameras)) return cameras;
  if (!Array.isArray(polyline) || polyline.length < 2) return cameras;
  if (!Number.isFinite(meters) || meters <= 0) return cameras;
  return cameras.filter((camera) => distanceToPolylineMeters(camera, polyline) <= meters);
}

// Display helper only. Warning selection must keep using the full loaded feed.
export function corridorFeed(feed, polyline, meters = ROUTE_CORRIDOR_METERS) {
  if (!feed || !Array.isArray(polyline) || polyline.length < 2) return feed;
  const narrow = (list) => (Array.isArray(list) ? narrowCamerasToRoute(list, polyline, meters) : list);
  return {
    ...feed,
    cameras: narrow(feed.cameras),
    speed_cameras: narrow(feed.speed_cameras),
    red_light_cameras: narrow(feed.red_light_cameras),
    checkpoints: narrow(feed.checkpoints),
    average_speed_sections: feed.average_speed_sections,
  };
}

function stepLength(step) {
  const line = step?.coordinates;
  if (Array.isArray(line) && line.length >= 2) {
    let length = 0;
    for (let index = 1; index < line.length; index += 1) length += distanceMeters(line[index - 1], line[index]);
    if (length > 1) return length;
  }
  return Number.isFinite(step?.distance) ? step.distance : 0;
}

export function guidanceState(location, route) {
  if (!location || !route || !Array.isArray(route.polyline) || route.polyline.length < 2) return null;
  if (!Array.isArray(route.steps) || route.steps.length === 0) return null;
  const offRouteMeters = distanceToPolylineMeters(location, route.polyline);
  const traveled = distanceAlongPolyline(location, route.polyline);
  let cursor = 0;
  for (let index = 0; index < route.steps.length; index += 1) {
    const length = stepLength(route.steps[index]);
    const end = cursor + length;
    const last = index === route.steps.length - 1;
    if (last || traveled < end) {
      return {
        stepIndex: index,
        instruction: route.steps[index].instructions || "",
        distanceMeters: Math.max(0, end - traveled),
        offRouteMeters,
      };
    }
    cursor = end;
  }
  return null;
}

// Scales the last Apple duration by remaining geometry. This is not live traffic.
export function approximateRouteProgress(location, route) {
  if (!location || !route || !Array.isArray(route.polyline) || route.polyline.length < 2) return null;
  const totalMeters = polylineLengthMeters(route.polyline);
  if (!(totalMeters > 0)) return null;
  const traveled = Math.min(totalMeters, Math.max(0, distanceAlongPolyline(location, route.polyline)));
  const remainingMeters = Math.max(0, totalMeters - traveled);
  const appleSeconds = Number(route.expectedTravelTime);
  const etaSeconds = Number.isFinite(appleSeconds) && appleSeconds >= 0
    ? appleSeconds * (remainingMeters / totalMeters)
    : null;
  return { remainingMeters, totalMeters, etaSeconds, approximate: true, liveTraffic: false };
}

export function formatArrivalTime(language, etaSeconds, nowMs = Date.now()) {
  if (!Number.isFinite(etaSeconds) || etaSeconds < 0) return null;
  const arrival = new Date(nowMs + etaSeconds * 1000);
  const clock = `${String(arrival.getHours()).padStart(2, "0")}:${String(arrival.getMinutes()).padStart(2, "0")}`;
  if (language === "en") return `about ${clock}`;
  if (language === "pl") return `około ${clock}`;
  if (language === "uk") return `приблизно ${clock}`;
  return `примерно ${clock}`;
}

export function announceBand({ distanceMeters, speedMps }) {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return null;
  const moving = Number.isFinite(speedMps) && speedMps > 1 ? speedMps : null;
  const nowMeters = moving ? Math.max(NOW_MIN_METERS, moving * NOW_SECONDS) : NOW_MIN_METERS;
  const earlyMeters = moving ? Math.max(EARLY_MIN_METERS, moving * EARLY_SECONDS) : 250;
  if (distanceMeters <= nowMeters) return "now";
  if (distanceMeters <= earlyMeters) return "early";
  return null;
}

export function speechLocale(language) {
  if (language === "pl") return "pl-PL";
  if (language === "uk") return "uk-UA";
  if (language === "en") return "en-US";
  return "ru-RU";
}

export function formatDistance(language, meters) {
  if (!Number.isFinite(meters) || meters < 0) return null;
  if (meters >= 1000) {
    const kilometers = (meters / 1000).toFixed(1);
    if (language === "en") return `${kilometers} km`;
    if (language === "pl") return `${kilometers} km`;
    return `${kilometers} км`;
  }
  const rounded = Math.max(10, Math.round(meters / 10) * 10);
  if (language === "en") return `${rounded} m`;
  if (language === "pl") return `${rounded} m`;
  return `${rounded} м`;
}

export function formatDuration(language, seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 60) {
    const value = Math.max(1, Math.round(seconds));
    if (language === "en") return `${value} sec`;
    if (language === "pl") return `${value} s`;
    if (language === "uk") return `${value} с`;
    return `${value} с`;
  }
  const minutes = Math.round(seconds / 60);
  if (language === "en") return `${minutes} min`;
  if (language === "pl") return `${minutes} min`;
  if (language === "uk") return `${minutes} хв`;
  return `${minutes} мин`;
}

export function navPhrase(language, instruction, distanceMeters) {
  const text = String(instruction || "").trim();
  const distance = formatDistance(language, distanceMeters);
  if (!text || !distance) return null;
  if (language === "en") return `In ${distance}. ${text}`;
  if (language === "pl") return `Za ${distance}. ${text}`;
  if (language === "uk") return `Через ${distance}. ${text}`;
  return `Через ${distance}. ${text}`;
}

export function planNavAnnouncement({ stepIndex, distanceMeters, speedMps, spoken, instruction, language }) {
  const band = announceBand({ distanceMeters, speedMps });
  if (!band) return { speak: false, reason: "far" };
  const key = `${stepIndex}:${band}`;
  if (spoken && spoken[key]) return { speak: false, reason: "already", key };
  const phrase = navPhrase(language, instruction, distanceMeters);
  if (!phrase) return { speak: false, reason: "no-instruction", key };
  return { speak: true, key, phrase, locale: speechLocale(language), band };
}

export function shouldRequestReroute({
  at,
  offRouteMeters,
  speedMps,
  history,
  offRouteMetersLimit = REROUTE_OFF_ROUTE_METERS,
  minIntervalMs = REROUTE_MIN_INTERVAL_MS,
  windowMs = REROUTE_WINDOW_MS,
  maxCalls = REROUTE_MAX_CALLS,
  minSpeedMps = REROUTE_MIN_SPEED_MPS,
} = {}) {
  const calls = Array.isArray(history)
    ? history.filter((stamp) => Number.isFinite(stamp) && at - stamp < windowMs && at - stamp >= 0)
    : [];
  if (!Number.isFinite(at)) return { ok: false, reason: "clock", history: calls };
  if (!Number.isFinite(speedMps) || speedMps < minSpeedMps) return { ok: false, reason: "slow", history: calls };
  if (!Number.isFinite(offRouteMeters) || offRouteMeters < offRouteMetersLimit) {
    return { ok: false, reason: "on-route", history: calls };
  }
  if (calls.length >= maxCalls) return { ok: false, reason: "cap", history: calls };
  const last = calls.length ? calls[calls.length - 1] : null;
  if (last != null && at - last < minIntervalMs) return { ok: false, reason: "interval", history: calls };
  return { ok: true, reason: "deviated", history: [...calls, at] };
}

export function guidanceZoom(speedKmh) {
  if (!Number.isFinite(speedKmh)) return 17;
  if (speedKmh >= 90) return 15;
  if (speedKmh >= 50) return 16;
  return 17;
}

export function regionForCoordinates(points) {
  const usable = (points || []).filter((point) => Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude));
  if (!usable.length) return null;
  let south = 90;
  let north = -90;
  let west = 180;
  let east = -180;
  for (const point of usable) {
    south = Math.min(south, point.latitude);
    north = Math.max(north, point.latitude);
    west = Math.min(west, point.longitude);
    east = Math.max(east, point.longitude);
  }
  return {
    latitude: (south + north) / 2,
    longitude: (west + east) / 2,
    latitudeDelta: Math.min(50, Math.max(0.02, (north - south) * 1.4)),
    longitudeDelta: Math.min(50, Math.max(0.02, (east - west) * 1.4)),
  };
}

export function packRoute(destination, title, calculated) {
  return {
    builtAt: Date.now(),
    destination,
    title: title || "",
    name: calculated.name || "",
    distance: calculated.distance,
    expectedTravelTime: calculated.expectedTravelTime,
    polyline: calculated.polyline,
    steps: calculated.steps,
  };
}
