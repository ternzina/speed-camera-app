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
