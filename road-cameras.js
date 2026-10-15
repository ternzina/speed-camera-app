// Separate domain model for road observation cameras. These fixtures are
// synthetic UI examples and must never be treated as production camera feeds.
export const POLAND_DEMO_CAMERAS = [
  { id: "demo-a1-gdansk", road: "A1", place: "Окрестности Гданьска", direction: "на юг", latitude: 54.37, longitude: 18.55, sourceName: "CamAlert · демо", sourceUrl: null, imageUrl: null, imageUpdatedAt: null, mode: "demo", availability: "demo" },
  { id: "demo-a2-warsaw", road: "A2", place: "Окрестности Варшавы", direction: "на запад", latitude: 52.23, longitude: 20.96, sourceName: "CamAlert · демо", sourceUrl: null, imageUrl: null, imageUpdatedAt: null, mode: "demo", availability: "demo" },
  { id: "demo-a4-krakow", road: "A4", place: "Окрестности Кракова", direction: "на запад", latitude: 50.06, longitude: 19.94, sourceName: "CamAlert · демо", sourceUrl: null, imageUrl: null, imageUpdatedAt: null, mode: "demo", availability: "demo" },
  { id: "demo-s7-kielce", road: "S7", place: "Окрестности Кельце", direction: "на север", latitude: 50.87, longitude: 20.63, sourceName: "CamAlert · демо", sourceUrl: null, imageUrl: null, imageUpdatedAt: null, mode: "demo", availability: "demo" },
  { id: "demo-s8-lodz", road: "S8", place: "Окрестности Лодзи", direction: "на восток", latitude: 51.77, longitude: 19.46, sourceName: "CamAlert · демо", imageUrl: null, imageUpdatedAt: null, mode: "demo", availability: "demo" },
];

export function distanceBetweenMeters(a, b) {
  const rad = value => value * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export function frameFreshness(updatedAt, now = Date.now(), staleAfterMs = 15 * 60 * 1000) {
  if (!updatedAt) return "unknown";
  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) return "unknown";
  if (timestamp > now + 60 * 1000) return "invalid";
  return now - timestamp > staleAfterMs ? "stale" : "fresh";
}
