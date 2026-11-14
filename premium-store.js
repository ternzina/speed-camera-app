import { Linking, NativeModules, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { acceptRestored, acceptVerifiedPurchase, entitlementFromStore, resolveLegacy } from "./premium-access.js";

const LEGACY_KEY = "camalert_legacy_access_v1";
const CACHE_KEY = "camalert_premium_verified_v1";
const PRIOR_KEYS = ["camalert_onboarding_v1", "camera_history_v060"];
export const APP_STORE_REVIEW_URL = "https://apps.apple.com/app/id6818647205?action=write-review";

// Local keys disappear on reinstall. A "no" saved from their absence would
// then block someone whose earlier access can no longer be seen. Only a
// positive record is kept, in storage and in the iOS keychain. The keychain
// and the App Store original version survive reinstall. When neither says
// anything reliable, the result is unknown and access stays open.
export async function rememberLegacy(storage = AsyncStorage) {
  const saved = await storage.getItem(LEGACY_KEY);
  if (saved === "no") await storage.removeItem(LEGACY_KEY);
  let prior = false;
  for (const key of PRIOR_KEYS) {
    const value = await storage.getItem(key);
    if (value) {
      prior = true;
      break;
    }
  }
  const native = storeModule();
  let keychain = null;
  let originalVersion = null;
  if (native?.legacyEvidence) {
    try {
      const evidence = await native.legacyEvidence();
      keychain = evidence?.keychain || null;
      originalVersion = evidence?.originalVersion || null;
    } catch {
      keychain = null;
      originalVersion = null;
    }
  }
  const decision = resolveLegacy({
    stored: saved === "yes" || keychain === "yes",
    priorLocal: prior,
    originalVersion,
  });
  if (decision === true) {
    await storage.setItem(LEGACY_KEY, "yes");
    if (native?.rememberLegacyYes) {
      try { await native.rememberLegacyYes(); } catch { /* the positive local record still stands */ }
    }
  }
  return decision;
}

function storeModule() {
  if (Platform.OS !== "ios") return null;
  return NativeModules.CamAlertPremiumStore || null;
}

export async function readCachedEntitlement(storage = AsyncStorage) {
  const raw = await storage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.verified === true ? parsed.entitlement || null : null;
  } catch {
    return null;
  }
}

export async function loadPremiumCatalog() {
  const native = storeModule();
  const prices = {};
  const introEligible = {};
  if (!native?.loadProducts) return { prices, introEligible };
  const rows = await native.loadProducts();
  for (const row of rows || []) {
    if (!row?.id) continue;
    if (row.displayPrice) prices[row.id] = row.displayPrice;
    if (row.introEligible === true) introEligible[row.id] = true;
  }
  return { prices, introEligible };
}

export async function loadPremiumPrices() {
  const catalog = await loadPremiumCatalog();
  return catalog.prices;
}

// The settings row opens the App Store review page itself.
// It does not report that a review was sent.
export function openAppStoreReview() {
  return Linking.openURL(APP_STORE_REVIEW_URL);
}

// The automatic offer may ask the system. Apple may decline to show it.
// This function does not report success. The store page is used only when
// the request cannot be made.
export async function requestAppReview() {
  const native = storeModule();
  if (native?.requestReview) {
    try {
      const asked = await native.requestReview();
      if (asked === true || asked === 1) return "system";
    } catch {
      /* the store page is the fallback */
    }
  }
  await Linking.openURL(APP_STORE_REVIEW_URL);
  return "store";
}

async function saveVerified(storage, decision, now) {
  if (!decision.verified) return;
  await storage.setItem(CACHE_KEY, JSON.stringify({
    verified: true,
    entitlement: decision.entitlement,
    at: now,
  }));
}

export async function cacheVerifiedEntitlement(entitlement, storage = AsyncStorage, now = Date.now()) {
  if (!entitlement) {
    await storage.removeItem(CACHE_KEY);
    return;
  }
  await storage.setItem(CACHE_KEY, JSON.stringify({ verified: true, entitlement, at: now }));
}

// Opens Apple's offer-code sheet. This app does not read or check the code.
export async function presentOfferCodeSheet() {
  const native = storeModule();
  if (!native?.presentOfferCode) return false;
  try {
    const presented = await native.presentOfferCode();
    return presented === true || presented === 1;
  } catch {
    return false;
  }
}

export async function refreshPremiumEntitlements() {
  const native = storeModule();
  if (!native?.refresh) return null;
  try {
    const rows = await native.refresh();
    if (!Array.isArray(rows)) return null;
    return rows.map(entitlementFromStore).filter(Boolean);
  } catch {
    return null;
  }
}

export async function purchasePremium(productId, now = Date.now(), storage = AsyncStorage) {
  const native = storeModule();
  if (!native?.purchase) return { verified: false, reason: "store-unavailable", entitlement: null };
  const raw = await native.purchase(productId);
  const decision = acceptVerifiedPurchase(raw, now);
  await saveVerified(storage, decision, now);
  return decision;
}

export async function restorePremium(now = Date.now(), storage = AsyncStorage) {
  const native = storeModule();
  if (!native?.restore) return { verified: false, reason: "failed", entitlement: null };
  let rows;
  try {
    rows = await native.restore();
  } catch {
    return { verified: false, reason: "failed", entitlement: null };
  }
  if (Array.isArray(rows) && rows[0]?.status === "failed") {
    return { verified: false, reason: "failed", entitlement: null };
  }
  const decision = acceptRestored(rows, now);
  await saveVerified(storage, decision, now);
  return decision;
}
