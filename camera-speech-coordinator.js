export function createSpeechCoordinator(engine, schedule = setTimeout, cancel = clearTimeout) {
  const listeners = new Set();
  let speaking = false, sequence = 0, timer, clipStop = () => {};
  const publish = value => { speaking = value; for (const listener of listeners) listener(value); };
  const finish = id => {
    if (id !== sequence) return;
    cancel(timer); timer = undefined; publish(false);
  };
  return {
    subscribe(listener) { listeners.add(listener); listener(speaking); return () => listeners.delete(listener); },
    isSpeakingAsync: () => speaking ? Promise.resolve(true) : engine.isSpeakingAsync(),
    bindClipStop(fn) { clipStop = typeof fn === "function" ? fn : () => {}; },
    // Local clips and system TTS share one generation so a newer warning
    // cancels a queued one, and Google stays silent for the whole clip.
    beginClip() {
      const id = ++sequence;
      cancel(timer); timer = undefined;
      try { clipStop(); } catch {}
      try { engine.stop(); } catch {}
      publish(true);
      return { current: () => id === sequence, end: () => finish(id) };
    },
    stop() {
      const id = ++sequence;
      cancel(timer);
      try { clipStop(); } catch {}
      return Promise.resolve(engine.stop()).finally(() => finish(id));
    },
    speak(text, options = {}) {
      const id = ++sequence;
      cancel(timer); publish(true);
      // Release Google even if an Android TTS engine never returns a callback.
      timer = schedule(() => finish(id), 30000);
      const complete = name => (...args) => { finish(id); options[name]?.(...args); };
      try {
        engine.speak(text, { ...options, onDone: complete('onDone'), onStopped: complete('onStopped'), onError: complete('onError') });
      } catch (error) { finish(id); throw error; }
    },
  };
}
