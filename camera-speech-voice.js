function languageCode(language) {
  return String(language || "").toLowerCase().replace("_", "-");
}

function voiceScore(voice) {
  const code = languageCode(voice?.language);
  const quality = String(voice?.quality || "").toLowerCase();
  const identifier = String(voice?.identifier || "").toLowerCase();
  let score = code === "uk-ua" ? 10 : 5;
  if (quality === "premium" || identifier.includes("premium")) score += 4;
  else if (quality === "enhanced" || identifier.includes("enhanced")) score += 2;
  return score;
}

export function pickUkrainianVoice(voices) {
  const matches = (Array.isArray(voices) ? voices : []).filter(voice => {
    const code = languageCode(voice?.language);
    return voice?.identifier && (code === "uk" || code.startsWith("uk-"));
  });
  if (!matches.length) return null;
  return matches.slice().sort((a, b) => voiceScore(b) - voiceScore(a) || String(a.name || "").localeCompare(String(b.name || "")))[0];
}

export function cameraSpeechOptions(locale, voices) {
  const language = String(locale || "");
  if (languageCode(language).startsWith("uk")) {
    const voice = pickUkrainianVoice(voices);
    if (!voice) return { skip: true, reason: "no-ukrainian-voice" };
    return { language: "uk-UA", voice: voice.identifier, rate: 0.95 };
  }
  return { language, rate: 0.95 };
}
