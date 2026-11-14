// Launch counters only decide whether to offer a screen. They do not call
// StoreKit and they do not start a trial. A trial starts only after Apple
// confirms the subscription. The system may also decline to show its review
// dialog; this module does not promise that the system window appears.

export const PREMIUM_PROMPT_LAUNCH = 5;
export const REVIEW_PROMPT_LAUNCH = 10;
export const LAUNCH_COUNT_KEY = "camalert_successful_launches_v1";
export const PREMIUM_PROMPT_KEY = "camalert_premium_prompt_v1";
export const REVIEW_PROMPT_KEY = "camalert_review_prompt_v1";
export const COMPLETED_TRIP_KEY = "camalert_completed_trips_v1";
export const TRIP_PREMIUM_KEY = "camalert_trip_premium_prompt_v1";
export const TRIP_REVIEW_KEY = "camalert_trip_review_prompt_v1";

export function recordSuccessfulLaunch(previous) {
  const count = Number(previous);
  if (!Number.isInteger(count) || count < 0) return 1;
  return count + 1;
}

export function recordCompletedTrip(previous) {
  const count = Number(previous);
  if (!Number.isInteger(count) || count < 0) return 1;
  return count + 1;
}

// A drawn route is not a finished drive. The counter moves only after
// guidance has started and the person then ends that drive.
export function shouldCountTrip({ guidanceStarted = false, endedTrip = false } = {}) {
  return guidanceStarted === true && endedTrip === true;
}

function wholeCount(value) {
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 ? count : 0;
}

// Launch counters stay as they are. Finished drives are a second counter.
// One card is chosen. A drive in progress or an open navigation screen
// hides it. A decline stays declined for both counters of that card.
export function offerDecision({
  launches = 0,
  trips = 0,
  launchPremiumSettled = false,
  launchReviewSettled = false,
  tripPremiumSettled = false,
  tripReviewSettled = false,
  hasPremium = false,
  moving = false,
  navigationOpen = false,
  blocked = false,
} = {}) {
  const launchCount = wholeCount(launches);
  const tripCount = wholeCount(trips);
  const paid = hasPremium === true;
  const hide = moving === true ? "moving" : navigationOpen === true ? "navigation" : blocked === true ? "blocked" : null;
  const launchPremiumDue = launchCount >= PREMIUM_PROMPT_LAUNCH && launchPremiumSettled !== true && !paid;
  const tripPremiumDue = tripCount >= PREMIUM_PROMPT_LAUNCH && tripPremiumSettled !== true && !paid;
  const launchReviewDue = launchCount >= REVIEW_PROMPT_LAUNCH && launchReviewSettled !== true;
  const tripReviewDue = tripCount >= REVIEW_PROMPT_LAUNCH && tripReviewSettled !== true;
  let kind = null;
  if (!hide) {
    if (launchPremiumDue || tripPremiumDue) kind = "premium";
    else if (launchReviewDue || tripReviewDue) kind = "review";
  }
  return {
    kind,
    hide,
    launches: launchCount,
    trips: tripCount,
    hasPremium: paid,
    launchPremiumDue,
    tripPremiumDue,
    launchReviewDue,
    tripReviewDue,
  };
}

export function hasPaidPremium(entitlement, now = Date.now()) {
  if (!entitlement || entitlement.revoked === true) return false;
  if (entitlement.period === "lifetime") return true;
  const expires = Number(entitlement.expiresAt);
  return Number.isFinite(expires) && expires > now;
}

// A stored "later" is a decline and stays settled. A stored launch number means
// the offer was already displayed on that launch, so a later launch does not
// repeat it. The same launch can show it again after a trip or a dialog ends.
export function promptSettled(stored, launches) {
  if (stored === "later") return true;
  const shown = Number(stored);
  const count = Number(launches);
  return Number.isInteger(shown) && shown > 0 && Number.isFinite(count) && shown < count;
}

// Premium is offered from the 5th launch. Review is offered from the 10th
// launch and waits until the premium offer is no longer pending. Nothing is
// shown during a trip or over a dialog.
export function chooseLaunchPrompt({
  launches,
  premiumDismissed = false,
  reviewDismissed = false,
  hasPremium = false,
  navigating = false,
  blocked = false,
} = {}) {
  const count = Number(launches);
  if (!Number.isFinite(count) || navigating || blocked) return null;
  if (count >= PREMIUM_PROMPT_LAUNCH && premiumDismissed !== true && hasPremium !== true) {
    return "premium";
  }
  if (count >= REVIEW_PROMPT_LAUNCH && reviewDismissed !== true) return "review";
  return null;
}
