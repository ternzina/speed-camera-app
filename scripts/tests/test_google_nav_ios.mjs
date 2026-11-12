import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");

test("the store app and navtest both mount the Google map", () => {
  const gate = read("google-nav-gate.js");
  const app = read("App.js");
  const config = read("react-native.config.js");
  assert.match(gate, /STORE_BUNDLE = "com\.21wek\.camera"/);
  assert.match(gate, /com\.21wek\.camera\.navtest/);
  assert.match(gate, /function usesInAppGoogleNav/);
  assert.match(gate, /STORE_PREVIEW_BUNDLE = "com\.21wek\.camera\.voicepreview"/);
  assert.match(gate, /applicationId === STORE_BUNDLE/);
  assert.match(gate, /applicationId === GOOGLE_NAV_TEST_BUNDLE/);
  assert.match(gate, /applicationId === STORE_PREVIEW_BUNDLE/);
  assert.doesNotMatch(gate, /voicediag/);
  const check = read("preview-install-check.js");
  assert.match(check, /STORE_PREVIEW_BUNDLE/);
  assert.match(check, /queueUkrainianClip\(plan\)/);
  assert.match(check, /speakCameraAlert\(message\.speech, message\.locale\)/);
  assert.doesNotMatch(check, /createAudioPlayer|setDestination|watchPositionAsync/);
  assert.match(app, /runPreviewInstallCheck\(/);
  assert.match(app, /usesInAppGoogleNav\(\) && \(tab === "drive" \|\| iosRouteOpen\)/);
  assert.match(app, /tab === "drive" && !active && !usesInAppGoogleNav\(\)/);
  assert.match(app, /hideExternalNav=\{usesInAppGoogleNav\(\)\}/);
  assert.doesNotMatch(app.slice(app.indexOf("usesInAppGoogleNav() && (tab === \"drive\" || iosRouteOpen)"), app.indexOf("if (iosRouteOpen)")), /DriveHome|Выберите навигацию|Apple Maps/);
  assert.match(app, /if \(foregroundTripRunning \|\| sub\.current\) return true/);
  assert.match(app, /isGoogleNavTestApp\(\) \? \[\] : \["UA","PL"\]/);
  assert.doesNotMatch(config, /platforms: \{ ios: null \}/);
  assert.doesNotMatch(config, /CAMALERT_IOS_GOOGLE_NAV_TEST === '1'/);
});

test("the Google screen does not draw an Apple route or a second maps SDK", () => {
  const screen = read("google-nav-test-screen.js");
  const loader = read("google-nav-test.js");
  assert.doesNotMatch(screen, /react-native-maps|PROVIDER_GOOGLE|calculateRoutes|MKDirections|ios-mapkit-directions/);
  assert.match(screen, /MapType\.NORMAL/);
  assert.match(screen, /MapType\.SATELLITE/);
  assert.match(screen, /MapType\.HYBRID/);
  assert.match(screen, /setDestination\(/);
  assert.match(screen, /startGuidance\(\)/);
  assert.match(screen, /AudioGuidance\.SILENT/);
  assert.match(screen, /subscribeCameraSpeech/);
  assert.match(screen, /setOnReroutingRequestedByOffRoute/);
  assert.match(screen, /setOnRemainingTimeOrDistanceChanged/);
  assert.match(screen, /controllerRef\.current\.init\(\)/);
  assert.match(loader, /TurboModuleRegistry\.get\("NavModule"\)/);
  assert.match(read("modules/camalert-mapkit-directions/ios/CamAlertMapKitDirectionsModule.swift"), /MKDirections/);
});

test("turn voice stays off until the guidance button", () => {
  const screen = read("google-nav-test-screen.js");
  const session = screen.slice(screen.indexOf("async function ensureSession"), screen.indexOf("async function run"));
  assert.match(session, /requestVoiceGuidance\(controllerRef\.current, AudioGuidance\.SILENT, "session"\)/);
  assert.doesNotMatch(session, /startGuidance|VOICE_ALERTS_AND_GUIDANCE/);
  const build = screen.slice(screen.indexOf("function buildRoute"), screen.indexOf("function startGuidance"));
  assert.match(build, /setDestination\(/);
  assert.doesNotMatch(build, /startGuidance\(/);
  const go = screen.slice(screen.indexOf("function startGuidance"), screen.indexOf("async function endRoute"));
  assert.match(go, /startGuidance\(\)/);
  assert.match(go, /onStartTrip\(\)/);
});

test("the route bar is one horizontal line and the terms dialog is not repeated", () => {
  const screen = read("google-nav-test-screen.js");
  const session = screen.slice(screen.indexOf("async function ensureSession"), screen.indexOf("async function run"));
  assert.match(session, /areTermsAccepted\(\)/);
  assert.match(session, /if \(!accepted\)/);
  assert.match(screen, /placeholder=\{copy\.where\}/);
  assert.match(screen, /Куда едем\?/);
  assert.match(screen, /flexWrap: "nowrap"/);
  assert.match(screen, /flexShrink: 0/);
  assert.match(screen, /numberOfLines=\{1\}/);
  assert.match(screen, /mapPadding=/);
  assert.match(screen, /SystemSafeArea/);
  assert.match(screen, /footerEnabled=\{false\}/);
  assert.match(screen, /clearTimeout/);
  assert.match(screen, /PLACES_DEBOUNCE_MS/);
  assert.match(screen, /placeDetailsLocation/);
  assert.match(screen, /accessibilityLabel=\{copy\.layers\}/);
  assert.match(screen, /styles\.speaker/);
  assert.doesNotMatch(screen, /sideButton|fetch\(|places\.googleapis|MKLocalSearch|CLGeocoder|MKDirections/);
  const bar = screen.slice(screen.indexOf("function RouteBar"), screen.indexOf("function finiteCoord"));
  assert.match(bar, /numberOfLines=\{1\}/);
  assert.doesNotMatch(bar, /endRoute|В путь/);
  const summaryToEnd = screen.slice(screen.indexOf("<RouteBar"), screen.indexOf("copy.endRoute"));
  assert.match(summaryToEnd, /copy\.go/);
  assert.doesNotMatch(summaryToEnd, /copy\.endRoute/);
});

test("the four tabs follow the CamAlert language", () => {
  const app = read("App.js");
  const navStart = app.indexOf("const nav = [");
  const nav = app.slice(navStart, app.indexOf("];", navStart) + 2);
  assert.match(nav, /t\.drive/);
  assert.match(nav, /t\.map/);
  assert.match(nav, /t\.nearby/);
  assert.match(nav, /t\.settings/);
  assert.doesNotMatch(nav, /Поездка/);
  assert.match(app, /drive: "Поездка"/);
  assert.match(app, /drive: "Поїздка"/);
  assert.match(app, /drive: "Drive"/);
  assert.match(app, /drive: "Jazda"/);
  assert.match(app, /nearby: "Рядом"/);
  assert.match(app, /nearby: "Поруч"/);
  assert.match(app, /nearby: "Nearby"/);
  assert.match(app, /nearby: "W pobliżu"/);
  assert.match(app, /settings: "Настройки"/);
  assert.match(app, /settings: "Налаштування"/);
  assert.match(app, /settings: "Settings"/);
  assert.match(app, /settings: "Ustawienia"/);
});

test("Google turn voice stays with the SDK because it has no language setter", () => {
  const screen = read("google-nav-test-screen.js");
  const header = read("ios/Pods/GoogleNavigation/Frameworks/GoogleNavigation.xcframework/ios-arm64/GoogleNavigation.framework/Headers/GMSNavigator.h");
  const bridge = read("node_modules/@googlemaps/react-native-navigation-sdk/ios/react-native-navigation-sdk/NavModule.mm");
  assert.match(screen, /setAudioGuidanceType/);
  assert.match(screen, /SDK 10\.13\.0 exposes no language setter/);
  assert.doesNotMatch(screen, /Speech\.speak|setVoiceLanguage|setLocale\(/);
  assert.match(header, /voiceGuidance/);
  assert.doesNotMatch(header, /language|locale/i);
  assert.match(bridge, /setAudioGuidanceType/);
  assert.doesNotMatch(bridge, /setLanguage|setLocale|voiceLanguage/);
});

test("choosing a suggestion dismisses the keyboard and keeps the route button clear", () => {
  const screen = read("google-nav-test-screen.js");
  const choose = screen.slice(screen.indexOf("function dismissSearch"), screen.indexOf("function startGuidance"));
  assert.match(choose, /Keyboard\.dismiss\(\)/);
  assert.match(choose, /searchField\.current\?\.blur\(\)/);
  const pick = choose.indexOf("function chooseResult");
  const dismiss = choose.indexOf("dismissSearch()", pick);
  const clear = choose.indexOf("setSuggestions([])", pick);
  const route = choose.indexOf("buildRoute(", pick);
  assert.ok(pick >= 0 && dismiss > pick && clear > dismiss && route > clear);
  assert.match(screen, /onMapClick=\{coordinate => \{/);
  assert.match(screen, /dismissSearch\(\);\s*pickPoint\(coordinate\);/);
  assert.match(screen, /keyboardShouldPersistTaps="handled"/);
  assert.match(screen, /keyboardClearance\(/);
  assert.match(screen, /suggestionViewport\(/);
  assert.match(screen, /flexWrap: "nowrap"/);
  assert.doesNotMatch(screen, /showSoftInputOnFocus=\{false\}/);
  assert.doesNotMatch(choose, /startGuidance\(/);
});
