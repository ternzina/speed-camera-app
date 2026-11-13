// Prices here are the amounts to enter in App Store Connect and Google Play
// Console for the United States. The phone must show the price the store
// returns for the signed-in country. These strings are not a display price.
export const PREMIUM_GROUP_NAME = "CamAlert Premium";

export const PREMIUM_PLANS = [
  {
    id: "camalert_premium_weekly",
    period: "week",
    kind: "subscription",
    trialDays: 0,
    consoleUsd: "1.49",
    existingAscProduct: false,
  },
  {
    id: "camalert_premium_monthly",
    period: "month",
    kind: "subscription",
    trialDays: 0,
    consoleUsd: "3.49",
    existingAscProduct: true,
  },
  {
    id: "camalert_premium_yearly",
    period: "year",
    kind: "subscription",
    trialDays: 3,
    consoleUsd: "27.99",
    existingAscProduct: true,
    highlighted: true,
  },
  {
    id: "camalert_premium_lifetime",
    period: "lifetime",
    kind: "non-consumable",
    trialDays: 0,
    consoleUsd: "44.99",
    existingAscProduct: false,
  },
];

export function storePriceLabel(value) {
  const label = typeof value === "string" ? value.trim() : "";
  return label || null;
}
