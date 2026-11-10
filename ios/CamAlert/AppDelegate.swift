internal import Expo
import Foundation
import React
import ReactAppDependencyProvider
import GoogleMaps

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // The store archive injects CamAlertGoogleNavKey into a temporary Info.plist.
    // The value is never stored in git and is never logged.
    if let key = Bundle.main.object(forInfoDictionaryKey: "CamAlertGoogleNavKey") as? String, !key.isEmpty {
      GMSServices.provideAPIKey(key)
      UserDefaults.standard.set(key, forKey: "CamAlertGoogleNavKey")
    }
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    startTripClassLog()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Reads the trip screen's UIView classes. It does not change touches, location, speech, or alerts.
  private var classLogTimer: Timer?
  private var classLogSeen = Set<ObjectIdentifier>()

  private func startTripClassLog() {
    classLogTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
      self?.scanTripClassLog()
    }
  }

  private func scanTripClassLog() {
    guard let window else { return }
    func walk(_ view: UIView) {
      if view.accessibilityIdentifier == "DriveModeScreenRoot" {
        let id = ObjectIdentifier(view)
        if !classLogSeen.contains(id) {
          classLogSeen.insert(id)
          logTripClasses(view, pass: "shown")
          DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak view] in
            guard let view, view.window != nil else { return }
            self.logTripClasses(view, pass: "1s")
          }
        }
      }
      for child in view.subviews { walk(child) }
    }
    walk(window)
  }

  private func logTripClasses(_ root: UIView, pass: String) {
    logClassLine(pass: pass, role: "root", view: root)
    guard let parent = root.superview else {
      appendClassLog("CAMALERT_CLASS \(pass) superview none")
      return
    }
    logClassLine(pass: pass, role: "superview", view: parent)
    for (index, sibling) in parent.subviews.enumerated() {
      let role = sibling === root ? "sibling \(index) root" : "sibling \(index)"
      logClassLine(pass: pass, role: role, view: sibling)
    }
  }

  private func logClassLine(pass: String, role: String, view: UIView) {
    let frame = view.frame
    let line = String(
      format: "CAMALERT_CLASS %@ %@ %@ frame={{%.1f,%.1f},{%.1f,%.1f}} interaction=%d subviews=%lu",
      pass,
      role,
      NSStringFromClass(type(of: view)),
      frame.origin.x,
      frame.origin.y,
      frame.size.width,
      frame.size.height,
      view.isUserInteractionEnabled ? 1 : 0,
      UInt(view.subviews.count)
    )
    appendClassLog(line)
  }

  private func appendClassLog(_ line: String) {
    NSLog("%@", line)
    let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("camalert-class-log.txt")
    let data = Data((line + "\n").utf8)
    if FileManager.default.fileExists(atPath: url.path), let handle = try? FileHandle(forWritingTo: url) {
      handle.seekToEndOfFile()
      handle.write(data)
      try? handle.close()
    } else {
      try? data.write(to: url)
    }
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
