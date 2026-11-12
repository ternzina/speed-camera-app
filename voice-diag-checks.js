// Decisions for the diagnostic screen. None of these run on import.

export function routeSimulationRequest(guiding) {
  if (!guiding) return { start: false, reason: "waiting" };
  return { start: true, speedMultiplier: 1 };
}

export function googleOnlyRequest() {
  return { index: 4, reason: "google-only", playClip: false };
}

export function yevheniiaOnlyPlan() {
  return { steps: [{ id: "close", join: "none" }], changeVoice: false };
}

export function restoreRequest() {
  return { silentIndex: 0, voiceIndex: 4, clip: "close" };
}

export const AUTO_ORDER = ["origin", "route", "google-only", "guidance", "simulation", "yevheniia", "restore"];

export function failureCode(error) {
  const text = String(error?.code || error?.message || "failed");
  if (/-?\d{1,3}\.\d{4,}/.test(text) || /key|token|secret/i.test(text)) return "failed";
  return text.slice(0, 80);
}
