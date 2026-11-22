// Defaults for background GPS. A stored "off" is a user choice.
// A missing key defaults to on. This module does not read location.

export const BACKGROUND_CHOICE_KEY = "camalert_background_choice_v1";
export const VOICE_NOTICE_KEY = "camalert_voice_notice_v1";

const VOICE_NOTICE = {
  ru: "Голосовые предупреждения уже включены",
  uk: "Голосові попередження вже увімкнені",
  en: "Voice warnings are already on",
  pl: "Ostrzeżenia głosowe są już włączone",
};

export function voiceNoticeCopy(language) {
  return VOICE_NOTICE[language] || VOICE_NOTICE.ru;
}

export function isExistingInstall(markers = {}) {
  return [markers.settings, markers.onboarding, markers.launches, markers.history]
    .some(value => value != null && String(value) !== "");
}

function choiceValue(value) {
  return value === "on" || value === "off" ? value : null;
}

// Background mode is opted in by default unless the user explicitly turned it off.
// The operating system still controls whether Always location is available.
export function resolveBackgroundChoice({ storedChoice, existingInstall, sessionEnabled }) {
  const choice = choiceValue(storedChoice);
  if (choice) return { choice, write: null };
  if (sessionEnabled === true) return { choice: "on", write: "on" };
  return { choice: "on", write: "on" };
}

// The switch is on only when background is wanted and Always is granted.
// A legacy session can still show on after an update that has no stored choice.
export function backgroundSwitchOn({ choice, access, sessionRunning }) {
  if (choice === "off" || access !== "always") return false;
  if (choice === "on") return true;
  return sessionRunning === true;
}

// Location updates for background warnings run only during a trip.
export function shouldRunBackgroundGps({ choice, access, tripActive }) {
  return tripActive === true && access === "always" && choice === "on";
}

export function voiceNoticeForLaunch({ existingInstall, storedNotice }) {
  if (storedNotice === "seen") return { show: false, write: null };
  if (storedNotice === "pending") return { show: true, write: null };
  if (!existingInstall) return { show: true, write: "pending" };
  return { show: false, write: null };
}
