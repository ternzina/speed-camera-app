// The camera decision shared by the phone GPS watch and the preview test.
// The preview test calls this through the same App.js handler. It does not
// read or write the device location.

const EARTH_RADIUS_M = 6371000;

function toRad(value) {
  return (value * Math.PI) / 180;
}

function norm(value) {
  return ((value % 360) + 360) % 360;
}

export function distanceMeters(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDegrees(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
    - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return norm(Math.atan2(y, x) * 180 / Math.PI);
}

function angleDiff(a, b) {
  const delta = Math.abs(norm(a) - norm(b));
  return delta > 180 ? 360 - delta : delta;
}

export function movePoint(lat, lon, bearingDeg, distanceM) {
  const delta = distanceM / EARTH_RADIUS_M;
  const theta = toRad(bearingDeg);
  const phi1 = toRad(lat);
  const lambda1 = toRad(lon);
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
  const lambda2 = lambda1 + Math.atan2(
    Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
    Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
  );
  return { lat: (phi2 * 180) / Math.PI, lon: (lambda2 * 180) / Math.PI };
}

export function nearestAhead(cameras, latitude, longitude, movementHeading, maxDistance = 5000, forwardAngle = 45) {
  if (movementHeading == null) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const cam of cameras) {
    const d = distanceMeters(latitude, longitude, cam.latitude, cam.longitude);
    if (d > maxDistance) continue;
    if (cam.direction != null && /^\d+(\.\d+)?$/.test(String(cam.direction)) && angleDiff(movementHeading, Number(cam.direction)) > 60) continue;
    const camBearing = bearingDegrees(latitude, longitude, cam.latitude, cam.longitude);
    const angle = angleDiff(movementHeading, camBearing);
    if (angle <= forwardAngle && d < bestDistance) {
      bestDistance = d;
      best = { ...cam, distance: Math.round(d), angle: Math.round(angle) };
    }
  }
  return best;
}

export function warningDistanceForSpeed(speedKmh, settings) {
  if (!settings?.smartDistance) return settings?.roadDistance;
  if (speedKmh < 60) return settings.cityDistance;
  if (speedKmh < 90) return settings.roadDistance;
  if (speedKmh < 120) return settings.highwayDistance;
  return settings.fastDistance;
}

export function ukraineFixDecision({ speedKmh, heading, ahead, threshold, last, minSpeed = 8 }) {
  if (!(Number(speedKmh) >= minSpeed) || heading == null || !Number.isFinite(Number(heading))) {
    return { speak: false, reason: "below-speed" };
  }
  const fields = {
    distance: ahead?.distance,
    limit: ahead?.speed_limit ?? null,
    cameraId: ahead?.id ?? null,
    angle: Number.isFinite(ahead?.angle) ? ahead.angle : null,
  };
  if (!ahead) return { speak: false, reason: "none-ahead", ...fields, distance: null };
  if (ahead.distance > threshold) return { speak: false, reason: "distance", ...fields };
  if (last && last.id === ahead.id && last.distance - ahead.distance < 250) {
    return { speak: false, reason: "repeat", ...fields };
  }
  return { speak: true, reason: "warn", ...fields };
}

// A warning inside one approach repeats only after the car is 250 m closer.
// Leaving the zone, or having no camera ahead, arms the next approach.
// A stop or a missing heading does not: those decisions never reach this.
export function settleUkraineLast(last, decision) {
  const current = last && last.id != null ? last : { id: null, distance: Infinity };
  if (decision?.speak) return { id: decision.cameraId, distance: decision.distance };
  if (decision?.reason === "none-ahead") return { id: null, distance: Infinity };
  if (decision?.reason === "distance" && current.id != null && current.id === decision.cameraId) {
    return { id: null, distance: Infinity };
  }
  return current;
}

function place(camera, bearing, distance) {
  const spot = movePoint(Number(camera.latitude), Number(camera.longitude), (bearing + 180) % 360, distance);
  return { latitude: spot.lat, longitude: spot.lon, heading: bearing };
}

function approachAt(cameras, camera, bearing, distance) {
  const spot = place(camera, bearing, distance);
  const found = nearestAhead(cameras, spot.latitude, spot.longitude, bearing);
  if (!found || found.id !== camera.id || Math.abs(found.distance - distance) > 60) return null;
  return spot;
}

// Picks approach points for the preview run. Callers must not write the
// coordinates into a journal or a report.
export function buildPreviewCases(cameras) {
  const points = (cameras || []).filter(camera => Number.isFinite(Number(camera?.latitude)) && Number.isFinite(Number(camera?.longitude)));
  let primary = null;
  for (const camera of points) {
    for (const bearing of [0, 90, 180, 270]) {
      const at500 = approachAt(points, camera, bearing, 500);
      const at800 = approachAt(points, camera, bearing, 800);
      const at400 = approachAt(points, camera, bearing, 400);
      if (!at500 || !at800 || !at400) continue;
      const away = place(camera, bearing, 500);
      const behind = nearestAhead(points, away.latitude, away.longitude, (bearing + 180) % 360);
      if (behind && (behind.id === camera.id || behind.distance <= 600)) continue;
      primary = { id: camera.id, limit: camera.speed_limit ?? null, bearing, at500, at800, at400, away, camera };
      break;
    }
    if (primary) break;
  }
  if (!primary) return null;
  let second = null;
  for (const camera of points) {
    if (camera.id === primary.id) continue;
    if (distanceMeters(primary.camera.latitude, primary.camera.longitude, camera.latitude, camera.longitude) < 8000) continue;
    for (const bearing of [0, 90, 180, 270]) {
      const at800 = approachAt(points, camera, bearing, 800);
      if (!at800) continue;
      second = { id: camera.id, limit: camera.speed_limit ?? null, at800 };
      break;
    }
    if (second) break;
  }
  return { primary, second };
}

// A simulated drive starts inside the city warning distance, with the camera
// ahead, and ends past that camera. Callers must not write the points down.
export function diagnosticApproach(cameras) {
  const plan = buildPreviewCases(cameras)?.primary;
  if (!plan?.at500 || !plan.camera) return null;
  const beyond = movePoint(Number(plan.camera.latitude), Number(plan.camera.longitude), plan.bearing, 350);
  const distance = Math.round(distanceMeters(
    plan.at500.latitude,
    plan.at500.longitude,
    Number(plan.camera.latitude),
    Number(plan.camera.longitude),
  ));
  return {
    start: { lat: plan.at500.latitude, lng: plan.at500.longitude },
    destination: { lat: beyond.lat, lng: beyond.lon },
    heading: plan.bearing,
    cameraId: plan.id,
    limit: plan.limit,
    distance,
  };
}
