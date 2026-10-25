const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { patchNavModule, patchNavViewModule } = require('../patch-navigation-sdk.cjs');

const terms = `  @Override
  public void showTermsAndConditionsDialog(
      String title,
      String companyName,
      boolean showOnlyDisclaimer,
      @Nullable ReadableMap uiParams,
      Promise promise) {
    final Activity currentActivity = getReactApplicationContext().getCurrentActivity();
    if (currentActivity == null) {
      promise.reject("noActivity", "No activity available to show the dialog");
      return;
    }
`;
const lookups = Array.from({ length: 5 }, () => '    final Activity currentActivity = getReactApplicationContext().getCurrentActivity();').join('\n');
const originalModule = `${terms}\n${lookups}\n`;
const patchedModule = patchNavModule(originalModule);
assert.equal(patchNavModule(patchedModule), patchedModule);
assert.match(patchedModule, /private Activity hostActivity\(\)/);
assert.match(patchedModule, /!UiThreadUtil\.isOnUiThread\(\)/);
assert.equal(patchedModule.match(/getReactApplicationContext\(\)\.getCurrentActivity\(\)/g).length, 1);
assert.equal(patchedModule.match(/hostActivity\(\)/g).length, 7);

const originalView = `          if (fragment instanceof INavViewFragment) {
            fragment
                .getMapController()
                .setFollowingPerspective(
                    (int) perspective, zoomLevel == null ? null : zoomLevel.floatValue());
            promise.resolve(null);`;
const patchedView = patchNavViewModule(originalView);
assert.equal(patchNavViewModule(patchedView), patchedView);
assert.match(patchedView, /if \(mapController == null\)/);
assert.doesNotMatch(patchedView, /fragment\s*\n\s*\.getMapController\(\)/);

const sdk = path.join(__dirname, '../../node_modules/@googlemaps/react-native-navigation-sdk/android/src/main/java/com/google/android/react/navsdk');
for (const [file, patch] of [['NavModule.java', patchNavModule], ['NavViewModule.java', patchNavViewModule]]) {
  const source = fs.readFileSync(path.join(sdk, file), 'utf8');
  assert.equal(patch(source), source, `${file} installed sources differ from the project patch`);
}

console.log('navigation sdk patch ok');
