// Map display only. Camera records and their coordinates stay unchanged.
export const MARKER_COLORS = {
  speed: "#D01212",
  speed_light: "#D01212",
  light: "#1B2430",
  section: "#1260E8",
  checkpoint: "#4B5563",
  clusterDay: "#10263B",
  clusterNight: "#E8EEF6",
};

export const MARKER_FOOTPRINT_PX = 32;
export const INDIVIDUAL_CELL_METERS = 70;

export function mapMarkerKind(camera = {}) {
  const type = camera.camera_type || camera.type || "speed_camera";
  const kind = type.startsWith("average_speed")
    ? "average_speed"
    : type === "fixed_speed"
      ? "speed_camera"
      : type === "other_enforcement"
        ? "checkpoint"
        : type;
  if (kind === "red_light") return "light";
  if (kind === "average_speed") return "section";
  if (kind === "speed_and_red_light") return "speed_light";
  if (kind === "checkpoint") return "checkpoint";
  return "speed";
}

export function markerPixelSize(latitudeDelta) {
  const delta = Number(latitudeDelta);
  if (!Number.isFinite(delta) || delta <= 0.02) return 32;
  if (delta <= 0.08) return 28;
  return 24;
}

function cellMeters(latitudeDelta, height) {
  return latitudeDelta * (MARKER_FOOTPRINT_PX / Math.max(height, 1)) * 111320;
}

export function showsIndividualCameras(region) {
  const latitudeDelta = Number(region?.latitudeDelta);
  const height = Math.max(Number(region?.height) || 560, 1);
  return !Number.isFinite(latitudeDelta) || latitudeDelta <= 0 || cellMeters(latitudeDelta, height) <= INDIVIDUAL_CELL_METERS;
}

function exactMarker(camera) {
  return {
    kind: "camera",
    latitude: Number(camera.latitude),
    longitude: Number(camera.longitude),
    camera,
  };
}

function footprintDegrees(region) {
  const latitudeDelta = Number(region?.latitudeDelta);
  const longitudeDelta = Number(region?.longitudeDelta);
  const height = Math.max(Number(region?.height) || 560, 1);
  const width = Math.max(Number(region?.width) || 360, 1);
  return {
    latitude: latitudeDelta * (MARKER_FOOTPRINT_PX / height),
    longitude: Math.max(Number.isFinite(longitudeDelta) ? longitudeDelta : latitudeDelta, 1e-9) * (MARKER_FOOTPRINT_PX / width),
  };
}

function groupFrom(camera) {
  const latitude = Number(camera.latitude);
  const longitude = Number(camera.longitude);
  return { cameras: [camera], latitude, longitude, south: latitude, north: latitude, west: longitude, east: longitude };
}

function absorb(group, camera) {
  const latitude = Number(camera.latitude);
  const longitude = Number(camera.longitude);
  group.cameras.push(camera);
  group.south = Math.min(group.south, latitude);
  group.north = Math.max(group.north, latitude);
  group.west = Math.min(group.west, longitude);
  group.east = Math.max(group.east, longitude);
  group.latitude = group.cameras.reduce((sum, item) => sum + Number(item.latitude), 0) / group.cameras.length;
  group.longitude = group.cameras.reduce((sum, item) => sum + Number(item.longitude), 0) / group.cameras.length;
}

function absorbGroup(target, extra) {
  for (const camera of extra.cameras) absorb(target, camera);
}

function overlaps(a, b, radius) {
  return Math.abs(a.latitude - b.latitude) <= radius.latitude && Math.abs(a.longitude - b.longitude) <= radius.longitude;
}

export function clusterMapPoints(points, region) {
  const list = Array.isArray(points) ? points : [];
  const usable = list.filter(camera => Number.isFinite(Number(camera?.latitude)) && Number.isFinite(Number(camera?.longitude)));
  if (showsIndividualCameras(region)) return usable.map(exactMarker);

  const radius = footprintDegrees(region);
  const groups = [];
  for (const camera of usable) {
    const latitude = Number(camera.latitude);
    const longitude = Number(camera.longitude);
    const group = groups.find(candidate => Math.abs(candidate.latitude - latitude) <= radius.latitude && Math.abs(candidate.longitude - longitude) <= radius.longitude);
    if (group) absorb(group, camera);
    else groups.push(groupFrom(camera));
  }
  for (let pass = 0; pass < groups.length; pass += 1) {
    let merged = false;
    for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        if (!overlaps(groups[i], groups[j], radius)) continue;
        absorbGroup(groups[i], groups[j]);
        groups.splice(j, 1);
        merged = true;
        j -= 1;
      }
    }
    if (!merged) break;
  }

  return groups.map(group => {
    if (group.cameras.length === 1) return exactMarker(group.cameras[0]);
    return {
      kind: "cluster",
      latitude: group.latitude,
      longitude: group.longitude,
      count: group.cameras.length,
      spanLatitude: group.north - group.south,
      spanLongitude: group.east - group.west,
    };
  });
}

export function clusterFocusRegion(cluster, region) {
  const currentLat = Number(region?.latitudeDelta);
  const currentLon = Number(region?.longitudeDelta);
  const fittedLat = Math.max(Number(cluster?.spanLatitude) * 2.4, 0.004);
  const fittedLon = Math.max(Number(cluster?.spanLongitude) * 2.4, 0.004);
  const steppedLat = Number.isFinite(currentLat) && currentLat > 0 ? currentLat / 2.4 : fittedLat;
  const steppedLon = Number.isFinite(currentLon) && currentLon > 0 ? currentLon / 2.4 : fittedLon;
  return {
    latitude: cluster.latitude,
    longitude: cluster.longitude,
    latitudeDelta: Math.min(fittedLat, steppedLat),
    longitudeDelta: Math.min(fittedLon, steppedLon),
  };
}
