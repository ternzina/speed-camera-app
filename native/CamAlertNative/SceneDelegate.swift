import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    let window = UIWindow(windowScene: windowScene)
    if UserDefaults.standard.bool(forKey: "camalert.welcome.done") || ProcessInfo.processInfo.arguments.contains("--voice-check") {
      window.rootViewController = CamAlertShellController()
    } else {
      window.rootViewController = WelcomeViewController()
    }
    window.makeKeyAndVisible()
    self.window = window
  }

  func showApp() {
    window?.rootViewController = CamAlertShellController()
  }
}
