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
    let navigation = UINavigationController(rootViewController: HomeViewController())
    navigation.navigationBar.tintColor = UIColor(red: 0.08, green: 0.35, blue: 0.93, alpha: 1)
    window.rootViewController = navigation
    window.makeKeyAndVisible()
    self.window = window
  }
}
