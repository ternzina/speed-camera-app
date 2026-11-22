import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rememberScreen, restoreScreen, SCREEN_RESUME_KEY } from "../../screen-resume.js";

const app = readFileSync(new URL("../../App.js", import.meta.url), "utf8");

test("a relaunch after Always returns to the permission page, not the first welcome screen", () => {
  const saved = rememberScreen({
    onboarding: "new",
    page: 2,
    permission: "launch",
    tab: "settings",
    guide: true,
  });
  assert.deepEqual(restoreScreen(saved, { onboardingDone: false }), {
    onboardingPage: 2,
    permissionScreen: "launch",
    tab: "drive",
    premiumView: null,
    guide: true,
  });
});

test("a finished install returns to the page that was open", () => {
  const saved = rememberScreen({
    onboarding: "done",
    permission: "settings",
    tab: "settings",
    premium: "plans",
    guide: true,
  });
  assert.deepEqual(restoreScreen(saved, { onboardingDone: true }), {
    onboardingPage: 0,
    permissionScreen: "settings",
    tab: "settings",
    premiumView: "plans",
    guide: true,
  });
  assert.equal(restoreScreen(null, { onboardingDone: true }).tab, "drive");
});

test("the app stores the screen before iOS can close it", () => {
  assert.match(app, /SCREEN_RESUME_KEY/);
  assert.match(app, /restoreScreen\(/);
  const load = app.slice(app.indexOf("const screenReady"), app.indexOf("previewApi.current"));
  assert.match(load, /SCREEN_RESUME_KEY/);
  assert.match(load, /setOnboardingPage/);
  assert.match(load, /setPermissionScreen/);
});
