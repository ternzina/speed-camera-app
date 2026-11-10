import { Platform } from "react-native";

function nativeModule() {
  if (Platform.OS !== "ios") return null;
  try {
    const { requireNativeModule } = require("expo-modules-core");
    return requireNativeModule("CamAlertMapKitDirections");
  } catch {
    return null;
  }
}

export function mapKitDirectionsAvailable() {
  return !!nativeModule();
}

function finitePoint(point) {
  return !!point && Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude));
}

function coordinateList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(finitePoint)
    .map((point) => ({ latitude: Number(point.latitude), longitude: Number(point.longitude) }));
}

function validateStep(step) {
  if (!step || typeof step.instructions !== "string" || !Number.isFinite(Number(step.distance))) return null;
  return {
    instructions: step.instructions,
    distance: Number(step.distance),
    notice: typeof step.notice === "string" ? step.notice : "",
    coordinates: coordinateList(step.polyline),
  };
}

function validateRoute(row) {
  if (!row || !Number.isFinite(Number(row.distance)) || !Number.isFinite(Number(row.expectedTravelTime))) return null;
  const polyline = coordinateList(row.polyline);
  if (polyline.length < 2) return null;
  return {
    name: typeof row.name === "string" ? row.name : "",
    distance: Number(row.distance),
    expectedTravelTime: Number(row.expectedTravelTime),
    advisoryNotices: Array.isArray(row.advisoryNotices) ? row.advisoryNotices.filter((item) => typeof item === "string") : [],
    polyline,
    steps: Array.isArray(row.steps) ? row.steps.map(validateStep).filter(Boolean) : [],
  };
}

export async function searchPlaces(query, bias) {
  const native = nativeModule();
  if (!native) {
    const error = new Error("mapkit-unavailable");
    throw error;
  }
  const text = String(query || "").trim();
  if (!text) {
    const error = new Error("EmptyQuery");
    throw error;
  }
  const hasBias = finitePoint(bias);
  const rows = await native.searchPlaces(text, hasBias ? Number(bias.latitude) : 0, hasBias ? Number(bias.longitude) : 0, hasBias);
  if (!Array.isArray(rows)) {
    const error = new Error("search-invalid");
    throw error;
  }
  return rows.filter(finitePoint).map((row) => ({
    title: typeof row.title === "string" ? row.title : "",
    subtitle: typeof row.subtitle === "string" ? row.subtitle : "",
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  }));
}

export async function calculateRoutes(origin, destination) {
  const native = nativeModule();
  if (!native) {
    const error = new Error("mapkit-unavailable");
    throw error;
  }
  if (!finitePoint(origin) || !finitePoint(destination)) {
    const error = new Error("missing-endpoint");
    throw error;
  }
  const rows = await native.calculateRoutes(
    Number(origin.latitude),
    Number(origin.longitude),
    Number(destination.latitude),
    Number(destination.longitude),
  );
  if (!Array.isArray(rows)) {
    const error = new Error("no-route");
    throw error;
  }
  const routes = rows.map(validateRoute).filter(Boolean);
  if (!routes.length) {
    const error = new Error("no-route");
    throw error;
  }
  return routes;
}
