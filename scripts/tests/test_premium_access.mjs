import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { PREMIUM_PLANS, storePriceLabel } from "../../premium-catalog.js";
import {
  PREMIUM_ENFORCEMENT,
  applyPlanChange,
  canStartTrial,
  chooseRestoredEntitlement,
  entitlementWithoutNetwork,
  premiumAllows,
  renewalDescription,
} from "../../premium-access.js";
import { PREMIUM_COPY } from "../../premium-copy.js";

const now = Date.parse("2026-11-13T18:00:00Z");
const week = 7 * 24 * 60 * 60 * 1000;
const read = name => fs.readFileSync(new URL(`../../${name}`, import.meta.url), "utf8");

test("published rights stay available while enforcement is off", () => {
  assert.equal(PREMIUM_ENFORCEMENT, false);
  assert.equal(premiumAllows(null, now).reason, "published-rights");
  assert.equal(premiumAllows(null, now).allowed, true);
  assert.doesNotMatch(read("App.js"), /premium-screen|PREMIUM_ENFORCEMENT|premiumAllows/);
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
  assert.doesNotMatch(read("App.js"), /premium-manage-screen|CamAlertPremiumStore/);
  const store = read("ios/CamAlert/CamAlertPremiumStore.swift");
  assert.match(store, /Product\.products/);
  assert.match(store, /product\.purchase/);
  assert.match(store, /Transaction\.currentEntitlements/);
  assert.doesNotMatch(store, /1\.49|3\.49|27\.99|44\.99/);
});
