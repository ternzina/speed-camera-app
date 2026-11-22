import GoogleMaps
import GooglePlaces
import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    if let key = Bundle.main.object(forInfoDictionaryKey: "CamAlertNativeAPIKey") as? String,
       !key.isEmpty,
       !key.contains("$(") {
      GMSServices.provideAPIKey(key)
      GMSPlacesClient.provideAPIKey(key)
    }
    return true
  }

  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    UISceneConfiguration(name: "Default", sessionRole: connectingSceneSession.role)
  }
}
