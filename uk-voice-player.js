import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync } from "expo-audio";
import { traceNavVoice } from "./nav-voice-trace";
import { ukVoiceSources } from "./uk-voice-assets";
import {
  audibleSteps,
  CLIP_CROSSFADE_MS,
  CLIP_SENTENCE_PAUSE_MS,
  UK_CLIP_AUDIO_MODE,
  UK_CLIP_RELEASE_MODE,
} from "./uk-voice-clips";

const live = new Set();

function release(player) {
  if (!player) return;
  live.delete(player);
  try { player.pause(); } catch {}
  try { player.remove(); } catch {}
}

export function stopUkrainianClips() {
  for (const player of [...live]) release(player);
}

function delay(ms, current) {
  return new Promise(resolve => {
    const started = Date.now();
    const tick = () => {
      if (!current()) { resolve(false); return; }
      if (Date.now() - started >= ms) { resolve(true); return; }
      setTimeout(tick, 20);
    };
    tick();
  });
}

function openPlayer(source) {
  const player = createAudioPlayer(source, { updateInterval: 16, keepAudioSessionActive: true });
  live.add(player);
  player.play();
  return player;
}

// Resolves 'near' slightly before the end so the next clip can crossfade,
// 'ended' if the file finishes first, or 'stopped' when the warning is stale.
function watch(player, current, leadSeconds) {
  return new Promise(resolve => {
    let settled = false;
    let subscription;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      try { subscription?.remove(); } catch {}
      resolve(value);
    };
    const watchdog = setTimeout(() => finish(current() ? "ended" : "stopped"), 20000);
    const look = (status) => {
      if (!current()) { finish("stopped"); return; }
      const duration = Number(status?.duration ?? player.duration) || 0;
      const time = Number(status?.currentTime ?? player.currentTime) || 0;
      if (status?.didJustFinish || (duration > 0.05 && time >= duration - 0.01)) { finish("ended"); return; }
      if (duration > 0.05 && duration - time <= leadSeconds) finish("near");
    };
    try {
      subscription = player.addListener("playbackStatusUpdate", look);
    } catch {
      finish("ended");
    }
  });
}

export function clipPlanMissing(plan) {
  const steps = Array.isArray(plan?.steps) ? plan.steps : [];
  if (!steps.length) return true;
  return steps.some((step) => !step?.id || ukVoiceSources[step.id] == null);
}

export async function playClipPlan(plan, current) {
  const steps = audibleSteps(plan, Object.keys(ukVoiceSources));
  if (!steps.length || !current()) {
    traceNavVoice("clip.skip", { steps: steps.length, current: current() });
    return { played: 0, stopped: !current(), failed: false };
  }
  let configured = false;
  try {
    await setAudioModeAsync(UK_CLIP_AUDIO_MODE);
    configured = true;
    traceNavVoice("clip.session", { interruption: "doNotMix", keepAudioSessionActive: true });
  } catch {
    // A session error must not throw out of a location task.
  }
  let played = 0;
  let carry = null;
  try {
    for (let index = 0; index < steps.length; index += 1) {
      if (!current()) return { played, stopped: true, failed: false };
      const step = steps[index];
      const source = ukVoiceSources[step.id];
      if (source == null) return { played, stopped: false, failed: true };
      if (step.join === "pause") {
        release(carry);
        carry = null;
        if (!await delay(CLIP_SENTENCE_PAUSE_MS, current)) return { played, stopped: true, failed: false };
      } else if (step.join !== "crossfade") {
        release(carry);
        carry = null;
      }
      let player;
      try {
        player = openPlayer(source);
      } catch {
        release(carry);
        return { played, stopped: false, failed: true };
      }
      played += 1;
      traceNavVoice("clip.open", { index, id: step.id });
      const next = steps[index + 1];
      const cross = next?.join === "crossfade" && ukVoiceSources[next.id] != null;
      const mark = await watch(player, current, cross ? CLIP_CROSSFADE_MS / 1000 : 0.01);
      if (mark === "stopped" || !current()) {
        release(player);
        release(carry);
        return { played, stopped: true, failed: false };
      }
      if (cross && mark === "near") {
        release(carry);
        carry = player;
      } else {
        release(carry);
        release(player);
        carry = null;
      }
    }
    return { played, stopped: !current(), failed: false };
  } finally {
    release(carry);
    if (configured) {
      traceNavVoice("clip.release", { interruption: "mixWithOthers", deactivate: true, played });
      try { await setAudioModeAsync(UK_CLIP_RELEASE_MODE); } catch {}
      // Navigation SDK voice does not resume while this session stays active.
      try { await setIsAudioActiveAsync(false); } catch {}
    }
  }
}
