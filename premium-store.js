import { NativeModules, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { acceptRestored, acceptVerifiedPurchase } from "./premium-access.js";

const LEGACY_KEY = "camalert_legacy_access_v1";
const CACHE_KEY = "camalert_premium_verified_v1";
const PRIOR_KEYS = ["camalert_onboarding_v1", "camera_history_v060"];

export async function rememberLegacy(storage = AsyncStorage) {
  const saved = await storage.getItem(LEGACY_KEY);
  if (saved === "yes" || saved === "no") return saved === "yes";
  let prior = false;
  for (const key of PRIOR_KEYS) {
    const value = await storage.getItem(key);
    if (value) {
      prior = true;
      break;
    }
  }
  await storage.setItem(LEGACY_KEY, prior ? "yes" : "no");
  return prior;
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
