// Maps a live camera warning onto the bundled Yevheniia clips.
// Distances stay on 100 m steps. A camera closer than 100 m is «Камера поруч»,
// never the 100 m clip. An unknown or unrecorded limit is left out entirely.

export const UK_CLIP_IDS = [
  "lead-kamera-cherez",
  "lead-poperedu-cherez",
  "lead-dilianka-cherez",
  "dist-0100", "dist-0200", "dist-0300", "dist-0400", "dist-0500",
  "dist-0600", "dist-0700", "dist-0800", "dist-0900", "dist-1000",
  "dist-1100", "dist-1200", "dist-1300", "dist-1400", "dist-1500",
  "limit-50", "limit-70", "limit-90", "limit-110",
  "slow-50", "slow-70", "slow-90", "slow-110",
  "ahead", "close", "section-start", "section-end", "average-over",
];

const KNOWN_LIMITS = new Set([50, 70, 90, 110]);
export const CLIP_CROSSFADE_MS = 25;
export const CLIP_SENTENCE_PAUSE_MS = 140;

export const UK_CLIP_AUDIO_MODE = {
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  interruptionMode: "doNotMix",
  allowsRecording: false,
  shouldRouteThroughEarpiece: false,
};

export const UK_CLIP_RELEASE_MODE = {
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  interruptionMode: "mixWithOthers",
  allowsRecording: false,
  shouldRouteThroughEarpiece: false,
};

function limitState(limit) {
  const value = Number(limit);
  if (!Number.isFinite(value) || value <= 0) return { known: false, mapped: null };
  if (KNOWN_LIMITS.has(value)) return { known: true, mapped: value };
  return { known: true, mapped: null };
}

function distanceSteps(meters, leadId) {
  const value = Number(meters);
  if (!Number.isFinite(value) || value < 100) return [{ id: "close", join: "none" }];
  const rounded = Math.min(1500, Math.max(100, Math.round(value / 100) * 100));
  return [
    { id: leadId, join: "none" },
    { id: `dist-${String(rounded).padStart(4, "0")}`, join: "crossfade" },
  ];
}

function withLimit(steps, limit, over, { aheadWhenUnknown = false } = {}) {
  const state = limitState(limit);
  if (state.mapped) {
    steps.push({ id: over ? `slow-${state.mapped}` : `limit-${state.mapped}`, join: "pause" });
    return steps;
  }
  if (!state.known && aheadWhenUnknown) steps.push({ id: "ahead", join: "pause" });
  return steps;
}

export function ukrainianClipPlan({ kind, distance, limit, over = false, averageKmh } = {}) {
  if (kind === "section-ending") return { steps: [{ id: "section-end", join: "none" }] };
  if (kind === "section-entering") {
    return { steps: withLimit([{ id: "section-start", join: "none" }], limit, false) };
  }
  if (kind === "section-over") {
    const average = Number(averageKmh);
    const state = limitState(limit);
    if (!Number.isFinite(average) || !state.known) return null;
    const steps = [{ id: "average-over", join: "none" }];
    if (state.mapped) steps.push({ id: `limit-${state.mapped}`, join: "pause" });
    return { steps };
  }
  if (kind === "section-approaching") {
    return { steps: withLimit(distanceSteps(distance, "lead-dilianka-cherez"), limit, false) };
  }
  if (kind === "pl-camera") {
    return { steps: withLimit(distanceSteps(distance, "lead-poperedu-cherez"), limit, false) };
  }
  if (kind === "ua-camera") {
    return { steps: withLimit(distanceSteps(distance, "lead-kamera-cherez"), limit, over, { aheadWhenUnknown: true }) };
  }
  return null;
}

export function audibleSteps(plan, available) {
  const present = available instanceof Set ? available : new Set(available || []);
  const steps = [];
  for (const step of plan?.steps || []) {
    if (!step?.id || !present.has(step.id)) continue;
    steps.push({ id: step.id, join: steps.length === 0 ? "none" : (step.join === "crossfade" ? "crossfade" : "pause") });
  }
  return steps;
}

export function createClipGate() {
  let generation = 0;
  let active = false;
  return {
    start() {
      active = true;
      return ++generation;
    },
    stop() {
      active = false;
      return ++generation;
    },
    current(ticket) {
      return active && ticket === generation;
    },
  };
}

const DISTANCE_IN_PHRASE = /через\s+(\d+)/;

export function ukrainianPlanFromPhrase(phrase) {
  const text = String(phrase || "");
  const limitMatch = /Обмеження\s+(\d+)/.exec(text) || /до\s+(\d+)/.exec(text);
  const limit = limitMatch ? Number(limitMatch[1]) : null;
  const distanceMatch = DISTANCE_IN_PHRASE.exec(text);
  const distance = distanceMatch ? Number(distanceMatch[1]) : null;
  if (text.startsWith("Ділянка контролю середньої швидкості через")) {
    return ukrainianClipPlan({ kind: "section-approaching", distance, limit, over: false });
  }
  if (text.startsWith("Починається ділянка")) {
    return ukrainianClipPlan({ kind: "section-entering", limit, over: false });
  }
  if (text.startsWith("Ділянка контролю середньої швидкості завершена")) {
    return ukrainianClipPlan({ kind: "section-ending" });
  }
  if (text.startsWith("Середня швидкість")) {
    const average = Number(/Середня швидкість\s+(\d+)/.exec(text)?.[1]);
    return ukrainianClipPlan({ kind: "section-over", limit, over: true, averageKmh: average });
  }
  if (text.startsWith("Камера попереду через")) {
    return ukrainianClipPlan({ kind: "pl-camera", distance, limit, over: false });
  }
  if (text.startsWith("Камера через")) {
    const over = text.includes("Знизьте") || text.includes("Зменште");
    return ukrainianClipPlan({ kind: "ua-camera", distance, limit, over });
  }
  return null;
}
