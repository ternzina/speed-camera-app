// Navtest-only stored-country count. Production keeps its own counter in App.js.
const BODY_GROUPS = ["cameras", "speed_cameras", "red_light_cameras", "checkpoints", "average_speed_sections"];
export const NAVTEST_STORED_COUNTRY_LIMIT = 2;

export function navtestStoredCountryCodes(feeds) {
  if (!feeds || typeof feeds !== "object" || Array.isArray(feeds)) return [];
  return Object.keys(feeds).filter(code => {
    if (!/^[A-Z]{2}$/.test(code)) return false;
    const feed = feeds[code];
    if (!feed || typeof feed !== "object" || Array.isArray(feed) || feed._removed) return false;
    return BODY_GROUPS.some(group => Array.isArray(feed[group]));
  }).sort();
}

export function navtestCountryDownload(feeds, code) {
  const stored = navtestStoredCountryCodes(feeds);
  const normalized = String(code || "").toUpperCase();
  if (stored.includes(normalized)) return "saved";
  if (stored.length >= NAVTEST_STORED_COUNTRY_LIMIT) return "limit";
  return "download";
}

// A failed or refused delivery returns the same feed object. Nothing is deleted to make room.
export function countryFeedsAfterDelivery(feeds, country, result) {
  const current = feeds && typeof feeds === "object" && !Array.isArray(feeds) ? feeds : {};
  const code = String(country || "").toUpperCase();
  if (!result?.feed || result.source === "offline" || result.source === "bundled") return current;
  const stored = navtestStoredCountryCodes(current);
  if (!stored.includes(code) && stored.length >= NAVTEST_STORED_COUNTRY_LIMIT) return current;
  return { ...current, [code]: result.feed };
}

export function navtestCountryReady(feeds, code, points) {
  if (!Array.isArray(points) || points.length === 0) return false;
  const normalized = String(code || "").toUpperCase();
  if (navtestStoredCountryCodes(feeds).includes(normalized)) return true;
  return normalized === "UA" || normalized === "PL";
}
