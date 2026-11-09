import { formatDistance } from "./route-guidance.js";

const CAPTIONS = {
  ru: ["Осталось", "Прибытие"],
  uk: ["Залишилось", "Прибуття"],
  en: ["Remaining", "Arrival"],
  pl: ["Zostało", "Przyjazd"],
};

export function formatClock(etaSeconds, nowMs = Date.now()) {
  if (!Number.isFinite(etaSeconds) || etaSeconds < 0) return "—";
  const arrival = new Date(nowMs + etaSeconds * 1000);
  return `${String(arrival.getHours()).padStart(2, "0")}:${String(arrival.getMinutes()).padStart(2, "0")}`;
}

function shownDistance(language, meters) {
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
    { value: formatClock(progress.seconds, nowMs), caption: captions[1] },
  ];
}

export function textWidth(text, fontSize) {
  let width = 0;
  for (const char of String(text)) {
    if (char === " ") width += fontSize * 0.34;
    else if (/[0-9:.,]/.test(char)) width += fontSize * 0.62;
    else width += fontSize * 0.7;
  }
  return Math.ceil(width);
}

export function barScale(available, widths) {
  const needed = widths.reduce((sum, width) => sum + width, 0);
  if (!(available > 0) || !(needed > 0)) return 1;
  return Math.min(1, available / needed);
}

export function summaryItemWidths(items, valueSize = 18, captionSize = 11) {
  const widths = items.map(item => Math.max(textWidth(item.value, valueSize), textWidth(item.caption, captionSize)) + 16);
  if (widths.length !== 2) return widths;
  const column = Math.max(widths[0], widths[1]);
  return [column, column];
}

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
