const NAVIGATOR_IDS = ["apple", "google"];

function parseDestination(value) {
  if (value == null) return null;
  if (typeof value === "object") {
    if (value.latitude == null || value.longitude == null) return null;
    const latitude = Number(value.latitude);
    const longitude = Number(value.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)
      && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
      return { kind: "coordinates", value: `${latitude},${longitude}` };
    }
    return null;
  }

  const text = String(value).trim();
  if (!text) return null;
  const coordinates = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coordinates) {
    const latitude = Number(coordinates[1]);
    const longitude = Number(coordinates[2]);
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    return { kind: "coordinates", value: `${latitude},${longitude}` };
  }
  return { kind: "query", value: text };
}

function buildNavigatorLinks(navigator, destination, platform) {
  if (!NAVIGATOR_IDS.includes(navigator)) throw new Error("Unknown navigator");
  if (navigator === "apple" && platform !== "ios") throw new Error("Apple Maps is available only on iOS");

  const target = parseDestination(destination);
  if (destination != null && String(destination).trim?.() && !target) throw new Error("Invalid destination");
  const value = target ? encodeURIComponent(target.value) : null;

  if (navigator === "apple") {
    const query = value ? `?daddr=${value}&dirflg=d` : "";
    return {
      appUrl: `maps://${query}`,
      webUrl: target ? `https://maps.apple.com/directions?destination=${value}&mode=driving` : "https://maps.apple.com/",
    };
  }

  if (navigator === "google") {
    if (platform === "android") {
      const query = value ? `q=${value}&mode=d` : "";
      return {
        appUrl: `google.navigation:${query}`,
        webUrl: value
          ? `https://www.google.com/maps/dir/?api=1&destination=${value}&travelmode=driving`
          : "https://www.google.com/maps",
      };
    }
    const query = value ? `?daddr=${value}&directionsmode=driving` : "";
    return {
      appUrl: `comgooglemaps://${query}`,
      webUrl: value
        ? `https://www.google.com/maps/dir/?api=1&destination=${value}&travelmode=driving`
        : "https://www.google.com/maps",
    };
  }


}

module.exports = { NAVIGATOR_IDS, buildNavigatorLinks, parseDestination };
