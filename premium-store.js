import { NativeModules, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { acceptRestored, acceptVerifiedPurchase, resolveLegacy } from "./premium-access.js";

const LEGACY_KEY = "camalert_legacy_access_v1";
const CACHE_KEY = "camalert_premium_verified_v1";
const PRIOR_KEYS = ["camalert_onboarding_v1", "camera_history_v060"];

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

export async function loadPremiumPrices() {
  const native = storeModule();
  if (!native?.loadProducts) return {};
  const rows = await native.loadProducts();
  const prices = {};
  for (const row of rows || []) {
    if (row?.id && row.displayPrice) prices[row.id] = row.displayPrice;
  }
  return prices;
}

async function saveVerified(storage, decision, now) {
  if (!decision.verified) return;
  await storage.setItem(CACHE_KEY, JSON.stringify({
    verified: true,
    entitlement: decision.entitlement,
    at: now,
  }));
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
  if (!native?.restore) return { verified: false, reason: "store-unavailable", entitlement: null };
  const rows = await native.restore();
  const decision = acceptRestored(rows, now);
  await saveVerified(storage, decision, now);
  return decision;
}
