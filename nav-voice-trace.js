// Temporary local trace for navigation voice. It records the native
// voiceGuidance value the bridge would assign. It does not read keys,
// coordinates, or the spoken text.

export function nativeVoiceGuidance(index) {
  const value = Number(index);
  if (value === 0) return "Silent";
  if (value === 1) return "AlertsOnly";
  return "AlertsAndGuidance";
}

export function voiceGuidanceChange(previous, index) {
  const guidance = nativeVoiceGuidance(index);
  return { guidance, changed: previous !== guidance, next: guidance };
}

const listeners = new Set();
let sink = null;

export function subscribeNavVoice(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setNavVoiceSink(next) {
  sink = typeof next === "function" ? next : null;
}

export function traceNavVoice(event, fields = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(fields)) {
    if (/key|token|secret|lat|lng|coord|latitude|longitude/i.test(key)) continue;
    if (typeof value === "string" && value.length > 160) continue;
    safe[key] = typeof value === "number" && !Number.isFinite(value) ? null : value;
  }
  const line = `CAMALERT_NAV_VOICE ${event} ${JSON.stringify(safe)}`;
  console.log(line);
  for (const listener of listeners) listener(event, safe);
  try {
    sink?.(line);
  } catch {
    // The journal must not change the guidance decision.
  }
}
