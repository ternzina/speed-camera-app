// Trip-map camera follow.
// The shipped iOS app is Fabric. RNMapsMapView installs onRegionChange on
// every map, and AIRMapManager clears ignoreRegionChanges inside
// regionDidChangeAnimated. animateCamera still calls setCamera:animated:YES,
// so mapViewDidChangeVisibleRegion keeps crossing the bridge for every frame
// of that animation. Opening a trip forces the first command, and a real
// iPhone then restarts it whenever a fix jumps by more than 12 m or 12°.
// setCamera is not animated, so those updates do not start the frame stream.
// The gate still drops stationary jitter. Warnings and background location
// stay on.

const EARTH_METERS = 6371000;

function distanceMeters(a, b) {
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

function headingDelta(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  const delta = Math.abs(a - b) % 360;
  return delta > 180 ? 360 - delta : delta;
}

function commandFrom(sample) {
  const moving = !!sample.moving && Number.isFinite(sample.heading);
  return {
    api: "setCamera",
    latitude: sample.latitude,
    longitude: sample.longitude,
    heading: moving ? sample.heading : 0,
    pitch: moving ? 34 : 0,
    zoom: sample.zoom,
    at: sample.at,
  };
}

function nextDriveCameraCommand(previous, sample, options = {}) {
  if (!sample || !Number.isFinite(sample.latitude) || !Number.isFinite(sample.longitude)) return null;
  if (!Number.isFinite(sample.zoom) || !Number.isFinite(sample.at)) return null;
  const next = commandFrom(sample);
  if (options.force || !previous) return next;

  const minMoveMeters = options.minMoveMeters ?? 12;
  const minHeadingDegrees = options.minHeadingDegrees ?? 12;
  const minIntervalMs = options.minIntervalMs ?? 700;
  const moved = distanceMeters(previous, sample);
  const turned = sample.moving ? headingDelta(previous.heading, sample.heading) : 0;
  const zoomChanged = previous.zoom !== sample.zoom;
  if (!zoomChanged && sample.at - previous.at < minIntervalMs) return null;
  if (zoomChanged || moved >= minMoveMeters || turned >= minHeadingDegrees) return next;
  return null;
}

export { nextDriveCameraCommand, distanceMeters };
