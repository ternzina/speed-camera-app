// One local setting for every camera-alert path. Default on.
// This module does not read GPS, a server flag, or a second switch.

export const CAMERA_WARNINGS_DEFAULT = true;

export function cameraWarningsEnabled(settings) {
  return !settings || settings.cameraWarnings !== false;
}

export function mergeStoredSettings(defaults, stored) {
  if (!stored || typeof stored !== "object") return { ...defaults };
  const next = { ...defaults, ...stored };
  if (!Object.prototype.hasOwnProperty.call(stored, "cameraWarnings")) {
    next.cameraWarnings = defaults.cameraWarnings !== false;
  }
  return next;
}

export function planCameraSurfaces(settings) {
  const on = cameraWarningsEnabled(settings);
  const voiceOn = !settings || settings.voice !== false;
  const vibrationOn = !settings || settings.vibration !== false;
  return {
    voice: on && voiceOn,
    vibration: on && vibrationOn,
    backgroundNotification: on,
    mapMarkers: on,
    distance: on,
    nearestCard: on,
    sectionWarning: on,
    mobileCheck: on,
    speedometer: true,
    plainMap: true,
  };
}

function cameraKind(camera) {
  const type = String(camera?.type || camera?.camera_type || "");
  if (type === "checkpoint" || type === "other_enforcement") return "mobile";
  if (
    type === "average_speed" ||
    type === "average_speed_section" ||
    type === "average_speed_start" ||
    type === "average_speed_end"
  ) {
    return "section";
  }
  return "point";
}

export function cameraAlertDecision(settings, camera) {
  const surfaces = planCameraSurfaces(settings);
  const kind = cameraKind(camera);
  const allowed =
    cameraWarningsEnabled(settings) &&
    (kind !== "mobile" || surfaces.mobileCheck) &&
    (kind !== "section" || surfaces.sectionWarning);
  return {
    emit: allowed,
    voice: allowed && surfaces.voice,
    vibration: allowed && surfaces.vibration,
    notification: allowed && surfaces.backgroundNotification,
    marker: allowed && surfaces.mapMarkers,
    distance: allowed && surfaces.distance,
    nearestCard: allowed && surfaces.nearestCard,
    section: allowed && surfaces.sectionWarning && kind === "section",
    mobile: allowed && surfaces.mobileCheck && kind === "mobile",
    speedometer: true,
    plainMap: true,
  };
}
