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

function moneyParts(value) {
  const label = storePriceLabel(value);
  if (!label) return null;
  const match = label.match(/\d[\d\s.,]*\d|\d/);
  if (!match) return null;
  const raw = match[0].replace(/\s/g, "");
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  let normalized = raw;
  if (comma > dot) normalized = raw.replace(/\./g, "").replace(",", ".");
  else normalized = raw.replace(/,/g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, marker: label.replace(match[0], "").replace(/\s/g, "") };
}

// The badge is the yearly store price set against 52 weekly store prices.
// Twelve monthly prices are used only when the weekly label is missing.
// A fixed 60 is never invented: the percent is this comparison, or nothing.
export function yearlySavingsPercent(prices) {
  const year = moneyParts(prices?.camalert_premium_yearly);
  const week = moneyParts(prices?.camalert_premium_weekly);
  const month = moneyParts(prices?.camalert_premium_monthly);
  if (!year) return null;
  const base = week && week.marker === year.marker
    ? week.amount * 52
    : month && month.marker === year.marker
      ? month.amount * 12
      : null;
  if (!base || base <= year.amount) return null;
  const percent = Math.round((1 - year.amount / base) * 100);
  if (percent < 1 || percent > 99) return null;
  return percent;
}
