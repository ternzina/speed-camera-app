import { stepNavtestSection } from "./poland-engine.js";

export const NAVTEST_SECTION_KEY = "camalert_navtest_section_v1";

export function createNavtestSectionStore(storage) {
  let state = null;
  let loaded = false;
  return {
    async apply(input) {
      if (!loaded) {
        loaded = true;
        try {
          state = JSON.parse(await storage.getItem(NAVTEST_SECTION_KEY) || "null");
        } catch {
          state = null;
        }
      }
      const outcome = stepNavtestSection(state, input);
      let next = outcome.state;
      if (outcome.say.length && input.speak) {
        const spoke = await input.speak(outcome.say).catch(() => false);
        if (!spoke) next = outcome.stateIfUnsaid;
      }
      state = next;
      if (next && (next.sectionId || next.closed || next.pace)) {
        await storage.setItem(NAVTEST_SECTION_KEY, JSON.stringify(next));
      } else {
        await storage.removeItem(NAVTEST_SECTION_KEY);
      }
      return { ...outcome, state: next };
    },
    async reset() {
      state = null;
      loaded = true;
      await storage.removeItem(NAVTEST_SECTION_KEY);
    },
  };
}
