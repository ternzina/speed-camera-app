import { PREMIUM_PLANS } from "./premium-catalog.js";

// CamAlert 1.0.5 on sale, and iOS 1.0.6 build 49 waiting for review, already
// give navigation and camera warnings without a purchase. Enforcement stays
// off until that restriction is an explicit decision. Turning it on here
// would take those features away.
export const PREMIUM_ENFORCEMENT = false;

const PLAN_IDS = new Set(PREMIUM_PLANS.map(plan => plan.id));
const YEARLY_ID = "camalert_premium_yearly";

export function knownPlan(productId) {
  return PREMIUM_PLANS.find(plan => plan.id === productId) || null;
}

export function premiumAllows(entitlement, now, enforcement = PREMIUM_ENFORCEMENT) {
  if (enforcement !== true) return { allowed: true, reason: "published-rights" };
  if (!entitlement || !PLAN_IDS.has(entitlement.productId)) return { allowed: false, reason: "none" };
  if (entitlement.revoked === true) return { allowed: false, reason: "revoked" };
  if (entitlement.period === "lifetime") return { allowed: true, reason: "lifetime" };
  const expires = Number(entitlement.expiresAt);
  if (Number.isFinite(expires) && expires > now) {
    return { allowed: true, reason: entitlement.trial === true ? "trial" : "active" };
  }
  return { allowed: false, reason: "expired" };
}

export function canStartTrial({ productId, storeEligible, trialAlreadyUsed }) {
  const plan = knownPlan(productId);
  if (!plan || plan.trialDays <= 0) return false;
  return storeEligible === true && trialAlreadyUsed !== true;
}

// The store charges on renewal. This only describes the date the store gave.
export function renewalDescription({ productId, trial, renewsAt, cancelled }) {
  const plan = knownPlan(productId);
  if (!plan || plan.period === "lifetime") return { renews: false, renewsAt: null };
  if (cancelled === true) return { renews: false, renewsAt: Number.isFinite(Number(renewsAt)) ? Number(renewsAt) : null };
  return {
    renews: true,
    renewsAt: Number.isFinite(Number(renewsAt)) ? Number(renewsAt) : null,
    trial: trial === true && plan.id === YEARLY_ID,
  };
}

export function chooseRestoredEntitlement(records, now) {
  const list = Array.isArray(records) ? records.filter(item => knownPlan(item?.productId)) : [];
  const lifetime = list.find(item => item.period === "lifetime" && item.revoked !== true);
  if (lifetime) return lifetime;
  const living = list.filter(item => premiumAllows(item, now, true).allowed);
  living.sort((a, b) => Number(b.expiresAt) - Number(a.expiresAt));
  return living[0] || null;
}

export function entitlementWithoutNetwork(cache, now) {
  if (!cache || cache.verified !== true) return { allowed: false, reason: "offline-unknown", entitlement: null };
  const decision = premiumAllows(cache.entitlement, now, true);
  if (!decision.allowed) return { allowed: false, reason: "offline-expired", entitlement: cache.entitlement };
  return { allowed: true, reason: "offline-cache", entitlement: cache.entitlement };
}

export function applyPlanChange(current, next, now) {
  const plan = knownPlan(next?.productId);
  if (!plan) return current || null;
  const trialUsed = current?.trial === true || current?.trialAlreadyUsed === true || next.trial === true;
  const replacement = {
    productId: plan.id,
    period: plan.period,
    expiresAt: plan.period === "lifetime" ? null : next.expiresAt,
    trial: next.trial === true && canStartTrial({
      productId: plan.id,
      storeEligible: next.storeEligible !== false,
      trialAlreadyUsed: current?.trial === true || current?.trialAlreadyUsed === true,
    }),
    trialAlreadyUsed: trialUsed,
    revoked: false,
  };
  if (plan.period !== "lifetime" && !(Number(replacement.expiresAt) > now) && replacement.trial !== true) {
    return { ...replacement, expiresAt: next.expiresAt };
  }
  return replacement;
}
