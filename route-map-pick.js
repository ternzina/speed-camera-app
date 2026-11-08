// Map viewport for the camera countries. This is not a user location.
export const FALLBACK_MAP_REGION = {
  latitude: 49.0,
  longitude: 31.5,
  latitudeDelta: 12,
  longitudeDelta: 14,
};

export function finitePoint(point) {
  const latitude = Number(point?.latitude);
  const longitude = Number(point?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

export function openingRegion(userPoint) {
  if (!finitePoint(userPoint)) return { region: FALLBACK_MAP_REGION, followsUser: false };
  return {
    region: {
      latitude: Number(userPoint.latitude),
      longitude: Number(userPoint.longitude),
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    },
    followsUser: true,
  };
}

export function centerPick(region, { userMoved = false, openedOnFix = false, routeLocked = false } = {}) {
  if (routeLocked) return null;
  if (!userMoved && !openedOnFix) return null;
  if (!finitePoint(region)) return null;
  return { latitude: Number(region.latitude), longitude: Number(region.longitude) };
}

export function movedEnough(previous, next, meters = 12) {
  if (!finitePoint(previous) || !finitePoint(next)) return true;
  const dLat = (Number(next.latitude) - Number(previous.latitude)) * 111000;
  const dLon = (Number(next.longitude) - Number(previous.longitude)) * 111000 * Math.cos(Number(previous.latitude) * Math.PI / 180);
  return Math.hypot(dLat, dLon) >= meters;
}

export function formatCoordinates(point) {
  if (!finitePoint(point)) return "";
  return `${Number(point.latitude).toFixed(5)}, ${Number(point.longitude).toFixed(5)}`;
}

export function placeNameFromGeocode(row) {
  if (!row || typeof row !== "object") return "";
  const parts = [row.name, row.street, row.district, row.city, row.region]
    .filter((part) => typeof part === "string" && part.trim())
    .map((part) => part.trim());
  const unique = [];
  for (const part of parts) {
    if (!unique.some((item) => item.toLowerCase() === part.toLowerCase())) unique.push(part);
  }
  return unique.slice(0, 3).join(", ");
}

export function canBuildRoute(destination) {
  return finitePoint(destination);
}
