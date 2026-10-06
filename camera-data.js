// Country feeds come from the existing Supabase camera-export endpoint.
// Bundled UA/PL data are retained only as offline fallbacks.
export function cameraPoints(feed) {
  if (!feed) return [];
  if (Array.isArray(feed.cameras)) return feed.cameras;
  return [
    ...(feed.speed_cameras || []),
    ...(feed.red_light_cameras || []),
    ...(feed.checkpoints || []),
  ].filter(camera => !camera._example_only);
}

export function countryFeed(feeds, country, fallbackUA, fallbackPL) {
  const code = String(country || "ua").toUpperCase();
  return feeds[code] || (code === "UA" ? fallbackUA : code === "PL" ? fallbackPL : {
    country: code, speed_cameras: [], red_light_cameras: [], checkpoints: [], average_speed_sections: [],
  });
}
