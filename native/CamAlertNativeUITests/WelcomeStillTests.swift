import XCTest

final class WelcomeStillTests: XCTestCase {
  func testCleanWelcomeThenStart() {
    let app = XCUIApplication()
    app.launch()
    let still = app.images["welcome-still"]
    XCTAssertTrue(still.waitForExistence(timeout: 8), "Приветствие без картинки")

    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let allow = [
      "Allow While Using App", "При использовании приложения", "Allow Once",
      "Разрешить один раз", "Однократно", "Allow", "Разрешить", "OK",
      "Accept", "Принять", "Продолжить",
    ]
    let deadline = Date().addingTimeInterval(100)
    var started = false
    while Date() < deadline, !started {
      if app.buttons["Далее  →"].exists {
        app.buttons["Далее  →"].tap()
      } else if app.buttons["Продолжить  →"].exists {
        app.buttons["Продолжить  →"].tap()
      }
      for title in allow {
        for host in [springboard, app] {
          let button = host.buttons[title]
          if button.exists {
            button.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
          }
        }
      }
      let start = app.buttons["В путь"]
      if start.exists, !start.isEnabled {
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.42)).tap()
      }
      if start.exists, start.isEnabled {
        start.tap()
        started = true
        break
      }
      Thread.sleep(forTimeInterval: 1)
    }
    XCTAssertTrue(started, "Первое «В путь» не запустило навигацию")
    let status = app.staticTexts["Навигация начата"]
    XCTAssertTrue(status.waitForExistence(timeout: 8))
  }
}
