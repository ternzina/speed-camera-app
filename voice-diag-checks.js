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

// The same sentence ukrainianClipPlan builds for a camera 500 m ahead at 50.
// The button plays this plan and does not start a trip.
export function cameraVoiceCheckPlan() {
  return {
    steps: [
      { id: "lead-kamera-cherez", join: "none" },
      { id: "dist-0500", join: "crossfade" },
      { id: "limit-50", join: "pause" },
    ],
  };
}

export function restoreRequest() {
  return { silentIndex: 0, voiceIndex: 4, clip: "close" };
}

export const AUTO_ORDER = ["place", "route", "before-start", "guidance", "simulation", "approach"];

export function failureCode(error) {
  const text = String(error?.code || error?.message || "failed");
  if (/-?\d{1,3}\.\d{4,}/.test(text) || /key|token|secret/i.test(text)) return "failed";
  return text.slice(0, 80);
}
