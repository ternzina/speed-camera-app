// A typed coordinate is resolved on the phone. Address text goes through
// google-places.js, not through this function.

export function parseCoordinate(query) {
  const match = String(query || "").trim().match(
    /^(-?\d{1,3}(?:[.,]\d+)?)\s*[,;]\s*(-?\d{1,3}(?:[.,]\d+)?)$/,
  );
  if (!match) return null;
  const lat = Number(match[1].replace(",", "."));
  const lng = Number(match[2].replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function lookupDestinations(query) {
  const point = parseCoordinate(query);
  if (point) {
    return {
      available: true,
      results: [{
        id: "coordinate",
        title: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
        address: "",
        lat: point.lat,
        lng: point.lng,
      }],
    };
  }
  return { results: [] };
}
