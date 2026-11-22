// Location permission is read again when the app becomes active, so the
// background switch can show «Всегда» immediately. The speech synthesizer and
// the navigation session are created once per process. Opening iPhone Settings
// interrupts them, and a cold start was the only path that built new ones.
// This decides what may be refreshed. It never speaks and never adds a second
// GPS watch: an existing foreground watch is replaced, and Google's already
// running road-snapped provider is restarted only while guidance is active.
export function resumeAfterAuthorization({
  previousAccess = "missing",
  nextAccess = "missing",
  foregroundWatchActive = false,
  guiding = false,
} = {}) {
  const changed = previousAccess !== nextAccess;
  const granted = nextAccess === "always" || nextAccess === "when-in-use";
  const refresh = changed && granted;
  return {
    replaceForegroundWatch: refresh && foregroundWatchActive === true,
    restartRoadSnappedLocation: refresh && guiding === true,
    speak: false,
  };
}

// A location change counts only after a real previous answer, or after the
// navigator already exists. The first reading on launch is not a change.
export function locationPermissionDisruption({ previous, next, navigatorReady = false } = {}) {
  if (previous === next) return false;
  if (navigatorReady === true) return true;
  return previous === "always" || previous === "when-in-use" || previous === "denied";
}

// Recreate only before the next «В путь», and never while guidance is running.
// Returning from the background is not itself a reason.
export function prepareNavigatorForGuidance({
  disruption = false,
  guiding = false,
  navigatorReady = false,
  cleanNavigator = false,
} = {}) {
  if (!disruption || guiding) return { replace: false, discardFreshSession: false };
  const trusted = cleanNavigator === true && navigatorReady === true;
  return { replace: true, discardFreshSession: !trusted };
}
