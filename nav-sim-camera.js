// Turns a Navigation SDK location into the fix the live camera handler
// already accepts. The journal lists the decision only. It never includes
// the point itself.

const JOURNAL_FIELDS = [
  "cameraId",
  "distance",
  "speed",
  "heading",
  "angle",
  "eligible",
  "suppressedReason",
  "speechRequested",
  "speechStarted",
  "speechCompleted",
  "speechError",
];

function toRad(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDegrees(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
    - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180 / Math.PI) % 360 + 360) % 360;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function navigationSample(location, previous, now = Date.now()) {
  const lat = finite(location?.lat);
  const lng = finite(location?.lng);
  if (lat == null || lng == null) return null;
  const stamp = finite(location?.time);
  const at = stamp != null && stamp > 1e11 ? stamp : now;
  let heading = finite(location?.bearing);
  const reported = finite(location?.speed);
  let speedKmh = reported != null && reported >= 0 ? reported * 3.6 : 0;
  if (previous && finite(previous.lat) != null && finite(previous.lng) != null) {
    const dt = (at - Number(previous.at)) / 1000;
    const meters = distanceMeters(previous.lat, previous.lng, lat, lng);
    if (heading == null && meters >= 3) heading = bearingDegrees(previous.lat, previous.lng, lat, lng);
    if (dt >= 0.2 && dt <= 30) {
      const derived = (meters / dt) * 3.6;
      if (speedKmh < 8 && derived > speedKmh) speedKmh = derived;
    }
  }
  return {
    fix: {
      latitude: lat,
      longitude: lng,
      speedKmh,
      heading,
      speedAvailable: speedKmh >= 8,
      source: "simulated",
    },
    previous: { lat, lng, at },
  };
}

export function cameraDecisionJournal(fields = {}) {
  const out = {};
  for (const key of JOURNAL_FIELDS) {
    const value = fields[key];
    if (typeof value === "boolean") out[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = Math.round(value);
    else if (typeof value === "string" && value.length <= 80 && !/-?\d{1,3}\.\d{4,}/.test(value)) out[key] = value;
    else out[key] = null;
  }
  return out;
}

export function speechTrace(speech, requested) {
  const value = String(speech || "none");
  const completed = value === "done";
  const started = completed || ["requested", "spoken", "fallback-speech", "stopped", "speaking"].includes(value);
  return {
    speechRequested: requested === true,
    speechStarted: requested === true && started,
    speechCompleted: completed,
    speechError: completed || value === "none" || started ? "none" : value,
  };
}
