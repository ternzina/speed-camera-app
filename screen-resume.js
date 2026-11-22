export const SCREEN_RESUME_KEY = "camalert_screen_resume_v1";

const TABS = new Set(["drive", "map", "nearby", "settings", "cameras", "history"]);

export function rememberScreen({
  onboarding = "new",
  page = 0,
  permission = null,
  tab = "drive",
  premium = null,
  guide = false,
} = {}) {
  const knownPage = page === 0 || page === 1 || page === 2 ? page : 0;
  return {
    onboarding: onboarding === "done" ? "done" : "new",
    page: knownPage,
    permission: permission === "launch" || permission === "settings" ? permission : null,
    tab: TABS.has(tab) ? tab : "drive",
    premium: premium === "plans" || premium === "manage" ? premium : null,
    guide: guide === true,
  };
}

// iOS closes the app when location changes to Always. The saved screen is the
// page to show on the next launch, instead of the first welcome screen.
export function restoreScreen(saved, { onboardingDone = false } = {}) {
  const screen = rememberScreen(saved || {});
  if (onboardingDone) {
    return {
      onboardingPage: 0,
      permissionScreen: screen.permission === "settings" ? "settings" : null,
      tab: screen.tab,
      premiumView: screen.premium,
      guide: screen.guide,
    };
  }
  return {
    onboardingPage: screen.page,
    permissionScreen: screen.permission === "launch" ? "launch" : null,
    tab: "drive",
    premiumView: null,
    guide: screen.permission === "launch" ? screen.guide : false,
  };
}
