import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { PREMIUM_PLANS, storePriceLabel } from "../../premium-catalog.js";
import {
  PREMIUM_ENFORCEMENT,
  acceptRestored,
  acceptVerifiedPurchase,
  accessWithLegacy,
  applyPlanChange,
  canStartTrial,
  chooseRestoredEntitlement,
  entitlementFromStore,
  entitlementWithoutNetwork,
  legacyFromOriginalVersion,
  premiumAllows,
  renewalDescription,
  resolveLegacy,
  restoreOutcome,
  subscriptionStatus,
} from "../../premium-access.js";
import { PREMIUM_COPY, selectedPlanTerms } from "../../premium-copy.js";
import { chooseLaunchPrompt, hasPaidPremium, offerDecision, promptSettled, recordCompletedTrip, recordSuccessfulLaunch, shouldCountTrip } from "../../launch-prompts.js";

const now = Date.parse("2026-11-13T18:00:00Z");
const week = 7 * 24 * 60 * 60 * 1000;
const read = name => fs.readFileSync(new URL(`../../${name}`, import.meta.url), "utf8");

test("published rights stay available while enforcement is off", () => {
  assert.equal(PREMIUM_ENFORCEMENT, false);
  assert.equal(premiumAllows(null, now).reason, "published-rights");
  assert.equal(premiumAllows(null, now).allowed, true);
  assert.match(read("App.js"), /premium-screen/);
  assert.match(read("App.js"), /premium-store/);
  assert.doesNotMatch(read("App.js"), /PREMIUM_ENFORCEMENT\s*=\s*true/);
  assert.doesNotMatch(read("App.js"), /premiumAllows\(/);
  assert.doesNotMatch(read("premium-screen.js"), /\$\d|consoleUsd/);
});

test("a store price is required and a fixed dollar string is not invented", () => {
  assert.equal(storePriceLabel(""), null);
  assert.equal(storePriceLabel("  "), null);
  assert.equal(storePriceLabel("3,49 zł"), "3,49 zł");
  assert.equal(PREMIUM_PLANS.filter(plan => plan.trialDays > 0).map(plan => plan.id).join(), "camalert_premium_yearly");
  assert.equal(PREMIUM_PLANS.find(plan => plan.id === "camalert_premium_yearly").trialDays, 3);
});

test("the first yearly trial can start once and a second one cannot", () => {
  assert.equal(canStartTrial({ productId: "camalert_premium_yearly", storeEligible: true, trialAlreadyUsed: false }), true);
  assert.equal(canStartTrial({ productId: "camalert_premium_yearly", storeEligible: true, trialAlreadyUsed: true }), false);
  assert.equal(canStartTrial({ productId: "camalert_premium_yearly", storeEligible: false, trialAlreadyUsed: false }), false);
  assert.equal(canStartTrial({ productId: "camalert_premium_monthly", storeEligible: true, trialAlreadyUsed: false }), false);
});

test("an active subscription, a cancellation, and an expiry", () => {
  const active = { productId: "camalert_premium_monthly", period: "month", expiresAt: now + week };
  assert.equal(premiumAllows(active, now, true).reason, "active");
  const trial = { productId: "camalert_premium_yearly", period: "year", expiresAt: now + 3 * 24 * 60 * 60 * 1000, trial: true };
  assert.equal(premiumAllows(trial, now, true).reason, "trial");
  assert.equal(renewalDescription({ productId: "camalert_premium_yearly", trial: true, renewsAt: trial.expiresAt, cancelled: false }).renews, true);
  assert.equal(renewalDescription({ productId: "camalert_premium_yearly", renewsAt: trial.expiresAt, cancelled: true }).renews, false);
  assert.equal(premiumAllows({ ...active, expiresAt: now - 1 }, now, true).reason, "expired");
  assert.equal(premiumAllows({ ...active, revoked: true }, now, true).reason, "revoked");
});

test("lifetime does not expire and restore prefers it", () => {
  const life = { productId: "camalert_premium_lifetime", period: "lifetime" };
  assert.equal(premiumAllows(life, now + 10 * 365 * 24 * 60 * 60 * 1000, true).reason, "lifetime");
  const monthly = { productId: "camalert_premium_monthly", period: "month", expiresAt: now + week };
  assert.equal(chooseRestoredEntitlement([monthly, life], now).productId, "camalert_premium_lifetime");
  assert.equal(chooseRestoredEntitlement([monthly, { ...life, revoked: true }], now).productId, "camalert_premium_monthly");
  assert.equal(chooseRestoredEntitlement([{ ...monthly, expiresAt: now - 1 }], now), null);
});

test("a plan change keeps the earlier trial from starting again", () => {
  const current = { productId: "camalert_premium_yearly", period: "year", expiresAt: now + week, trial: true };
  const next = applyPlanChange(current, {
    productId: "camalert_premium_monthly",
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
    trial: true,
    storeEligible: true,
  }, now);
  assert.equal(next.productId, "camalert_premium_monthly");
  assert.equal(next.trial, false);
  assert.equal(next.trialAlreadyUsed, true);
});

test("offline access follows the last verified entitlement", () => {
  const life = { productId: "camalert_premium_lifetime", period: "lifetime" };
  assert.equal(entitlementWithoutNetwork({ verified: true, entitlement: life }, now).reason, "offline-cache");
  const active = { productId: "camalert_premium_weekly", period: "week", expiresAt: now + week };
  assert.equal(entitlementWithoutNetwork({ verified: true, entitlement: active }, now).allowed, true);
  assert.equal(entitlementWithoutNetwork({ verified: true, entitlement: { ...active, expiresAt: now - 1 } }, now).reason, "offline-expired");
  assert.equal(entitlementWithoutNetwork(null, now).reason, "offline-unknown");
});

test("legacy access stays when enforcement is on, and published access stays while it is off", () => {
  assert.equal(accessWithLegacy({ legacy: false, entitlement: null, now, enforcement: false }).reason, "published-rights");
  assert.equal(accessWithLegacy({ legacy: true, entitlement: null, now, enforcement: true }).reason, "legacy");
  assert.equal(accessWithLegacy({ legacy: null, entitlement: null, now, enforcement: true }).reason, "unconfirmed");
  assert.equal(accessWithLegacy({ legacy: null, entitlement: null, now, enforcement: true }).allowed, true);
  const life = { productId: "camalert_premium_lifetime", period: "lifetime", revoked: false };
  assert.equal(accessWithLegacy({ legacy: false, entitlement: life, now, enforcement: true }).reason, "lifetime");
  assert.equal(accessWithLegacy({ legacy: false, entitlement: null, now, enforcement: true }).reason, "none");
});

test("a reinstall without a reliable record is not treated as a new locked user", () => {
  assert.equal(legacyFromOriginalVersion("1.0.6"), true);
  assert.equal(legacyFromOriginalVersion("1.0.3"), true);
  assert.equal(legacyFromOriginalVersion("1.0.7"), false);
  assert.equal(legacyFromOriginalVersion("1.0"), null);
  assert.equal(legacyFromOriginalVersion("49"), null);
  assert.equal(legacyFromOriginalVersion(null), null);
  assert.equal(resolveLegacy({ stored: "yes", priorLocal: false, originalVersion: null }), true);
  assert.equal(resolveLegacy({ stored: "no", priorLocal: true, originalVersion: null }), true);
  assert.equal(resolveLegacy({ stored: "no", priorLocal: false, originalVersion: "1.0.5" }), true);
  assert.equal(resolveLegacy({ stored: "no", priorLocal: false, originalVersion: "1.0" }), null);
  assert.equal(resolveLegacy({ stored: null, priorLocal: false, originalVersion: "1.0.8" }), false);
  const store = read("premium-store.js");
  assert.match(store, /resolveLegacy/);
  assert.match(store, /legacyEvidence/);
  assert.match(store, /rememberLegacyYes/);
  assert.match(store, /removeItem\(LEGACY_KEY\)/);
  assert.doesNotMatch(store, /setItem\(LEGACY_KEY,\s*(prior \? "yes" : "no"|"no")\)/);
  const swift = read("ios/CamAlert/CamAlertPremiumStore.swift");
  assert.match(swift, /AppTransaction\.shared/);
  assert.match(swift, /kSecClassGenericPassword/);
});

test("only a verified store transaction is accepted, and a refund or expiry ends it", () => {
  const active = acceptVerifiedPurchase({
    status: "verified",
    productId: "camalert_premium_monthly",
    expiresAt: now + week,
  }, now);
  assert.equal(active.reason, "active");
  assert.equal(acceptVerifiedPurchase({ status: "unverified", productId: "camalert_premium_monthly" }, now).verified, false);
  assert.equal(acceptVerifiedPurchase({ status: "cancelled" }, now).reason, "cancelled");
  const refunded = acceptVerifiedPurchase({
    status: "verified",
    productId: "camalert_premium_lifetime",
    revoked: true,
  }, now);
  assert.equal(refunded.reason, "revoked");
  const expired = acceptVerifiedPurchase({
    status: "verified",
    productId: "camalert_premium_weekly",
    expiresAt: now - 1,
  }, now);
  assert.equal(expired.reason, "expired");
  const fromStore = entitlementFromStore({ productId: "camalert_premium_yearly", expiresAt: now + week, trial: true });
  assert.equal(fromStore.period, "year");
  assert.equal(fromStore.trial, true);
});

test("restore keeps lifetime and an active subscription, and drops a refunded one", () => {
  const restored = acceptRestored([
    { productId: "camalert_premium_monthly", expiresAt: now + week },
    { productId: "camalert_premium_lifetime", revoked: false },
  ], now);
  assert.equal(restored.entitlement.productId, "camalert_premium_lifetime");
  const refundedLife = acceptRestored([
    { productId: "camalert_premium_lifetime", revoked: true },
    { productId: "camalert_premium_yearly", expiresAt: now - 1 },
  ], now);
  assert.equal(refundedLife.entitlement, null);
  assert.equal(refundedLife.reason, "none");
});

test("the premium screen copy exists in every CamAlert language and names the trial", () => {
  for (const language of ["ru", "uk", "en", "pl"]) {
    const copy = PREMIUM_COPY[language];
    assert.equal(copy.title, "CamAlert Premium");
    assert.equal(copy.benefits.length, 5);
    assert.match(copy.trial, /3/);
    assert.match(copy.continue, /\S/);
    assert.match(copy.restore, /\S/);
    assert.match(copy.trialEnds, /\S/);
    assert.match(copy.afterTrial, /\S/);
  }
  assert.match(read("premium-screen.js"), /camalert_premium_yearly/);
  assert.match(read("premium-screen.js"), /onRestore/);
  assert.match(read("premium-manage-screen.js"), /apps.apple.com\/account\/subscriptions/);
  assert.doesNotMatch(read("premium-manage-screen.js"), /\$\d|consoleUsd/);
  assert.match(read("App.js"), /premium-manage-screen/);
  assert.match(read("premium-store.js"), /CamAlertPremiumStore/);
  assert.match(read("premium-store.js"), /requestReview/);
  assert.doesNotMatch(read("premium-store.js"), /1\.49|3\.49|27\.99|44\.99/);
  assert.match(read("App.js"), /distanceTitle/);
  assert.match(read("App.js"), /coverageOpen/);
  assert.doesNotMatch(read("launch-prompts.js"), /purchase|Product\.purchase/);
  assert.match(read("ios/CamAlert/CamAlertPremiumStore.swift"), /isEligibleForIntroOffer/);
  assert.match(read("ios/CamAlert/CamAlertPremiumStore.swift"), /SKStoreReviewController/);
  const store = read("ios/CamAlert/CamAlertPremiumStore.swift");
  assert.match(store, /Product\.products/);
  assert.match(store, /product\.purchase/);
  assert.match(store, /Transaction\.currentEntitlements/);
  assert.doesNotMatch(store, /1\.49|3\.49|27\.99|44\.99/);
});

test("plan terms name the yearly trial only when the store allows it", () => {
  const copy = PREMIUM_COPY.ru;
  const year = selectedPlanTerms({ period: "year", price: "27,99 USD", trialEligible: true, copy });
  assert.equal(year, "3 дня бесплатно, затем 27,99 USD/год");
  const yearPaid = selectedPlanTerms({ period: "year", price: "27,99 USD", trialEligible: false, copy });
  assert.equal(yearPaid.includes("бесплат"), false);
  const week = selectedPlanTerms({ period: "week", price: "1,49 USD", trialEligible: true, copy });
  assert.equal(week.includes("бесплат"), false);
  assert.equal(selectedPlanTerms({ period: "month", price: "", trialEligible: false, copy }), copy.priceWait);
  assert.equal(copy.distanceTitle, "Настройки дистанции и предупреждений");
  assert.equal(copy.cardSubtitle, "Больше возможностей в каждой поездке");
});

test("the fifth launch offers Premium and does not buy, and a trip hides both prompts", () => {
  assert.equal(recordSuccessfulLaunch(null), 1);
  assert.equal(recordSuccessfulLaunch("4"), 5);
  assert.equal(recordSuccessfulLaunch("9"), 10);
  assert.equal(chooseLaunchPrompt({ launches: 4 }), null);
  assert.equal(chooseLaunchPrompt({ launches: 5 }), "premium");
  assert.equal(chooseLaunchPrompt({ launches: 5, navigating: true }), null);
  assert.equal(chooseLaunchPrompt({ launches: 5, blocked: true }), null);
  assert.equal(chooseLaunchPrompt({ launches: 5, hasPremium: true }), null);
  assert.equal(chooseLaunchPrompt({ launches: 10, premiumDismissed: true }), "review");
  assert.equal(chooseLaunchPrompt({ launches: 10, premiumDismissed: true, reviewDismissed: true }), null);
  assert.equal(chooseLaunchPrompt({ launches: 10, navigating: true, premiumDismissed: true }), null);
  assert.equal(promptSettled("later", 8), true);
  assert.equal(promptSettled("5", 5), false);
  assert.equal(promptSettled("5", 6), true);
  assert.equal(promptSettled(null, 6), false);
  assert.equal(hasPaidPremium({ period: "lifetime" }, now), true);
  assert.equal(hasPaidPremium({ period: "year", expiresAt: now + week }, now), true);
  assert.equal(hasPaidPremium({ period: "year", expiresAt: now - 1 }, now), false);
  assert.equal(hasPaidPremium(null, now), false);
  assert.equal(PREMIUM_ENFORCEMENT, false);
  assert.equal(shouldCountTrip({ guidanceStarted: false, endedTrip: true }), false);
  assert.equal(shouldCountTrip({ guidanceStarted: true, endedTrip: false }), false);
  assert.equal(shouldCountTrip({ guidanceStarted: true, endedTrip: true }), true);
  assert.equal(recordCompletedTrip("4"), 5);
  assert.equal(offerDecision({ launches: 1, trips: 4 }).kind, null);
  assert.equal(offerDecision({ launches: 1, trips: 5 }).kind, "premium");
  assert.equal(offerDecision({ launches: 1, trips: 5, navigationOpen: true }).kind, null);
  assert.equal(offerDecision({ launches: 1, trips: 5, moving: true }).kind, null);
  assert.equal(offerDecision({ launches: 1, trips: 10, tripPremiumSettled: true }).kind, "review");
  assert.equal(offerDecision({ launches: 5, trips: 5 }).kind, "premium");
  assert.equal(offerDecision({ launches: 12, trips: 0, launchPremiumSettled: true }).kind, "review");
  assert.equal(offerDecision({ launches: 12, trips: 0, launchPremiumSettled: true, launchReviewSettled: true }).kind, null);
  assert.equal(offerDecision({ launches: 1, trips: 5, hasPremium: true }).kind, null);
  assert.equal(offerDecision({ launches: 1, trips: 5, tripPremiumSettled: true }).kind, null);
  const activeCancelled = subscriptionStatus({ productId: "camalert_premium_yearly", period: "year", expiresAt: now + week, willAutoRenew: false }, now);
  assert.equal(activeCancelled.code, "renewal-cancelled");
  assert.equal(subscriptionStatus({ productId: "camalert_premium_lifetime", period: "lifetime" }, now).code, "lifetime");
  assert.equal(subscriptionStatus({ productId: "camalert_premium_yearly", period: "year", expiresAt: now - 1 }, now).code, "expired");
  const restored = restoreOutcome({ verified: true, entitlement: { productId: "camalert_premium_yearly", period: "year", expiresAt: now + week, willAutoRenew: false } }, now);
  assert.equal(restored.code, "restored");
  assert.equal(restoreOutcome({ verified: true, reason: "none", entitlement: null }, now).code, "none");
  assert.equal(restoreOutcome({ verified: false, reason: "failed" }, now).code, "failed");
  assert.match(read("App.js"), /openAppStoreReview/);
  assert.match(read("App.js"), /rateSettings/);
  assert.match(read("App.js"), /onCompletedNavigation/);
  assert.match(read("ios/CamAlert/CamAlertPremiumStore.swift"), /Transaction\.updates/);
  assert.match(read("ios/CamAlert/CamAlertPremiumStore.swift"), /AppStore\.sync/);
  assert.match(read("google-nav-test-screen.js"), /backgroundColor: "#FFFFFF"/);
  assert.match(read("google-nav-test-screen.js"), /color: "#10263B"/);
});
