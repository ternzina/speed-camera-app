import { formatDistance } from "./route-guidance.js";

const CAPTIONS = {
  ru: ["Расстояние", "В пути", "Прибытие"],
  uk: ["Відстань", "В дорозі", "Прибуття"],
  en: ["Distance", "Driving", "Arrival"],
  pl: ["Dystans", "W trasie", "Przyjazd"],
};

const TRANSIT = {
  ru: { h: "ч", m: "мин" },
  uk: { h: "год", m: "хв" },
  en: { h: "h", m: "min" },
  pl: { h: "godz.", m: "min" },
};

export function formatClock(etaSeconds, nowMs = Date.now()) {
  if (!Number.isFinite(etaSeconds) || etaSeconds < 0) return "—";
  const arrival = new Date(nowMs + etaSeconds * 1000);
  return `${String(arrival.getHours()).padStart(2, "0")}:${String(arrival.getMinutes()).padStart(2, "0")}`;
}

export function formatTransit(language, seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const units = TRANSIT[language] || TRANSIT.ru;
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${totalMinutes} ${units.m}`;
  if (minutes === 0) return `${hours} ${units.h}`;
  return `${hours} ${units.h} ${minutes} ${units.m}`;
}

function shownDistance(language, meters) {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  if (meters >= 1000) {
    const kilometers = meters / 1000;
    const digits = kilometers >= 100 ? 0 : 1;
    const text = kilometers.toFixed(digits);
    const unit = language === "en" || language === "pl" ? "km" : "км";
    const body = language === "ru" || language === "uk" ? text.replace(".", ",") : text;
    return `${body} ${unit}`;
  }
  const text = formatDistance(language, meters);
  if (!text) return "—";
  if (language === "ru" || language === "uk") return text.replace(".", ",");
  return text;
}

export function routeSummary(language, progress, nowMs = Date.now()) {
  const captions = CAPTIONS[language] || CAPTIONS.ru;
  if (!progress) {
    return captions.map(caption => ({ value: "—", caption }));
  }
  return [
    { value: shownDistance(language, progress.meters), caption: captions[0] },
    { value: formatTransit(language, progress.seconds), caption: captions[1] },
    { value: formatClock(progress.seconds, nowMs), caption: captions[2] },
  ];
}

function glyphWidth(text, fontSize, letter, digit) {
  let width = 0;
  for (const char of String(text)) {
    if (char === " ") width += fontSize * 0.34;
    else if (/[0-9:.,]/.test(char)) width += fontSize * digit;
    else width += fontSize * letter;
  }
  return Math.ceil(width);
}

export function textWidth(text, fontSize) {
  return glyphWidth(text, fontSize, 0.7, 0.62);
}

function clusterWidth(text, fontSize) {
  return glyphWidth(text, fontSize, 0.82, 0.72);
}

export function barScale(available, widths) {
  const needed = widths.reduce((sum, width) => sum + width, 0);
  if (!(available > 0) || !(needed > 0)) return 1;
  return Math.min(1, available / needed);
}

export function summaryItemWidths(items, valueSize = 18, captionSize = 11) {
  return items.map(item => Math.max(clusterWidth(item.value, valueSize), clusterWidth(item.caption, captionSize)) + 8);
}

export function summaryFit(items, available) {
  const room = Math.max(0, Number(available) || 0);
  let valueSize = 18;
  let captionSize = 11;
  let widths = summaryItemWidths(items, valueSize, captionSize);
  while (valueSize > 13 && widths.reduce((sum, width) => sum + width, 0) > room) {
    valueSize -= 1;
    captionSize = Math.max(10, Math.round(valueSize * 0.62));
    widths = summaryItemWidths(items, valueSize, captionSize);
  }
  const needed = widths.reduce((sum, width) => sum + width, 0);
  return { valueSize, captionSize, widths, fits: needed <= room && needed > 0 };
}

export const IPHONE_SE_WIDTH = 375;
export const IPHONE_15_WIDTH = 393;
export const IPHONE_15_HEIGHT = 852;
// The phone on the desk is an iPhone 15 Pro Max.
export const NAV_DEVICE_WIDTH = 430;
export const NAV_DEVICE_HEIGHT = 932;

export function keyboardClearance({ contentBottom, keyboardTop }) {
  const bottom = Number(contentBottom);
  const top = Number(keyboardTop);
  if (!Number.isFinite(bottom) || !Number.isFinite(top)) return 0;
  return Math.max(0, Math.round(bottom - top));
}

export function suggestionViewport({ windowHeight, keyboardHeight = 0, topChrome = 0, bottomChrome = 0, cap = 280 }) {
  const height = Number(windowHeight);
  if (!Number.isFinite(height) || height <= 0) return 0;
  const room = height
    - Math.max(0, Number(keyboardHeight) || 0)
    - Math.max(0, Number(topChrome) || 0)
    - Math.max(0, Number(bottomChrome) || 0);
  if (room <= 0) return 0;
  return Math.min(cap, Math.round(room));
}
