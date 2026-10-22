// First-launch notice. The screen is this text, the checkbox, and Continue.
// It does not say whether confirmation changes the developer's liability.

export const NOTICE_VERSION_ID = "camalert-country-notice-2026-10-22";
export const CONSENT_STORAGE_KEY = "camera_notice_consent_v1";

export const NOTICE_TEXT = {
  ru: {
    body: "Правила использования приложений, предупреждающих о дорожных камерах, различаются по странам. В некоторых странах отдельные функции могут быть запрещены. Перед поездкой ознакомьтесь с местными ограничениями и соблюдайте правила дорожного движения.",
    checkbox: "Я ознакомился(ась) с информацией и понимаю, что обязан(а) соблюдать местное законодательство.",
    continueLabel: "Продолжить",
  },
  uk: {
    body: "Правила використання застосунків, що попереджають про дорожні камери, різняться за країнами. У деяких країнах окремі функції можуть бути заборонені. Перед поїздкою ознайомтеся з місцевими обмеженнями і дотримуйтеся правил дорожнього руху.",
    checkbox: "Я ознайомився(лася) з інформацією і розумію, що зобов’язаний(а) дотримуватися місцевого законодавства.",
    continueLabel: "Продовжити",
  },
  en: {
    body: "Rules for using apps that warn about road cameras differ by country. In some countries, individual features may be prohibited. Before a trip, read the local restrictions and follow the traffic rules.",
    checkbox: "I have read this information and understand that I must comply with local law.",
    continueLabel: "Continue",
  },
  pl: {
    body: "Zasady korzystania z aplikacji ostrzegających o kamerach drogowych różnią się w zależności od kraju. W niektórych krajach poszczególne funkcje mogą być zabronione. Przed podróżą zapoznaj się z lokalnymi ograniczeniami i przestrzegaj przepisów ruchu drogowego.",
    checkbox: "Zapoznałem(am) się z informacją i rozumiem, że jestem zobowiązany(a) przestrzegać lokalnego prawa.",
    continueLabel: "Kontynuuj",
  },
};

export function noticeCopy(locale) {
  return NOTICE_TEXT[locale] || NOTICE_TEXT.ru;
}

export function canContinue(checked) {
  return checked === true;
}

export function buildConsentRecord(checked, confirmedAt) {
  if (!canContinue(checked)) return null;
  if (typeof confirmedAt !== "string" || confirmedAt.length === 0) return null;
  return { versionId: NOTICE_VERSION_ID, confirmedAt };
}

export function consentMatches(record) {
  return !!(
    record &&
    record.versionId === NOTICE_VERSION_ID &&
    typeof record.confirmedAt === "string" &&
    record.confirmedAt.length > 0
  );
}
