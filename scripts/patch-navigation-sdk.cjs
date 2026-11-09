// The Navigation SDK 0.16.3 asks React Native for the current Activity. On this
// app that reference stays empty while MainActivity is already on screen, so
// route building reports "No activity" and a missing map controller crashes
// the process. Reapply the two source edits after every install.
const fs = require('fs');
const path = require('path');

const SDK_JAVA = path.join(
  __dirname,
  '..',
  'node_modules/@googlemaps/react-native-navigation-sdk/android/src/main/java/com/google/android/react/navsdk'
);

const HOST_ACTIVITY = `  private Activity hostActivity() {
    Activity activity = getReactApplicationContext().getCurrentActivity();
    if (activity != null) return activity;
    try {
      Class<?> main = Class.forName("com.camera21wek.MainActivity");
      Object ref = main.getField("resumedActivity").get(null);
      if (ref instanceof java.lang.ref.WeakReference<?>) {
        Object value = ((java.lang.ref.WeakReference<?>) ref).get();
        if (value instanceof Activity && !((Activity) value).isDestroyed()) {
          return (Activity) value;
        }
      }
    } catch (ReflectiveOperationException ignored) {
    }
    return null;
  }

`;

const TERMS_SIGNATURE = `  public void showTermsAndConditionsDialog(
      String title,
      String companyName,
      boolean showOnlyDisclaimer,
      @Nullable ReadableMap uiParams,
      Promise promise) {
`;

const TERMS_ON_UI_THREAD = `${TERMS_SIGNATURE}    if (!UiThreadUtil.isOnUiThread()) {
      UiThreadUtil.runOnUiThread(
          () ->
              showTermsAndConditionsDialog(
                  title, companyName, showOnlyDisclaimer, uiParams, promise));
      return;
    }
`;

const MAP_CONTROLLER_CALL = `          if (fragment instanceof INavViewFragment) {
            fragment
                .getMapController()
                .setFollowingPerspective(
                    (int) perspective, zoomLevel == null ? null : zoomLevel.floatValue());
            promise.resolve(null);`;

const MAP_CONTROLLER_GUARD = `          if (fragment instanceof INavViewFragment) {
            MapViewController mapController = fragment.getMapController();
            if (mapController == null) {
              promise.reject(JsErrors.NO_MAP_ERROR_CODE, JsErrors.NO_MAP_ERROR_MESSAGE);
              return;
            }
            mapController.setFollowingPerspective(
                (int) perspective, zoomLevel == null ? null : zoomLevel.floatValue());
            promise.resolve(null);`;

function activityAssignments(source) {
  return source.match(/^([ \t]*)final Activity currentActivity = getReactApplicationContext\(\)\.getCurrentActivity\(\);/gm);
}

function patchNavModule(source) {
  let next = source;
  const assignments = activityAssignments(next);
  if (assignments && assignments.length !== 6) {
    throw new Error(`Navigation SDK NavModule.java has ${assignments.length} activity lookups; expected 6`);
  }
  if (assignments) {
    next = next.replace(
      /^([ \t]*)final Activity currentActivity = getReactApplicationContext\(\)\.getCurrentActivity\(\);/gm,
      '$1final Activity currentActivity = hostActivity();'
    );
  }
  if (!next.includes('private Activity hostActivity()')) {
    const signatureAt = next.indexOf(TERMS_SIGNATURE);
    if (signatureAt < 0) throw new Error('Navigation SDK NavModule.java has no terms dialog method to patch');
    const overrideAt = next.lastIndexOf('  @Override\n', signatureAt);
    if (overrideAt < 0) throw new Error('Navigation SDK NavModule.java terms method has no @Override');
    next = next.slice(0, overrideAt) + HOST_ACTIVITY + next.slice(overrideAt);
  }
  if (!next.includes('!UiThreadUtil.isOnUiThread()')) {
    if (!next.includes(TERMS_SIGNATURE)) throw new Error('Navigation SDK terms dialog signature changed');
    next = next.replace(TERMS_SIGNATURE, TERMS_ON_UI_THREAD);
  }
  if (!next.includes('private Activity hostActivity()') || !next.includes('!UiThreadUtil.isOnUiThread()') || activityAssignments(next)) {
    throw new Error('Navigation SDK NavModule.java patch did not apply');
  }
  return next;
}

function patchNavViewModule(source) {
  if (source.includes(MAP_CONTROLLER_GUARD)) return source;
  if (!source.includes(MAP_CONTROLLER_CALL)) {
    throw new Error('Navigation SDK NavViewModule.java setFollowingPerspective no longer matches 0.16.3');
  }
  const next = source.replace(MAP_CONTROLLER_CALL, MAP_CONTROLLER_GUARD);
  if (!next.includes(MAP_CONTROLLER_GUARD)) throw new Error('Navigation SDK map controller guard did not apply');
  return next;
}

const NAV_ON_LOAD = `  if (*_mapViewType == NAVIGATION) {
    _mapView.navigationEnabled = YES;
  }`;

const NAV_AFTER_ACCEPTANCE = `  // The map used to enable navigation while the view loaded, and Google
  // presented the terms dialog on every open. Leave it off until the SDK
  // already has a stored acceptance. The screen shows that dialog once.
  if (*_mapViewType == NAVIGATION && GMSNavigationServices.areTermsAndConditionsAccepted) {
    _mapView.navigationEnabled = YES;
  }`;

const NAV_DEFERRED = `  // Navigation stays off while the view loads. Enabling it here presented
  // the Google terms dialog on every launch. The screen enables it after
  // the SDK reports that acceptance is already stored.`;

const MAP_TAP = `- (void)mapView:(GMSMapView *)mapView didTapAtCoordinate:(CLLocationCoordinate2D)coordinate {
  [_viewCallbacks
      handleMapClick:[ObjectTranslationUtil transformCoordinateToDictionary:coordinate]];
}`;

const MAP_LONG_PRESS = `- (void)mapView:(GMSMapView *)mapView didLongPressAtCoordinate:(CLLocationCoordinate2D)coordinate {
  [_viewCallbacks
      handleMapClick:[ObjectTranslationUtil transformCoordinateToDictionary:coordinate]];
}`;

function patchNavViewController(source) {
  let next = source;
  if (next.includes(NAV_ON_LOAD)) next = next.replace(NAV_ON_LOAD, NAV_DEFERRED);
  if (next.includes(NAV_AFTER_ACCEPTANCE)) next = next.replace(NAV_AFTER_ACCEPTANCE, NAV_DEFERRED);
  const loadView = next.slice(next.indexOf('- (void)loadView'), next.indexOf('- (void)viewDidLoad'));
  if (loadView.includes('navigationEnabled = YES')) {
    throw new Error('Navigation SDK NavViewController.mm still enables navigation while loading');
  }
  if (!next.includes('didLongPressAtCoordinate')) {
    if (!next.includes(MAP_TAP)) {
      throw new Error('Navigation SDK NavViewController.mm no longer has the map tap callback');
    }
    next = next.replace(MAP_TAP, `${MAP_TAP}\n\n${MAP_LONG_PRESS}`);
  }
  if (!next.includes(NAV_DEFERRED) || !next.includes('didLongPressAtCoordinate')) {
    throw new Error('Navigation SDK NavViewController.mm patch did not apply');
  }
  return next;
}

function patchNavigationSdk() {
  const navModulePath = path.join(SDK_JAVA, 'NavModule.java');
  const navViewPath = path.join(SDK_JAVA, 'NavViewModule.java');
  const navViewControllerPath = path.join(
    __dirname,
    '..',
    'node_modules/@googlemaps/react-native-navigation-sdk/ios/react-native-navigation-sdk/NavViewController.mm'
  );
  let applied = false;
  if (fs.existsSync(navModulePath) && fs.existsSync(navViewPath)) {
    const navModule = fs.readFileSync(navModulePath, 'utf8');
    const navView = fs.readFileSync(navViewPath, 'utf8');
    const nextModule = patchNavModule(navModule);
    const nextView = patchNavViewModule(navView);
    if (nextModule !== navModule) fs.writeFileSync(navModulePath, nextModule);
    if (nextView !== navView) fs.writeFileSync(navViewPath, nextView);
    applied = nextModule !== navModule || nextView !== navView;
  }
  if (fs.existsSync(navViewControllerPath)) {
    const current = fs.readFileSync(navViewControllerPath, 'utf8');
    const next = patchNavViewController(current);
    if (next !== current) {
      fs.writeFileSync(navViewControllerPath, next);
      applied = true;
    }
  }
  return { applied };
}

module.exports = { patchNavModule, patchNavViewModule, patchNavViewController, patchNavigationSdk };

if (require.main === module) {
  const result = patchNavigationSdk();
  if (!result.applied && !fs.existsSync(path.join(SDK_JAVA, 'NavModule.java'))) {
    console.error('Navigation SDK sources were not installed; the activity patch was not applied.');
    process.exit(1);
  }
}
