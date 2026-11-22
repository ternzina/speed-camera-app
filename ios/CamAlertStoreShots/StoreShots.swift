import XCTest
import CoreLocation

final class StoreShots: XCTestCase {
  let app = XCUIApplication(bundleIdentifier: "com.21wek.camera")

  func testCaptureEnglishScreens() throws {
    app.launch()
    dismissWelcome()
    allowLocationIfNeeded()
    switchToEnglishIfNeeded()
    guard app.staticTexts["Ready to go"].waitForExistence(timeout: 8) else {
      try? app.debugDescription.write(toFile: "/tmp/camalert-shots/hierarchy-fail.txt", atomically: true, encoding: .utf8)
      shot("01-home-fail")
      XCTFail("English home did not appear")
      return
    }
    shot("01-home")

    if !tapContaining("Ukraine") {
      app.swipeUp()
      _ = tapContaining("Ukraine")
    }
    sleep(2)
    shot("03-countries")

    tapTab(["Map", "Карта"])
    sleep(4)
    shot("02-map")

    tapTab(["Settings", "Настройки"])
    sleep(1)
    scrollUntil(any: ["Voice", "Голос"])
    shot("04-settings-voice")

    tapTab(["Поездка"])
    sleep(1)
    allowLocationIfNeeded()
    if !tapContaining("Start trip") { tapContaining("Начать поездку") }
    allowLocationIfNeeded()
    sleep(1)
    driveTowardKyivCamera()
    sleep(3)
    shot("05-trip")
  }

  func testCaptureUkrainian() throws {
    try capture(code: "UA", home: "У дорогу!", country: "Україна", map: ["Карта"], settings: ["Налаштування", "Settings", "Настройки", "Ustawienia"], voice: ["Голос"], start: "Почати поїздку")
  }

  func testCapturePolish() throws {
    try capture(code: "PL", home: "W drogę!", country: "Ukraina", map: ["Mapa", "Карта"], settings: ["Ustawienia", "Settings", "Настройки", "Налаштування"], voice: ["Głos", "Голос"], start: "Rozpocznij jazdę")
  }

  func testCaptureRussian() throws {
    try capture(code: "RU", home: "В путь!", country: "Украина", map: ["Карта"], settings: ["Настройки", "Settings", "Налаштування", "Ustawienia"], voice: ["Голос"], start: "Начать поездку")
  }

  func testDiagnosticTripFreeze() throws {
    continueAfterFailure = true
    if app.state == .notRunning { app.launch() } else { app.activate() }
    dismissWelcome()
    allowLocationIfNeeded()
    print("CAMALERT_DIAG_BEFORE\n" + app.debugDescription + "\nCAMALERT_DIAG_BEFORE_END")
    let startLabels = ["Начать поездку", "Почати поїздку", "Rozpocznij jazdę", "Start trip"]
    var started = false
    for label in startLabels where tapContaining(label) {
      print("CAMALERT_DIAG_TAPPED \(label)")
      started = true
      break
    }
    if !started { print("CAMALERT_DIAG_NO_START") }
    allowLocationIfNeeded()
    sleep(20)
    print("CAMALERT_DIAG_AFTER\n" + app.debugDescription + "\nCAMALERT_DIAG_AFTER_END")
    let endLabels = ["Завершить поездку", "Завершити поїздку", "Zakończ jazdę", "End trip", "Finish trip"]
    var ended = false
    for label in endLabels {
      let button = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", label)).firstMatch
      guard button.exists else { continue }
      print("CAMALERT_DIAG_END exists=1 hittable=\(button.isHittable ? 1 : 0)")
      if button.isHittable {
        button.tap()
        ended = true
        print("CAMALERT_DIAG_END_TAPPED \(label)")
      }
    }
    if !ended { print("CAMALERT_DIAG_END_NOT_TAPPED") }
    sleep(2)
    print("CAMALERT_DIAG_FINAL\n" + app.debugDescription + "\nCAMALERT_DIAG_FINAL_END")
  }

  func testDismissBackgroundGuide() throws {
    continueAfterFailure = true
    if app.state == .notRunning { app.launch() } else { app.activate() }
    sleep(1)
    print("CAMALERT_LATER_BEFORE\n" + app.debugDescription + "\nCAMALERT_LATER_BEFORE_END")
    let later = app.buttons.matching(NSPredicate(format: "label == %@", "Позже"))
    let openSettings = app.buttons.matching(NSPredicate(format: "label == %@", "Открыть настройки"))
    print("CAMALERT_LATER_COUNT \(later.count) OPEN_COUNT \(openSettings.count)")
    var sheetHittable = false
    for index in 0..<later.count {
      let button = later.element(boundBy: index)
      print("CAMALERT_LATER \(index) hittable=\(button.isHittable ? 1 : 0) frame=\(button.frame)")
      if button.isHittable { sheetHittable = true }
    }
    if openSettings.count > 0 {
      let button = openSettings.element(boundBy: 0)
      print("CAMALERT_OPEN hittable=\(button.isHittable ? 1 : 0) frame=\(button.frame)")
      if button.isHittable { sheetHittable = true }
    }
    guard sheetHittable else {
      print("CAMALERT_SHEET_BUTTONS_NOT_HITTABLE")
      return
    }
    var tappedLater = false
    for index in 0..<later.count {
      let button = later.element(boundBy: index)
      if button.isHittable && button.frame.height < 120 {
        button.tap()
        tappedLater = true
        print("CAMALERT_LATER_TAPPED card")
        break
      }
    }
    if !tappedLater {
      for index in 0..<later.count {
        let button = later.element(boundBy: index)
        if button.isHittable {
          button.tap()
          print("CAMALERT_LATER_TAPPED shade")
          break
        }
      }
    }
    sleep(2)
    print("CAMALERT_AFTER_LATER\n" + app.debugDescription + "\nCAMALERT_AFTER_LATER_END")
    let end = app.buttons.matching(NSPredicate(format: "label == %@", "Завершить поездку")).firstMatch
    if end.exists {
      print("CAMALERT_END1 exists=1 hittable=\(end.isHittable ? 1 : 0)")
      if end.isHittable {
        end.tap()
        print("CAMALERT_END1_TAPPED")
      } else {
        print("CAMALERT_END1_NOT_TAPPED")
      }
    } else {
      print("CAMALERT_END1 exists=0")
    }
    sleep(2)
    print("CAMALERT_AFTER_END1\n" + app.debugDescription + "\nCAMALERT_AFTER_END1_END")
    let startLabels = ["Начать поездку", "Почати поїздку", "Rozpocznij jazdę", "Start trip"]
    var started = false
    for label in startLabels where tapContaining(label) {
      print("CAMALERT_START2 \(label)")
      started = true
      break
    }
    if !started { print("CAMALERT_START2_NO") }
    sleep(4)
    print("CAMALERT_TRIP2\n" + app.debugDescription + "\nCAMALERT_TRIP2_END")
    let later2 = app.buttons.matching(NSPredicate(format: "label == %@", "Позже"))
    print("CAMALERT_SHEET2 \(later2.count)")
    var sheet2Hittable = false
    for index in 0..<later2.count {
      let button = later2.element(boundBy: index)
      print("CAMALERT_LATER2 \(index) hittable=\(button.isHittable ? 1 : 0) frame=\(button.frame)")
      if button.isHittable { sheet2Hittable = true }
    }
    if later2.count > 0 && !sheet2Hittable {
      print("CAMALERT_SHEET2_NOT_HITTABLE")
      return
    }
    if later2.count > 0 {
      var tapped = false
      for index in 0..<later2.count {
        let button = later2.element(boundBy: index)
        if button.isHittable && button.frame.height < 120 {
          button.tap()
          tapped = true
          print("CAMALERT_LATER2_TAPPED card")
          break
        }
      }
      if !tapped {
        for index in 0..<later2.count where later2.element(boundBy: index).isHittable {
          later2.element(boundBy: index).tap()
          print("CAMALERT_LATER2_TAPPED shade")
          break
        }
      }
      sleep(2)
    }
    let end2 = app.buttons.matching(NSPredicate(format: "label == %@", "Завершить поездку")).firstMatch
    if end2.exists {
      print("CAMALERT_END2 exists=1 hittable=\(end2.isHittable ? 1 : 0)")
      if end2.isHittable {
        end2.tap()
        print("CAMALERT_END2_TAPPED")
      } else {
        print("CAMALERT_END2_NOT_TAPPED")
      }
    } else {
      print("CAMALERT_END2 exists=0")
    }
    sleep(2)
    print("CAMALERT_FINAL2\n" + app.debugDescription + "\nCAMALERT_FINAL2_END")
  }

  func testTripWarningPath() throws {
    continueAfterFailure = true
    if app.state == .notRunning { app.launch() } else { app.activate() }
    sleep(1)
    dismissWelcome()
    allowLocationIfNeeded()
    dismissGuideIfNeeded(tag: "before")
    let start = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Начать поездку")).firstMatch
    if start.exists {
      print("CAMALERT_WARN_START hittable=\(start.isHittable ? 1 : 0)")
      guard start.isHittable else {
        print("CAMALERT_WARN_START_NOT_HITTABLE")
        return
      }
      start.tap()
      sleep(2)
      allowLocationIfNeeded()
      dismissGuideIfNeeded(tag: "after-start")
    } else {
      print("CAMALERT_WARN_ALREADY_TRIP")
    }
    let voice = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Голос")).firstMatch
    if voice.exists { print("CAMALERT_WARN_VOICE \(voice.label)") }
    let background = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Фон:")).firstMatch
    if background.exists { print("CAMALERT_WARN_BG \(background.label)") }
    var sawWarning = false
    for step in 0...8 {
      let fraction = Double(step) / 8
      let point = CLLocation(
        coordinate: CLLocationCoordinate2D(
          latitude: 50.4752 + (50.47965 - 50.4752) * fraction,
          longitude: 30.45353
        ),
        altitude: 180,
        horizontalAccuracy: 5,
        verticalAccuracy: 5,
        course: 0,
        speed: 15,
        timestamp: Date()
      )
      XCUIDevice.shared.location = XCUILocation(location: point)
      sleep(1)
      let labels = ["Камера впереди", "Камера через", "Внимание", "Снизьте скорость", "Лимит камеры"]
      for label in labels {
        let match = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", label)).firstMatch
        if match.exists {
          sawWarning = true
          print("CAMALERT_WARN_SHOWN step=\(step) \(match.label)")
        }
      }
      if sawWarning { break }
    }
    if !sawWarning { print("CAMALERT_WARN_NOT_SHOWN") }
    print("CAMALERT_WARN_FOREGROUND\n" + app.debugDescription + "\nCAMALERT_WARN_FOREGROUND_END")
    XCUIDevice.shared.press(.home)
    sleep(1)
    print("CAMALERT_WARN_HOME state=\(app.state.rawValue)")
    for step in 0...4 {
      let point = CLLocation(
        coordinate: CLLocationCoordinate2D(latitude: 50.477 + Double(step) * 0.0004, longitude: 30.45353),
        altitude: 180, horizontalAccuracy: 5, verticalAccuracy: 5, course: 0, speed: 15, timestamp: Date()
      )
      XCUIDevice.shared.location = XCUILocation(location: point)
      sleep(1)
    }
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let banner = springboard.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Камера")).firstMatch
    print("CAMALERT_WARN_BANNER exists=\(banner.exists ? 1 : 0) \(banner.exists ? banner.label : "")")
    app.activate()
    sleep(2)
    let end = app.buttons.matching(NSPredicate(format: "label == %@", "Завершить поездку")).firstMatch
    if end.exists {
      print("CAMALERT_WARN_END hittable=\(end.isHittable ? 1 : 0)")
      if end.isHittable {
        end.tap()
        print("CAMALERT_WARN_END_TAPPED")
      }
    } else {
      print("CAMALERT_WARN_END exists=0")
    }
    sleep(2)
    let home = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Начать поездку")).firstMatch
    print("CAMALERT_WARN_HOME_AGAIN exists=\(home.exists ? 1 : 0)")
  }

  func testIdleBackgroundSpeech() throws {
    continueAfterFailure = true
    if app.state == .notRunning { app.launch() } else { app.activate() }
    sleep(1)
    dismissWelcome()
    allowLocationIfNeeded()
    dismissGuideIfNeeded(tag: "idle-before")
    let start = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Начать поездку")).firstMatch
    if start.exists {
      print("CAMALERT_IDLE_START hittable=\(start.isHittable ? 1 : 0)")
      guard start.isHittable else {
        print("CAMALERT_IDLE_START_NOT_HITTABLE")
        return
      }
      start.tap()
      sleep(2)
      allowLocationIfNeeded()
      dismissGuideIfNeeded(tag: "idle-after")
    } else {
      print("CAMALERT_IDLE_ALREADY_TRIP")
    }
    func point(_ latitude: Double) -> CLLocation {
      CLLocation(
        coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: 30.45353),
        altitude: 180,
        horizontalAccuracy: 5,
        verticalAccuracy: 5,
        course: 0,
        speed: 15,
        timestamp: Date()
      )
    }
    var sawForeground = false
    for _ in 0..<6 {
      XCUIDevice.shared.location = XCUILocation(location: point(50.47785))
      sleep(1)
      let shown = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Внимание")).firstMatch
      if shown.exists {
        sawForeground = true
        print("CAMALERT_IDLE_FOREGROUND \(shown.label)")
        break
      }
    }
    if !sawForeground { print("CAMALERT_IDLE_FOREGROUND shown=0") }
    print("CAMALERT_IDLE_WAIT_SPEECH")
    for _ in 0..<16 {
      XCUIDevice.shared.location = XCUILocation(location: point(50.47785))
      sleep(1)
    }
    print("CAMALERT_IDLE_HOME")
    XCUIDevice.shared.press(.home)
    sleep(2)
    for _ in 0..<4 {
      XCUIDevice.shared.location = XCUILocation(location: point(50.4788))
      sleep(1)
    }
    print("CAMALERT_IDLE_BG_SENT")
    sleep(18)
    print("CAMALERT_IDLE_BG_WAIT_DONE")
    app.activate()
    sleep(2)
    let end = app.buttons.matching(NSPredicate(format: "label == %@", "Завершить поездку")).firstMatch
    if end.exists && end.isHittable {
      end.tap()
      print("CAMALERT_IDLE_END_TAPPED")
    } else {
      print("CAMALERT_IDLE_END exists=\(end.exists ? 1 : 0)")
    }
  }

  func testRegressionRemainder() throws {
    continueAfterFailure = true
    app.activate()
    sleep(1)
    dismissWelcome()
    for _ in 0..<4 {
      let end = app.buttons["Завершить поездку"].firstMatch
      if end.exists && end.isHittable { end.tap(); sleep(1); continue }
      if app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Начать поездку")).firstMatch.exists { break }
      if app.staticTexts["Голос"].exists || app.staticTexts["Страны и данные"].exists { break }
      if let back = hittableBack() { back.tap(); sleep(1); continue }
      break
    }
    var voice = app.staticTexts.matching(NSPredicate(format: "label == %@", "Голос")).element(boundBy: 0)
    if !voice.exists {
      let settings = app.buttons["Настройки"].firstMatch
      guard settings.waitForExistence(timeout: 8), settings.isHittable else {
        var labels: [String] = []
        let buttons = app.buttons
        for index in 0..<min(buttons.count, 20) {
          let item = buttons.element(boundBy: index)
          if item.exists && !item.label.isEmpty { labels.append(item.label) }
        }
        print("CAMALERT_REST_SETTINGS 0 buttons=\(labels.joined(separator: " | "))")
        return
      }
      settings.tap()
      sleep(1)
      print("CAMALERT_REST_SETTINGS 1")
    } else {
      print("CAMALERT_REST_SETTINGS already")
    }
    for _ in 0..<5 {
      if voice.exists { break }
      app.swipeUp()
      voice = app.staticTexts.matching(NSPredicate(format: "label == %@", "Голос")).element(boundBy: 0)
    }
    print("CAMALERT_REST_VOICE_LABEL exists=\(voice.exists ? 1 : 0)")
    if voice.exists, let voiceSwitch = switchNear(voice) {
      let before = voiceSwitch.value as? String ?? ""
      print("CAMALERT_REST_VOICE_BEFORE \(before)")
      voiceSwitch.tap()
      sleep(1)
      let mid = voiceSwitch.value as? String ?? ""
      print("CAMALERT_REST_VOICE_MID \(mid)")
      if mid != "1" { voiceSwitch.tap(); sleep(1) }
      print("CAMALERT_REST_VOICE_AFTER \(voiceSwitch.value as? String ?? "")")
    } else {
      print("CAMALERT_REST_VOICE_SWITCH 0")
    }
    for _ in 0..<4 { app.swipeDown() }
    sleep(1)
    var openedCountries = tapExactLabel("Страны")
    if !openedCountries {
      let countriesLabel = app.staticTexts["Страны"].firstMatch
      if countriesLabel.exists {
        countriesLabel.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        openedCountries = true
      }
    }
    print("CAMALERT_REST_COUNTRIES_TAB \(openedCountries ? 1 : 0)")
    sleep(1)
    let saved = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Сохранено стран")).element(boundBy: 0)
    print("CAMALERT_REST_SAVED \(saved.exists ? saved.label : "0")")
    var ukraine = false
    var poland = false
    var offline = 0
    let countryButtons = app.buttons
    for index in 0..<min(countryButtons.count, 24) {
      let item = countryButtons.element(boundBy: index)
      guard item.exists else { continue }
      let label = item.label.replacingOccurrences(of: "\n", with: " ")
      if label.contains("Украина") { ukraine = true }
      if label.contains("Польша") { poland = true }
      if label.contains("Доступна без интернета") { offline += 1 }
      if label.contains("Украина") || label.contains("Польша") || label.contains("Удалить базу") {
        print("CAMALERT_REST_COUNTRY \(label)")
      }
    }
    print("CAMALERT_REST_DATA ukraine=\(ukraine ? 1 : 0) poland=\(poland ? 1 : 0) offlineRows=\(offline)")
    for _ in 0..<4 { app.swipeDown() }
    if let back = hittableBack() { back.tap(); sleep(1); print("CAMALERT_REST_SETTINGS_BACK 1") }
    else { print("CAMALERT_REST_SETTINGS_BACK 0") }
    let start = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Начать поездку")).firstMatch
    if start.waitForExistence(timeout: 6), start.isHittable {
      start.tap()
      sleep(1)
      dismissGuideIfNeeded(tag: "rest-bg")
      XCUIDevice.shared.press(.home)
      sleep(1)
      let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
      print("CAMALERT_REST_BG springboard=\(springboard.wait(for: .runningForeground, timeout: 5) ? 1 : 0)")
      app.activate()
      sleep(1)
      let end = app.buttons["Завершить поездку"].firstMatch
      if end.waitForExistence(timeout: 6), end.isHittable { end.tap(); print("CAMALERT_REST_BG_BACK 1") }
      else { print("CAMALERT_REST_BG_BACK 0") }
    } else {
      print("CAMALERT_REST_BG start=0")
    }
    app.terminate()
    sleep(1)
    app.launch()
    sleep(1)
    dismissWelcome()
    let relaunch = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Начать поездку")).firstMatch
    print("CAMALERT_REST_RELAUNCH exists=\(relaunch.waitForExistence(timeout: 10) ? 1 : 0)")
    print("CAMALERT_REST_DONE")
  }

  func testRegressionPass() throws {
    continueAfterFailure = true
    app.launch()
    sleep(1)
    dismissWelcome()
    allowLocationIfNeeded()
    let homeBack = app.buttons["Назад"].firstMatch
    print("CAMALERT_REG_HOME_BACK exists=\(homeBack.waitForExistence(timeout: 8) ? 1 : 0) hittable=\(homeBack.exists && homeBack.isHittable ? 1 : 0)")
    var starts = 0
    var ends = 0
    for cycle in 1...10 {
      if cycle == 1 { exerciseTripControls(cycle) }
      let start = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Начать поездку")).firstMatch
      guard start.waitForExistence(timeout: 8), start.isHittable else {
        print("CAMALERT_REG_CYCLE \(cycle) start=0")
        break
      }
      start.tap()
      starts += 1
      sleep(1)
      allowLocationIfNeeded()
      dismissGuideIfNeeded(tag: "reg-\(cycle)")
      if cycle == 1 {
        let gps = app.staticTexts["Подключён"]
        let searching = app.staticTexts["Поиск сигнала…"]
        print("CAMALERT_REG_GPS connected=\(gps.exists ? 1 : 0) searching=\(searching.exists ? 1 : 0)")
        if !gps.exists {
          XCUIDevice.shared.location = XCUILocation(location: stationaryPoint(50.45))
          sleep(2)
          print("CAMALERT_REG_GPS_SIM connected=\(gps.exists ? 1 : 0)")
        }
        let zoomIn = app.buttons["Увеличить карту"]
        let zoomOut = app.buttons["Уменьшить карту"]
        let center = app.buttons["К автомобилю"]
        print("CAMALERT_REG_ZOOM in=\(zoomIn.exists && zoomIn.isHittable ? 1 : 0) out=\(zoomOut.exists && zoomOut.isHittable ? 1 : 0) center=\(center.exists && center.isHittable ? 1 : 0)")
        if zoomIn.isHittable { zoomIn.tap() }
        if zoomOut.isHittable { zoomOut.tap() }
        app.swipeLeft()
        app.swipeRight()
        print("CAMALERT_REG_PAN swiped=1")
      }
      let back = app.buttons["Назад"].firstMatch
      let end = app.buttons["Завершить поездку"].firstMatch
      let backOk = back.waitForExistence(timeout: 6) && back.isHittable
      let endOk = end.exists && end.isHittable
      print("CAMALERT_REG_CYCLE \(cycle) back=\(backOk ? 1 : 0) end=\(endOk ? 1 : 0)")
      guard endOk else { break }
      end.tap()
      ends += 1
      sleep(1)
    }
    print("CAMALERT_REG_TRIPS starts=\(starts) ends=\(ends)")
    let startAgain = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Начать поездку")).firstMatch
    guard startAgain.waitForExistence(timeout: 8), startAgain.isHittable else {
      print("CAMALERT_REG_WARN start=0")
      return
    }
    startAgain.tap()
    sleep(1)
    dismissGuideIfNeeded(tag: "reg-warn")
    for _ in 0..<3 {
      XCUIDevice.shared.location = XCUILocation(location: stationaryPoint(50.47785))
      sleep(1)
    }
    let warning = app.staticTexts["Внимание!"].exists
    var distance = ""
    for item in app.staticTexts.matching(NSPredicate(format: "label ENDSWITH %@", " м")).allElementsBoundByIndex.prefix(6) where item.exists {
      if item.label.range(of: #"^\d+ м$"#, options: .regularExpression) != nil { distance = item.label; break }
    }
    print("CAMALERT_REG_WARN shown=\(warning ? 1 : 0) distance=\(distance) simulated=1")
    sleep(6)
    let endWarn = app.buttons["Завершить поездку"].firstMatch
    if endWarn.exists && endWarn.isHittable { endWarn.tap() }
    sleep(1)
    app.buttons["Настройки"].firstMatch.tap()
    sleep(1)
    for _ in 0..<4 {
      if app.staticTexts["Голос"].exists { break }
      app.swipeUp()
    }
    let voice = app.staticTexts.matching(NSPredicate(format: "label == %@", "Голос")).element(boundBy: 0)
    print("CAMALERT_REG_VOICE_LABEL exists=\(voice.exists ? 1 : 0)")
    if voice.exists {
      let voiceSwitch = switchNear(voice)
      if let voiceSwitch {
        let before = voiceSwitch.value as? String ?? ""
        print("CAMALERT_REG_VOICE_BEFORE \(before)")
        voiceSwitch.tap()
        sleep(1)
        let mid = voiceSwitch.value as? String ?? ""
        print("CAMALERT_REG_VOICE_MID \(mid)")
        if mid == "0" || mid == "0.0" { voiceSwitch.tap(); sleep(1) }
        let after = voiceSwitch.value as? String ?? ""
        print("CAMALERT_REG_VOICE_AFTER \(after)")
      } else {
        print("CAMALERT_REG_VOICE_SWITCH 0")
      }
    }
    app.buttons["Назад"].firstMatch.tap()
    sleep(1)
    let country = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Украина")).firstMatch
    if country.waitForExistence(timeout: 4) { country.tap(); sleep(1) }
    let ukraine = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Украина")).firstMatch.exists
    let poland = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Польша")).firstMatch.exists
    let offline = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Доступна без интернета")).count
    print("CAMALERT_REG_DATA ukraine=\(ukraine ? 1 : 0) poland=\(poland ? 1 : 0) offlineRows=\(offline)")
    app.buttons["Назад"].firstMatch.tap()
    sleep(1)
    let bgStart = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Начать поездку")).firstMatch
    if bgStart.waitForExistence(timeout: 6), bgStart.isHittable {
      bgStart.tap()
      sleep(1)
      dismissGuideIfNeeded(tag: "reg-bg")
      XCUIDevice.shared.press(.home)
      sleep(1)
      let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
      print("CAMALERT_REG_BG springboard=\(springboard.wait(for: .runningForeground, timeout: 5) ? 1 : 0)")
      app.activate()
      sleep(1)
      let end = app.buttons["Завершить поездку"].firstMatch
      if end.waitForExistence(timeout: 6), end.isHittable { end.tap(); print("CAMALERT_REG_BG_BACK 1") }
      else { print("CAMALERT_REG_BG_BACK 0") }
    }
    app.terminate()
    sleep(1)
    app.launch()
    sleep(1)
    dismissWelcome()
    let relaunch = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Начать поездку")).firstMatch
    print("CAMALERT_REG_RELAUNCH exists=\(relaunch.waitForExistence(timeout: 10) ? 1 : 0)")
    print("CAMALERT_REG_DONE")
  }

  func exerciseTripControls(_ cycle: Int) {}

  func stationaryPoint(_ latitude: Double) -> CLLocation {
    CLLocation(
      coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: 30.45353),
      altitude: 180, horizontalAccuracy: 5, verticalAccuracy: 5,
      course: 0, speed: 15, timestamp: Date()
    )
  }

  func tapExactLabel(_ label: String) -> Bool {
    let pred = NSPredicate(format: "label == %@", label)
    let queries = [app.buttons.matching(pred), app.otherElements.matching(pred), app.staticTexts.matching(pred)]
    for query in queries {
      for index in 0..<min(query.count, 4) {
        let item = query.element(boundBy: index)
        if item.exists && item.isHittable {
          item.tap()
          return true
        }
      }
    }
    return false
  }

  func switchNear(_ label: XCUIElement) -> XCUIElement? {
    let switches = app.switches
    var best: XCUIElement?
    var bestGap = CGFloat.greatestFiniteMagnitude
    for index in 0..<switches.count {
      let item = switches.element(boundBy: index)
      guard item.exists else { continue }
      let gap = abs(item.frame.midY - label.frame.midY)
      if gap < bestGap && gap < 40 {
        bestGap = gap
        best = item
      }
    }
    return best
  }

  func testBackgroundMoveOffscreen() throws {
    continueAfterFailure = true
    XCUIDevice.shared.press(.home)
    sleep(1)
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    print("CAMALERT_BG2_OFFSCREEN springboard=\(springboard.wait(for: .runningForeground, timeout: 5) ? 1 : 0)")
    let start = 50.47785
    for step in 1...4 {
      let latitude = start + Double(step) * 0.00030
      let point = CLLocation(
        coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: 30.45353),
        altitude: 180, horizontalAccuracy: 5, verticalAccuracy: 5,
        course: 0, speed: 15, timestamp: Date()
      )
      XCUIDevice.shared.location = XCUILocation(location: point)
      sleep(2)
    }
    print("CAMALERT_BG2_SENT")
    sleep(12)
    print("CAMALERT_BG2_DONE")
  }

  func testBackgroundUtteranceOffscreen() throws {
    continueAfterFailure = true
    app.launch()
    sleep(1)
    dismissWelcome()
    allowLocationIfNeeded()
    dismissGuideIfNeeded(tag: "bg-home")
    let start = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Начать поездку")).firstMatch
    guard start.waitForExistence(timeout: 8), start.isHittable else {
      print("CAMALERT_BG_START 0")
      return
    }
    start.tap()
    sleep(2)
    allowLocationIfNeeded()
    dismissGuideIfNeeded(tag: "bg-trip")
    let background = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Фон:")).firstMatch
    if background.exists { print("CAMALERT_BG_LABEL \(background.label)") }
    func point(_ latitude: Double) -> CLLocation {
      CLLocation(
        coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: 30.45353),
        altitude: 180, horizontalAccuracy: 5, verticalAccuracy: 5,
        course: 0, speed: 15, timestamp: Date()
      )
    }
    var saw = false
    for _ in 0..<8 {
      XCUIDevice.shared.location = XCUILocation(location: point(50.47785))
      sleep(1)
      let warning = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Внимание")).firstMatch
      if warning.exists {
        saw = true
        print("CAMALERT_BG_FOREGROUND \(warning.label)")
        let distance = app.staticTexts.matching(NSPredicate(format: "label ENDSWITH %@", " м")).allElementsBoundByIndex
        for item in distance.prefix(4) where item.exists { print("CAMALERT_BG_DISTANCE \(item.label)") }
        break
      }
    }
    if !saw { print("CAMALERT_BG_FOREGROUND 0") }
    print("CAMALERT_BG_WAIT")
    for _ in 0..<18 {
      XCUIDevice.shared.location = XCUILocation(location: point(50.47785))
      sleep(1)
    }
    print("CAMALERT_BG_HOME")
    XCUIDevice.shared.press(.home)
    sleep(1)
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let homeFront = springboard.wait(for: .runningForeground, timeout: 5)
    print("CAMALERT_BG_OFFSCREEN springboard=\(homeFront ? 1 : 0)")
    for _ in 0..<4 {
      XCUIDevice.shared.location = XCUILocation(location: point(50.47785))
      sleep(1)
    }
    print("CAMALERT_BG_SENT")
    sleep(14)
    print("CAMALERT_BG_DONE")
  }

  func testMapWarningsAndBack() throws {
    continueAfterFailure = true
    app.launch()
    sleep(1)
    dismissWelcome()
    allowLocationIfNeeded()
    dismissGuideIfNeeded(tag: "maps-home")
    let start = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Начать поездку")).firstMatch
    guard start.waitForExistence(timeout: 8), start.isHittable else {
      print("CAMALERT_MAP_START_MISSING")
      return
    }
    start.tap()
    sleep(2)
    allowLocationIfNeeded()
    dismissGuideIfNeeded(tag: "maps-trip")
    func point(_ latitude: Double) -> CLLocation {
      CLLocation(
        coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: 30.45353),
        altitude: 180, horizontalAccuracy: 5, verticalAccuracy: 5,
        course: 0, speed: 15, timestamp: Date()
      )
    }
    var sawWarning = false
    var sawVoice = false
    for _ in 0..<8 {
      XCUIDevice.shared.location = XCUILocation(location: point(50.47785))
      sleep(1)
      let warning = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Внимание")).firstMatch
      let voice = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Голосовое предупреждение")).firstMatch
      if warning.exists { sawWarning = true; print("CAMALERT_APPLE_SHOWN \(warning.label)") }
      if voice.exists { sawVoice = true; print("CAMALERT_APPLE_VOICE \(voice.label)") }
      if sawWarning && sawVoice { break }
    }
    if !sawWarning { print("CAMALERT_APPLE_SHOWN 0") }
    if !sawVoice { print("CAMALERT_APPLE_VOICE 0") }
    let tripBack = hittableBack()
    print("CAMALERT_APPLE_BACK exists=\(tripBack == nil ? 0 : 1) \(tripBack.map { "frame=\($0.frame)" } ?? "")")
    tripBack?.tap()
    sleep(2)
    let home = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Начать поездку")).firstMatch
    print("CAMALERT_APPLE_LEFT exists=\(home.exists ? 1 : 0)")
    let googleCard = app.buttons["Google Maps"]
    guard googleCard.waitForExistence(timeout: 8) else { print("CAMALERT_GOOGLE_CARD 0"); return }
    googleCard.tap()
    let sheet = app.staticTexts["Выберите навигатор"]
    print("CAMALERT_GOOGLE_SHEET exists=\(sheet.waitForExistence(timeout: 8) ? 1 : 0)")
    let sheetBack = hittableBack()
    print("CAMALERT_GOOGLE_BACK exists=\(sheetBack == nil ? 0 : 1) \(sheetBack.map { "frame=\($0.frame)" } ?? "")")
    sheetBack?.tap()
    sleep(1)
    print("CAMALERT_GOOGLE_SHEET_AFTER exists=\(sheet.exists ? 1 : 0)")
    googleCard.tap()
    let launch = app.buttons["Google Maps. Открыть в Google Maps"]
    guard launch.waitForExistence(timeout: 8), launch.isHittable else {
      print("CAMALERT_GOOGLE_LAUNCH 0")
      return
    }
    launch.tap()
    sleep(2)
    allowLocationIfNeeded()
    let maps = XCUIApplication(bundleIdentifier: "com.google.Maps")
    let opened = maps.wait(for: .runningForeground, timeout: 20)
    print("CAMALERT_GOOGLE_APP opened=\(opened ? 1 : 0) state=\(maps.state.rawValue)")
    if opened {
      for step in 0...6 {
        let fraction = Double(step) / 6
        XCUIDevice.shared.location = XCUILocation(location: point(50.4752 + (50.4788 - 50.4752) * fraction))
        sleep(1)
      }
      sleep(12)
      let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
      let banner = springboard.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Камера")).firstMatch
      print("CAMALERT_GOOGLE_BANNER exists=\(banner.exists ? 1 : 0) \(banner.exists ? banner.label : "")")
    }
    print("CAMALERT_MAP_DONE")
  }

  func testAppleMapsAppTrip() throws {
    continueAfterFailure = true
    app.activate()
    sleep(1)
    dismissWelcome()
    allowLocationIfNeeded()
    dismissGuideIfNeeded(tag: "apple-app")
    if app.buttons["Завершить поездку"].exists {
      hittableBack()?.tap()
      sleep(1)
    }
    let apple = app.buttons["Apple Maps"]
    guard apple.waitForExistence(timeout: 12) else {
      print("CAMALERT_APPLE_APP_CARD 0")
      return
    }
    apple.tap()
    let sheet = app.staticTexts["Выберите навигатор"]
    print("CAMALERT_APPLE_APP_SHEET exists=\(sheet.waitForExistence(timeout: 8) ? 1 : 0)")
    let back = hittableBack()
    print("CAMALERT_APPLE_APP_BACK exists=\(back == nil ? 0 : 1) \(back.map { "frame=\($0.frame)" } ?? "")")
    back?.tap()
    sleep(1)
    print("CAMALERT_APPLE_APP_SHEET_AFTER exists=\(sheet.exists ? 1 : 0)")
    apple.tap()
    let launch = app.buttons["Apple Maps. Открыть в Apple Maps"]
    guard launch.waitForExistence(timeout: 8), launch.isHittable else {
      print("CAMALERT_APPLE_APP_LAUNCH 0")
      return
    }
    launch.tap()
    sleep(1)
    allowLocationIfNeeded()
    let maps = XCUIApplication(bundleIdentifier: "com.apple.Maps")
    let opened = maps.wait(for: .runningForeground, timeout: 25)
    print("CAMALERT_APPLE_APP opened=\(opened ? 1 : 0) state=\(maps.state.rawValue)")
    guard opened else { return }
    var sawBanner = false
    for step in 0...8 {
      let fraction = Double(step) / 8.0
      let point = CLLocation(
        coordinate: CLLocationCoordinate2D(latitude: 50.4752 + (50.4788 - 50.4752) * fraction, longitude: 30.45353),
        altitude: 180, horizontalAccuracy: 5, verticalAccuracy: 5, course: 0, speed: 15, timestamp: Date()
      )
      XCUIDevice.shared.location = XCUILocation(location: point)
      sleep(1)
      let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
      let banner = springboard.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Камера")).firstMatch
      if banner.exists {
        sawBanner = true
        print("CAMALERT_APPLE_APP_BANNER \(banner.label)")
        break
      }
      let inMaps = maps.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Камера")).firstMatch
      if inMaps.exists {
        sawBanner = true
        print("CAMALERT_APPLE_APP_BANNER_MAPS \(inMaps.label)")
        break
      }
    }
    if !sawBanner { print("CAMALERT_APPLE_APP_BANNER 0") }
    sleep(8)
    print("CAMALERT_APPLE_APP_DONE")
  }

  func hittableBack() -> XCUIElement? {
    let buttons = app.buttons.matching(NSPredicate(format: "label == %@", "Назад"))
    for index in 0..<buttons.count {
      let button = buttons.element(boundBy: index)
      if button.exists && button.isHittable { return button }
    }
    return nil
  }

  func dismissGuideIfNeeded(tag: String) {
    let later = app.buttons.matching(NSPredicate(format: "label == %@", "Позже"))
    guard later.count > 0 else { return }
    for index in 0..<later.count {
      let button = later.element(boundBy: index)
      print("CAMALERT_WARN_GUIDE \(tag) \(index) hittable=\(button.isHittable ? 1 : 0)")
      if button.isHittable && button.frame.height < 120 {
        button.tap()
        print("CAMALERT_WARN_GUIDE_TAPPED \(tag)")
        sleep(1)
        return
      }
    }
    print("CAMALERT_WARN_GUIDE_NOT_HITTABLE \(tag)")
  }

  func testCaptureHistoryAndLandscape() throws {
    app.launch()
    dismissWelcome()
    allowLocationIfNeeded()
    switchToEnglishIfNeeded()
    tapTab(["Settings", "Настройки"])
    sleep(1)
    if !tapContaining("History") { _ = tapContaining("История") }
    sleep(1)
    shot("06-history")
    XCUIDevice.shared.orientation = .landscapeLeft
    sleep(2)
    tapTab(["Поездка"])
    sleep(1)
    shot("07-home-landscape")
    XCUIDevice.shared.orientation = .portrait
    sleep(1)
  }

  func capture(code: String, home: String, country: String, map: [String], settings: [String], voice: [String], start: String) throws {
    app.launch()
    dismissWelcome()
    allowLocationIfNeeded()
    selectLanguage(code: code, home: home, settings: settings)
    guard app.staticTexts[home].waitForExistence(timeout: 8) else {
      try? app.debugDescription.write(toFile: "/tmp/camalert-shots/hierarchy-fail.txt", atomically: true, encoding: .utf8)
      shot("01-home-fail")
      XCTFail("Home did not appear for \(code)")
      return
    }
    shot("01-home")

    if !tapContaining(country) {
      app.swipeUp()
      _ = tapContaining(country)
    }
    sleep(2)
    shot("03-countries")

    tapTab(map)
    sleep(4)
    shot("02-map")

    tapTab(settings)
    sleep(1)
    scrollUntil(any: voice)
    shot("04-settings-voice")

    tapTab(["Поездка"])
    sleep(1)
    allowLocationIfNeeded()
    if !tapContaining(start) { _ = tapContaining("Start trip") }
    allowLocationIfNeeded()
    sleep(1)
    driveTowardKyivCamera()
    sleep(3)
    shot("05-trip")
  }

  func selectLanguage(code: String, home: String, settings: [String]) {
    if app.staticTexts[home].waitForExistence(timeout: 2) { return }
    tapTab(settings)
    sleep(1)
    tapExactOther(code)
    sleep(1)
    tapTab(["Поездка"])
    sleep(1)
  }

  func testCaptureSettingsAndHome() {
    app.launch()
    if app.staticTexts["Ready to go"].waitForExistence(timeout: 8),
       app.staticTexts["Permission granted"].exists {
      shot("01-home")
    }
    tapTab(["Settings", "Настройки"])
    sleep(1)
    scrollUntil(any: ["Voice", "Голос"])
    shot("04-settings-voice")
  }

  func tapNormalized(_ x: Double, _ y: Double) {
    app.coordinate(withNormalizedOffset: CGVector(dx: x, dy: y)).tap()
  }

  func dismissWelcome() {
    let deadline = Date().addingTimeInterval(20)
    while Date() < deadline {
      if app.staticTexts["Ready to go"].exists || app.staticTexts["В путь!"].exists || app.staticTexts["У дорогу!"].exists || app.staticTexts["W drogę!"].exists { return }
      for label in ["Пропустить", "Пропустити", "Pomiń", "Skip"] {
        if app.buttons[label].exists { app.buttons[label].tap(); sleep(1); return }
        if app.staticTexts[label].exists { app.staticTexts[label].tap(); sleep(1); return }
      }
      if app.staticTexts["Уверенность на каждом километре"].exists || app.staticTexts["Confidence on every kilometre"].exists {
        tapNormalized(0.90, 0.055)
        sleep(1)
        if !app.staticTexts["Уверенность на каждом километре"].exists && !app.staticTexts["Confidence on every kilometre"].exists {
          return
        }
      }
      sleep(1)
    }
  }

  func switchToEnglishIfNeeded() {
    if app.staticTexts["Ready to go"].waitForExistence(timeout: 3) { return }
    _ = app.staticTexts["В путь!"].waitForExistence(timeout: 8)
    tapTab(["Настройки", "Settings"])
    sleep(1)
    tapExactOther("EN")
    sleep(1)
    tapTab(["Поездка"])
    sleep(1)
  }

  func tapTab(_ labels: [String]) {
    for label in labels {
      let element = elementContaining(label)
      guard element.exists else { continue }
      if element.isHittable { element.tap() } else { element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap() }
      return
    }
  }

  func tapExactOther(_ label: String) {
    let element = app.otherElements[label]
    for _ in 0..<8 {
      if element.exists && element.isHittable { element.tap(); return }
      if element.exists && element.frame.minY < 80 { app.swipeDown() } else { app.swipeUp() }
      sleep(1)
    }
    if element.exists { element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap() }
  }

  func elementContaining(_ label: String) -> XCUIElement {
    let pred = NSPredicate(format: "label CONTAINS %@", label)
    let button = app.buttons.matching(pred).firstMatch
    if button.exists { return button }
    let other = app.otherElements.matching(pred).firstMatch
    if other.exists { return other }
    return app.staticTexts.matching(pred).firstMatch
  }

  @discardableResult
  func tapContaining(_ label: String) -> Bool {
    let element = elementContaining(label)
    guard element.exists else { return false }
    if element.isHittable { element.tap() } else { element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap() }
    return true
  }

  func scrollUntil(any labels: [String]) {
    for _ in 0..<12 {
      var labelIsAbove = false
      var placed = false
      for label in labels {
        let text = app.staticTexts.matching(NSPredicate(format: "label == %@", label)).firstMatch
        guard text.exists else { continue }
        let frame = text.frame
        if text.isHittable && frame.minY > 120 && frame.maxY < 1100 { placed = true; break }
        if frame.minY < 120 { labelIsAbove = true }
      }
      if placed { return }
      let startY = labelIsAbove ? 0.35 : 0.62
      let endY = labelIsAbove ? 0.62 : 0.38
      let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: startY))
      let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: endY))
      start.press(forDuration: 0.05, thenDragTo: end)
      sleep(1)
    }
  }

  func allowLocationIfNeeded() {
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let labels = [
      "Allow While Using App", "Allow Once", "Change to Always Allow", "Allow",
      "При использовании приложения", "Однократно", "Разрешить"
    ]
    for _ in 0..<3 {
      let alert = springboard.alerts.firstMatch
      guard alert.waitForExistence(timeout: 2) else { return }
      shot("location-permission")
      var tapped = false
      for label in labels where alert.buttons[label].exists {
        alert.buttons[label].tap()
        tapped = true
        break
      }
      if !tapped { break }
    }
  }

  func driveTowardKyivCamera() {
    let start = CLLocationCoordinate2D(latitude: 50.4752, longitude: 30.45353)
    let end = CLLocationCoordinate2D(latitude: 50.4788, longitude: 30.45353)
    for step in 0...6 {
      let fraction = Double(step) / 6
      let point = CLLocation(
        coordinate: CLLocationCoordinate2D(
          latitude: start.latitude + (end.latitude - start.latitude) * fraction,
          longitude: start.longitude
        ),
        altitude: 180,
        horizontalAccuracy: 5,
        verticalAccuracy: 5,
        course: 0,
        speed: 15,
        timestamp: Date()
      )
      XCUIDevice.shared.location = XCUILocation(location: point)
      sleep(1)
    }
  }

  func tap(any labels: [String]) {
    for label in labels {
      let button = app.buttons[label]
      if button.exists { button.tap(); return }
      let text = app.staticTexts[label]
      if text.exists { text.tap(); return }
    }
  }

  func scrollTo(any labels: [String]) {
    for _ in 0..<4 {
      for label in labels {
        if app.staticTexts[label].exists || app.switches[label].exists { return }
      }
      app.swipeUp()
    }
  }

  func shot(_ name: String) {
    let screenshot = app.screenshot()
    let attachment = XCTAttachment(screenshot: screenshot)
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
    let url = URL(fileURLWithPath: "/tmp/camalert-shots/\(name).png")
    try? screenshot.pngRepresentation.write(to: url)
  }
}
