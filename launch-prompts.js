// Launch counters only decide whether to offer a screen. They do not call
// StoreKit and they do not start a trial. A trial starts only after Apple
// confirms the subscription. The system may also decline to show its review
// dialog; this module does not promise that the system window appears.

export const PREMIUM_PROMPT_LAUNCH = 5;
export const REVIEW_PROMPT_LAUNCH = 10;
export const LAUNCH_COUNT_KEY = "camalert_successful_launches_v1";
export const PREMIUM_PROMPT_KEY = "camalert_premium_prompt_v1";
export const REVIEW_PROMPT_KEY = "camalert_review_prompt_v1";

export function recordSuccessfulLaunch(previous) {
  const count = Number(previous);
  if (!Number.isInteger(count) || count < 0) return 1;
  return count + 1;
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
