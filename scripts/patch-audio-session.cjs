// Diagnostic gate: do not activate the shared audio session before a Google
// navigation session exists. Reapply after install so an EAS build gets the
// same node_modules edits. The pods cannot link the app target, so they call
// CamAlertVoiceDiagLog by its Objective-C name at runtime.
const fs = require("fs");
const path = require("path");

const AUDIO = path.join(__dirname, "..", "node_modules/expo-audio/ios/AudioModule.swift");
const NAV = path.join(
  __dirname,
  "..",
  "node_modules/@googlemaps/react-native-navigation-sdk/ios/react-native-navigation-sdk/NavModule.mm",
);
const MARKER = "CamAlertAudioSessionGate";

const AUDIO_HELPER = `
// ${MARKER}: look up the app flag without linking the app target.
private func CamAlertNavigationSessionExists() -> Bool {
  guard let cls = NSClassFromString("CamAlertVoiceDiagLog") else { return false }
  let selector = NSSelectorFromString("navigationSessionExists")
  guard let method = class_getClassMethod(cls, selector) else { return false }
  typealias Probe = @convention(c) (AnyClass, Selector) -> Bool
  let probe = unsafeBitCast(method_getImplementation(method), to: Probe.self)
  return probe(cls, selector)
}

private func CamAlertActivateSharedSession(_ source: String) -> Bool {
  let exists = CamAlertNavigationSessionExists()
  NSLog("CAMALERT_NAV_VOICE session activate source=%@ performed=%d", source, exists ? 1 : 0)
  return exists
}

`;

const NAV_HELPER = `
// ${MARKER}: the navigation session flag lives in the app, not in this pod.
static void CamAlertSetNavigationSession(BOOL exists) {
  Class cls = NSClassFromString(@"CamAlertVoiceDiagLog");
  SEL selector = NSSelectorFromString(exists ? @"noteNavigationSession" : @"clearNavigationSession");
  if (cls && [cls respondsToSelector:selector]) {
    ((void (*)(Class, SEL))objc_msgSend)(cls, selector);
  } else {
    NSLog(@"CAMALERT_NAV_VOICE navigation session exists=%d diag=missing", exists);
  }
}

`;

function patchAudio(source) {
  if (source.includes(MARKER)) return source;
  let next = source;
  if (!next.includes("import ObjectiveC\n")) {
    next = next.replace("import ExpoModulesCore\n", "import ExpoModulesCore\nimport ObjectiveC\n");
  }
  const interruption = `      try AVAudioSession.sharedInstance().setActive(true)
      if options.contains(.shouldResume) {`;
  const gatedInterruption = `      if CamAlertActivateSharedSession("interruption-end") {
        try AVAudioSession.sharedInstance().setActive(true)
      }
      if options.contains(.shouldResume) {`;
  if (!next.includes(interruption)) throw new Error("expo-audio interruption activation was not found");
  next = next.replace(interruption, gatedInterruption);
  const reset = `      try AVAudioSession.sharedInstance().setActive(true)
    } catch {
      print("Failed to reconfigure audio session after media services reset: \\(error)")`;
  const gatedReset = `      if CamAlertActivateSharedSession("media-reset") {
        try AVAudioSession.sharedInstance().setActive(true)
      }
    } catch {
      print("Failed to reconfigure audio session after media services reset: \\(error)")`;
  if (!next.includes(reset)) throw new Error("expo-audio media-reset activation was not found");
  next = next.replace(reset, gatedReset);
  const anchor = "public class AudioModule: Module {\n";
  if (!next.includes(anchor)) throw new Error("expo-audio AudioModule declaration was not found");
  next = next.replace(anchor, AUDIO_HELPER + anchor);
  return next;
}

function patchNav(source) {
  if (source.includes(MARKER)) return source;
  let next = source;
  if (!next.includes("#import <objc/message.h>\n")) {
    next = next.replace('#import "NavModule.h"\n', '#import "NavModule.h"\n#import <objc/message.h>\n');
  }
  const anchor = "@implementation NavModule";
  if (!next.includes(anchor)) throw new Error("NavModule implementation was not found");
  next = next.replace(anchor, NAV_HELPER + anchor);
  const created = `    self->_session = session;
    if (_navigationSessionReadyCallback) {`;
  const noted = `    self->_session = session;
    CamAlertSetNavigationSession(YES);
    if (_navigationSessionReadyCallback) {`;
  if (!next.includes(created)) throw new Error("navigation session assignment was not found");
  next = next.replace(created, noted);
  const missing = `    if (self->_session == nil) {
      reject(kNoNavigatorErrorCode, kNoNavigatorErrorMessage, nil);
      return;
    }`;
  const missingClear = `    if (self->_session == nil) {
      CamAlertSetNavigationSession(NO);
      reject(kNoNavigatorErrorCode, kNoNavigatorErrorMessage, nil);
      return;
    }`;
  if (!next.includes(missing)) throw new Error("navigation cleanup nil check was not found");
  next = next.replace(missing, missingClear);
  const destroyed = `    self->_session = nil;

    NavViewModule *navViewModule = [NavViewModule sharedInstance];`;
  const destroyedClear = `    self->_session = nil;
    CamAlertSetNavigationSession(NO);

    NavViewModule *navViewModule = [NavViewModule sharedInstance];`;
  if (!next.includes(destroyed)) throw new Error("navigation session destroy was not found");
  next = next.replace(destroyed, destroyedClear);
  return next;
}

function patchFile(file, patch) {
  if (!fs.existsSync(file)) return { applied: false, missing: true, file };
  const current = fs.readFileSync(file, "utf8");
  const next = patch(current);
  if (next !== current) fs.writeFileSync(file, next);
  return { applied: next !== current, missing: false, file };
}

function patchAudioSession() {
  return {
    audio: patchFile(AUDIO, patchAudio),
    navigation: patchFile(NAV, patchNav),
  };
}

module.exports = { patchAudio, patchNav, patchAudioSession };

if (require.main === module) {
  const result = patchAudioSession();
  if (result.audio.missing || result.navigation.missing) {
    console.error("audio session sources were not installed; the patch was not applied.");
    process.exit(1);
  }
  console.log(JSON.stringify({
    audio: result.audio.applied,
    navigation: result.navigation.applied,
  }));
}
