import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  backgroundSwitchOn,
  isExistingInstall,
  resolveBackgroundChoice,
  shouldRunBackgroundGps,
  voiceNoticeCopy,
  voiceNoticeForLaunch,
} from "../../install-defaults.js";
import { mergeStoredSettings } from "../../camera-warning-gate.js";

const read = name => readFileSync(new URL(`../../${name}`, import.meta.url), "utf8");

test("a new install wants background, and an update does not invent that wish", () => {
  const fresh = resolveBackgroundChoice({ storedChoice: null, existingInstall: false, sessionEnabled: false });
  assert.equal(fresh.choice, "on");
  assert.equal(fresh.write, "on");
  const updated = resolveBackgroundChoice({ storedChoice: null, existingInstall: true, sessionEnabled: false });
  assert.equal(updated.choice, null);
  assert.equal(updated.write, null);
  const alreadyOn = resolveBackgroundChoice({ storedChoice: null, existingInstall: true, sessionEnabled: true });
  assert.equal(alreadyOn.choice, "on");
  const refused = resolveBackgroundChoice({ storedChoice: "off", existingInstall: false, sessionEnabled: true });
  assert.equal(refused.choice, "off");
  assert.equal(refused.write, null);
  assert.equal(isExistingInstall({ settings: null, onboarding: null, launches: null, history: null }), false);
  assert.equal(isExistingInstall({ settings: null, onboarding: "done", launches: null, history: null }), true);
});

test("background looks off without Always permission and does not run outside a trip", () => {
  assert.equal(backgroundSwitchOn({ choice: "on", access: "missing", sessionRunning: false }), false);
  assert.equal(backgroundSwitchOn({ choice: "on", access: "when-in-use", sessionRunning: true }), false);
  assert.equal(backgroundSwitchOn({ choice: "on", access: "always", sessionRunning: false }), true);
  assert.equal(backgroundSwitchOn({ choice: "off", access: "always", sessionRunning: true }), false);
  assert.equal(backgroundSwitchOn({ choice: null, access: "always", sessionRunning: false }), false);
  assert.equal(shouldRunBackgroundGps({ choice: "on", access: "always", tripActive: false }), false);
  assert.equal(shouldRunBackgroundGps({ choice: "on", access: "always", tripActive: true }), true);
  assert.equal(shouldRunBackgroundGps({ choice: "off", access: "always", tripActive: true }), false);
  assert.equal(shouldRunBackgroundGps({ choice: null, access: "always", tripActive: true }), false);
});

test("the first-launch voice line is only for a new install", () => {
  assert.equal(voiceNoticeCopy("ru"), "Голосовые предупреждения уже включены");
  assert.equal(voiceNoticeForLaunch({ existingInstall: false, storedNotice: null }).show, true);
  assert.equal(voiceNoticeForLaunch({ existingInstall: false, storedNotice: null }).write, "pending");
  assert.equal(voiceNoticeForLaunch({ existingInstall: true, storedNotice: null }).show, false);
  assert.equal(voiceNoticeForLaunch({ existingInstall: false, storedNotice: "seen" }).show, false);
  assert.equal(voiceNoticeForLaunch({ existingInstall: true, storedNotice: "pending" }).show, true);
});

test("a stored false for voice, warnings, and vibration stays false", () => {
  const saved = mergeStoredSettings(
    { voice: true, vibration: true, cameraWarnings: true, language: "ru" },
    { voice: false, vibration: false, cameraWarnings: false },
  );
  assert.equal(saved.voice, false);
  assert.equal(saved.vibration, false);
  assert.equal(saved.cameraWarnings, false);
  const missing = mergeStoredSettings(
    { voice: true, vibration: true, cameraWarnings: true },
    { language: "uk" },
  );
  assert.equal(missing.voice, true);
  assert.equal(missing.vibration, true);
  assert.equal(missing.cameraWarnings, true);
});

test("settings keep the counters, hide them, and do not start background GPS by themselves", () => {
  const app = read("App.js");
  assert.match(app, /offerDiagOpen/);
  assert.match(app, /shouldRunBackgroundGps/);
  assert.match(app, /voiceNoticeCopy/);
  assert.match(app, /refreshRemoteData\(true/);
  assert.match(app, /offerReasonLines/);
  assert.doesNotMatch(app, /PREMIUM_ENFORCEMENT\s*=\s*true/);
});
