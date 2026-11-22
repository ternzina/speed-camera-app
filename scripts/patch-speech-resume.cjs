// expo-speech keeps one AVSpeechSynthesizer for the process. After iPhone
// Settings interrupts that private audio session, later warnings stay silent
// until the next cold start. Reapply the become-active reset after install.
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "node_modules/expo-speech/ios/SpeechModule.swift");
const MARKER = "CamAlertSpeechResume";

function patchSpeechModule(source) {
  if (source.includes(MARKER)) return source;
  let next = source;
  if (!next.includes("import UIKit")) {
    next = next.replace("import ExpoModulesCore\n", "import ExpoModulesCore\nimport UIKit\n");
  }
  const created = `    OnCreate {
      delegate = SpeechDelegate(resultHandler: self)
      synthesizer.delegate = delegate
    }`;
  const resume = `    OnCreate {
      delegate = SpeechDelegate(resultHandler: self)
      synthesizer.delegate = delegate
      // ${MARKER}: the synthesizer is created once per process.
      // Opening Settings interrupts its private audio session, and later
      // utterances stay silent until the next cold start. Become-active
      // builds a new synthesizer and does not speak.
      NotificationCenter.default.addObserver(
        forName: UIApplication.didBecomeActiveNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.replaceSynthesizerForResume()
      }
    }`;
  if (!next.includes(created)) {
    throw new Error("expo-speech OnCreate block was not found");
  }
  next = next.replace(created, resume);
  const speaking = `    AsyncFunction("isSpeaking") {
      return synthesizer.isSpeaking
    }
  }`;
  const reset = `    AsyncFunction("isSpeaking") {
      return synthesizer.isSpeaking
    }
  }

  private func replaceSynthesizerForResume() {
    synthesizer.stopSpeaking(at: .immediate)
    let next = AVSpeechSynthesizer()
    next.delegate = delegate
    synthesizer = next
  }`;
  if (!next.includes(speaking)) {
    throw new Error("expo-speech isSpeaking block was not found");
  }
  next = next.replace(speaking, reset);
  return next;
}

function patchSpeechResume() {
  if (!fs.existsSync(FILE)) return { applied: false, missing: true };
  const current = fs.readFileSync(FILE, "utf8");
  const next = patchSpeechModule(current);
  if (next !== current) fs.writeFileSync(FILE, next);
  return { applied: next !== current };
}

module.exports = { patchSpeechModule, patchSpeechResume };

if (require.main === module) {
  const result = patchSpeechResume();
  if (result.missing) {
    console.error("expo-speech sources were not installed; the speech resume patch was not applied.");
    process.exit(1);
  }
}
