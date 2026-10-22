// Local GPS territory resolver. Not wired to alerts.
// Connecting it to the live pipeline needs a separate user approval.
// No remote flag and no in-app switch can turn that connection on.
// A country code is not an input: a territorial ban is a polygon, not an ISO key.

import { BORDER_MARGIN_METERS, EXCLUSIONS, TERRITORIES } from "./territorial-boundaries.js";

const EARTH_RADIUS_METERS = 6371000;
const MAX_ROAD_SPEED_KMH = 250;
const SAME_FIX_METERS = 1;

const toRad = (value) => (value * Math.PI) / 180;

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function createResolverState() {
  return { confirmed: false, confirmedId: null, pending: null, lastAccepted: null };
}

function pointInRing(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][0];
    const xi = ring[i][1];
    const yj = ring[j][0];
    const xj = ring[j][1];
    const intersects = (yi > lat) !== (yj > lat) &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceToSegmentMeters(lat, lon, a, b) {
  const lat0 = lat;
  const lon0 = lon;
  const toLocal = (point) => ({
    x: toRad(point[1] - lon0) * Math.cos(toRad(lat0)) * EARTH_RADIUS_METERS,
    y: toRad(point[0] - lat0) * EARTH_RADIUS_METERS,
  });
  const start = toLocal(a);
  const end = toLocal(b);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  let t = lengthSquared === 0 ? 0 : -((start.x * dx) + (start.y * dy)) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(start.x + t * dx, start.y + t * dy);
}

function ringClearance(lat, lon, ring) {
  let min = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const next = ring[(i + 1) % ring.length];
    min = Math.min(min, distanceToSegmentMeters(lat, lon, ring[i], next));
  }
  return min;
}

function excluded(territoryId, lat, lon) {
  return EXCLUSIONS.some((exclusion) =>
    exclusion.appliesTo === territoryId && pointInRing(lat, lon, exclusion.ring));
}

function hitsAt(lat, lon) {
  const hits = [];
  for (const territory of TERRITORIES) {
    const inside = territory.rings.some((ring) => pointInRing(lat, lon, ring));
    if (inside && !excluded(territory.id, lat, lon)) hits.push(territory.id);
  }
  return hits;
}

function clearanceOf(territoryId, lat, lon) {
  const territory = TERRITORIES.find((item) => item.id === territoryId);
  let min = Infinity;
  for (const ring of territory.rings) min = Math.min(min, ringClearance(lat, lon, ring));
  for (const exclusion of EXCLUSIONS) {
    if (exclusion.appliesTo === territoryId) {
      min = Math.min(min, ringClearance(lat, lon, exclusion.ring));
    }
  }
  return min;
}

function clearanceToAny(lat, lon) {
  let min = Infinity;
  for (const territory of TERRITORIES) {
    for (const ring of territory.rings) min = Math.min(min, ringClearance(lat, lon, ring));
  }
  for (const exclusion of EXCLUSIONS) min = Math.min(min, ringClearance(lat, lon, exclusion.ring));
  return min;
}

export function classifySample(sample) {
  if (!finite(sample?.latitude) || !finite(sample?.longitude) || !finite(sample?.accuracyMeters) || sample.accuracyMeters < 0) {
    return { kind: "invalid" };
  }
  const { latitude, longitude, accuracyMeters } = sample;
  const hits = hitsAt(latitude, longitude);
  const needed = accuracyMeters + BORDER_MARGIN_METERS;
  if (hits.length > 1) return { kind: "ambiguous" };
  if (hits.length === 1) {
    const clearance = clearanceOf(hits[0], latitude, longitude);
    if (clearance <= needed) return { kind: "band", id: hits[0] };
    return { kind: "interior", id: hits[0] };
  }
  if (clearanceToAny(latitude, longitude) <= needed) return { kind: "band", id: null };
  return { kind: "outside", id: null };
}

function sameFix(a, b) {
  return distanceMeters(a.latitude, a.longitude, b.latitude, b.longitude) <= SAME_FIX_METERS;
}

function impliedSpeedKmh(previous, next) {
  if (!finite(previous?.timeMs) || !finite(next?.timeMs)) return Infinity;
  const seconds = (next.timeMs - previous.timeMs) / 1000;
  if (seconds <= 0) return Infinity;
  return (distanceMeters(previous.latitude, previous.longitude, next.latitude, next.longitude) / seconds) * 3.6;
}

function withResult(state, event) {
  return {
    ...state,
    event,
    restricted: state.confirmed === true && typeof state.confirmedId === "string",
  };
}

export function observeTerritory(state, sample) {
  const current = state || createResolverState();
  const next = {
    confirmed: current.confirmed === true,
    confirmedId: current.confirmedId ?? null,
    pending: current.pending ? { id: current.pending.id, sample: current.pending.sample } : null,
    lastAccepted: current.lastAccepted ? { ...current.lastAccepted } : null,
  };
  const classified = classifySample(sample);
  if (classified.kind === "invalid" || !finite(sample?.timeMs)) return withResult(next, "ignored");
  if (next.lastAccepted && impliedSpeedKmh(next.lastAccepted, sample) > MAX_ROAD_SPEED_KMH) {
    return withResult(next, "jump");
  }
  if (next.lastAccepted && sameFix(next.lastAccepted, sample)) return withResult(next, "duplicate");

  if (classified.kind === "band" || classified.kind === "ambiguous") {
    next.pending = null;
    next.lastAccepted = { ...sample };
    return withResult(next, classified.kind);
  }

  const id = classified.id;
  if (next.confirmed && next.confirmedId === id) {
    next.pending = null;
    next.lastAccepted = { ...sample };
    return withResult(next, "held");
  }
  if (next.pending && next.pending.id === id && !sameFix(next.pending.sample, sample)) {
    next.confirmed = true;
    next.confirmedId = id;
    next.pending = null;
    next.lastAccepted = { ...sample };
    return withResult(next, "confirmed");
  }
  next.pending = { id, sample: { ...sample } };
  next.lastAccepted = { ...sample };
  return withResult(next, "pending");
}

export { BORDER_MARGIN_METERS, MAX_ROAD_SPEED_KMH };
