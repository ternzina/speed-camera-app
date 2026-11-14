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

// 1.0.6 is the last version already on sale. A person whose first App Store
// download is this version or older already has the published access.
export const PUBLISHED_RIGHTS_VERSION = "1.0.6";

function versionParts(version) {
  if (typeof version !== "string") return null;
  const parts = version.trim().split(".");
  if (parts.length < 3) return null;
  const nums = parts.slice(0, 3).map(part => (/^\d+$/.test(part) ? Number(part) : NaN));
  if (nums.some(part => !Number.isFinite(part))) return null;
  return nums;
}

// "1.0" is what StoreKit sandbox always reports, so it is not evidence.
// A missing or unreadable version is not evidence either.
export function legacyFromOriginalVersion(version, ceiling = PUBLISHED_RIGHTS_VERSION) {
  const got = versionParts(version);
  const cap = versionParts(ceiling);
  if (!got || !cap) return null;
  for (let i = 0; i < 3; i += 1) {
    if (got[i] < cap[i]) return true;
    if (got[i] > cap[i]) return false;
  }
  return true;
}

export function resolveLegacy({ stored, priorLocal, originalVersion } = {}) {
  if (stored === true || stored === "yes" || priorLocal === true) return true;
  return legacyFromOriginalVersion(originalVersion);
}

export function accessWithLegacy({ legacy, entitlement, now, enforcement = PREMIUM_ENFORCEMENT }) {
  if (enforcement !== true) return { allowed: true, reason: "published-rights" };
  if (legacy === true) return { allowed: true, reason: "legacy" };
  if (legacy == null) return { allowed: true, reason: "unconfirmed" };
  return premiumAllows(entitlement, now, true);
}

export function entitlementFromStore(row) {
  const plan = knownPlan(row?.productId);
  if (!plan) return null;
  const entitlement = {
    productId: plan.id,
    period: row?.period || plan.period,
    expiresAt: (row?.period || plan.period) === "lifetime" ? null : Number(row.expiresAt),
    trial: row.trial === true && plan.trialDays > 0,
    revoked: row.revoked === true,
  };
  if (row?.willAutoRenew === true || row?.willAutoRenew === false) entitlement.willAutoRenew = row.willAutoRenew;
  if (typeof row?.displayPrice === "string" && row.displayPrice.trim()) entitlement.displayPrice = row.displayPrice.trim();
  if (typeof row?.renewalState === "string" && row.renewalState) entitlement.renewalState = row.renewalState;
  if (Number.isFinite(Number(row?.purchaseDate))) entitlement.purchaseDate = Number(row.purchaseDate);
  if (row?.environment === "sandbox" || row?.environment === "production") entitlement.environment = row.environment;
  return entitlement;
}

// Status comes only from fields the store already verified. A missing date
// or a missing renewal flag is left unknown instead of being filled in.
export function subscriptionStatus(entitlement, now = Date.now()) {
  if (!entitlement || !knownPlan(entitlement.productId)) return null;
  if (entitlement.revoked === true || entitlement.renewalState === "revoked") return { code: "revoked" };
  if (entitlement.period === "lifetime") return { code: "lifetime" };
  const expires = Number(entitlement.expiresAt);
  if (!Number.isFinite(expires)) return null;
  if (expires <= now || entitlement.renewalState === "expired") return { code: "expired", endsAt: expires };
  if (entitlement.trial === true) return { code: "trial", endsAt: expires };
  if (entitlement.willAutoRenew === false) return { code: "renewal-cancelled", endsAt: expires };
  if (entitlement.willAutoRenew === true) return { code: "active", renewsAt: expires };
  return { code: "active", endsAt: expires };
}

export function restoreOutcome(decision, now = Date.now()) {
  if (!decision || decision.verified !== true) return { code: "failed" };
  const status = subscriptionStatus(decision.entitlement, now);
  if (!status || status.code === "expired" || status.code === "revoked") return { code: "none" };
  return { code: "restored", status, entitlement: decision.entitlement };
}

// A purchase counts only after StoreKit reports the transaction as verified.
// That verification is Apple's signed transaction. Refunds arrive as revoked.
export function acceptVerifiedPurchase(result, now) {
  if (!result || result.status !== "verified") {
    return { verified: false, reason: result?.status || "unverified", entitlement: null };
  }
  const entitlement = entitlementFromStore(result);
  if (!entitlement) return { verified: false, reason: "unknown-product", entitlement: null };
  if (entitlement.revoked) return { verified: true, reason: "revoked", entitlement };
  return { verified: true, reason: premiumAllows(entitlement, now, true).reason, entitlement };
}

function offerSignature(row) {
  if (!row || row.revoked === true || !row.productId) return null;
  const expires = Number.isFinite(Number(row.expiresAt)) ? Number(row.expiresAt) : "";
  return [row.productId, row.period || "", expires, row.trial === true ? "trial" : ""].join("|");
}

// The system sheet does not say whether a code was accepted.
// A result is reliable only when the verified purchases before and after can be compared.
export function offerRedemptionResult({ presented, before, after } = {}) {
  if (presented !== true) return { code: "unavailable" };
  if (!Array.isArray(after)) return { code: "failed" };
  if (!Array.isArray(before)) return { code: "uncompared" };
  const seen = new Set(before.map(offerSignature).filter(Boolean));
  const added = after.filter(row => {
    const signature = offerSignature(row);
    return signature && !seen.has(signature);
  });
  if (!added.length) return { code: "unchanged" };
  return { code: "confirmed", added };
}

export function acceptRestored(rows, now) {
  const list = (Array.isArray(rows) ? rows : []).map(entitlementFromStore).filter(Boolean);
  const entitlement = chooseRestoredEntitlement(list, now);
  if (!entitlement) return { verified: true, reason: "none", entitlement: null };
  return { verified: true, reason: premiumAllows(entitlement, now, true).reason, entitlement };
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
