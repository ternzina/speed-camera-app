export function cameraBanner(camera, typeLabel) {
  if (!camera || typeof camera !== "object") return null;
  const banner = {};
  const hasType = present(camera.camera_type) || present(camera.type);
  const type = String(typeLabel || "").trim();
  if (hasType && type) banner.type = type;
  const distance = Number(camera.distance);
  if (Object.prototype.hasOwnProperty.call(camera, "distance") && Number.isFinite(distance) && distance >= 0) {
    banner.distance = Math.round(distance);
  }
  const limit = Number(camera.speed_limit);
  if (present(camera.speed_limit) && Number.isFinite(limit)) banner.limit = limit;
  return Object.keys(banner).length ? banner : null;
}

export function googleAudioMode({ cameraSpeaking, guiding, voiceEnabled }) {
  if (cameraSpeaking || !guiding || !voiceEnabled) return "silent";
  return "alerts-and-guidance";
}

export function googleBackgroundLocationEnabled({ guiding, tripActive } = {}) {
  return !!(guiding && tripActive);
}

export function navChrome({ guiding = false, routed = false, hasPoint = false } = {}) {
  return {
    search: !guiding,
    maneuver: !!guiding,
    routeBar: !!(routed || guiding),
    go: !!(routed && !guiding),
    build: !!(!routed && !guiding && hasPoint),
    endRoute: !!(routed || guiding),
    following: !!guiding,
    ordinaryMap: !routed && !guiding,
  };
}

function present(value) {
  return value != null && String(value).trim() !== "";
}
