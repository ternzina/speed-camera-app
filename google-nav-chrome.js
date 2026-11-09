import { formatDistance, formatDuration } from "./route-guidance.js";

const CAPTIONS = {
  ru: ["Осталось", "Время", "Прибытие"],
  uk: ["Залишилось", "Час", "Прибуття"],
  en: ["Left", "Time", "Arrival"],
  pl: ["Zostało", "Czas", "Przyjazd"],
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
    { value: formatDuration(language, progress.seconds) || "—", caption: captions[1] },
    { value: formatClock(progress.seconds, nowMs), caption: captions[2] },
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
  return items.map(item => Math.max(textWidth(item.value, valueSize), textWidth(item.caption, captionSize)) + 16);
}
