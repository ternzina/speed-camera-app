import AVFoundation
import CoreLocation
import UIKit

extension Notification.Name {
  static let camalertShowTab = Notification.Name("camalert.showTab")
  static let camalertRouteTo = Notification.Name("camalert.routeTo")
}

extension UIFont {
  /// One step from the iPhone text size, capped so the original layout does not balloon.
  /// A plain font is used on purpose: UIButton.Configuration scales a metrics font a second time.
  static func camalert(_ size: CGFloat, weight: UIFont.Weight = .regular) -> UIFont {
    let category = UITraitCollection.current.preferredContentSizeCategory
    let body = UIFont.preferredFont(
      forTextStyle: .body,
      compatibleWith: UITraitCollection(preferredContentSizeCategory: category)
    ).pointSize
    let factor = min(max(body / 17, 0.9), 1.2)
    return systemFont(ofSize: (size * factor * 2).rounded() / 2, weight: weight)
  }
}

enum CamAlertPhrases {
  struct Home {
    let title: String
    let subtitle: String
    let start: String
    let `where`: String
  }
  struct Settings {
    let back: String
    let countriesTitle: String
    let countries: String
    let settings: String
    let warnings: String
    let laws: String
    let lawsNote: String
    let premium: String
    let premiumSub: String
    let redeem: String
    let share: String
    let welcome: String
    let feedback: String
    let history: String
    let country: String
    let countryMeta: String
    let theme: String
    let auto: String
    let nightDrive: String
    let dayDrive: String
    let previewTitle: String
    let previewSub: String
    let language: String
    let voice: String
    let vibration: String
    let smart: String
    let distances: String
    let band1: String
    let band2: String
    let band3: String
    let band4: String
    let about: String
    let privacy: String
    let help: String
    let report: String
  }
  struct Tabs {
    let drive: String
    let map: String
    let nearby: String
    let settings: String
  }
  struct Nearby {
    let title: String
    let gas: String
    let parking: String
    let food: String
    let repair: String
    let hospital: String
    let pharmacy: String
    let cameras: String
  }
  struct Welcome {
    let back: String
    let skip: String
    let next: String
    let continueTitle: String
    let welcome: String
    let intro: String
    let camera: String
    let cameraBody: String
    let voice: String
    let voiceBody: String
    let world: String
    let worldBody: String
    let countries: String
    let cameras: String
    let freedom: String
    let subtitle: String
    let offlineBody: String
    let offline: String
    let works: String
    let worksBody: String
  }

  static func home(_ language: String) -> Home {
    switch language {
    case "uk": return Home(title: "У дорогу!", subtitle: "Більше впевненості на кожній дорозі", start: "Почати поїздку", where: "Куди їдемо?")
    case "en": return Home(title: "Ready to go", subtitle: "More confidence on every road", start: "Start trip", where: "Where to?")
    case "pl": return Home(title: "W drogę!", subtitle: "Więcej pewności na każdej trasie", start: "Rozpocznij jazdę", where: "Dokąd jedziemy?")
    default: return Home(title: "В путь!", subtitle: "Больше уверенности на каждой дороге", start: "Начать поездку", where: "Куда едем?")
    }
  }

  static func tabs(_ language: String) -> Tabs {
    switch language {
    case "uk": return Tabs(drive: "Поїздка", map: "Карта", nearby: "Поруч", settings: "Налаштування")
    case "en": return Tabs(drive: "Drive", map: "Map", nearby: "Nearby", settings: "Settings")
    case "pl": return Tabs(drive: "Jazda", map: "Mapa", nearby: "W pobliżu", settings: "Ustawienia")
    default: return Tabs(drive: "Поездка", map: "Карта", nearby: "Рядом", settings: "Настройки")
    }
  }

  static func nearby(_ language: String) -> Nearby {
    switch language {
    case "uk": return Nearby(title: "Поруч", gas: "АЗС", parking: "Парковка", food: "Кафе і ресторани", repair: "Ремонт і шиномонтаж", hospital: "Лікарня", pharmacy: "Аптека", cameras: "Камери поруч")
    case "en": return Nearby(title: "Nearby", gas: "Gas station", parking: "Parking", food: "Cafes and restaurants", repair: "Car repair and tire service", hospital: "Hospital", pharmacy: "Pharmacy", cameras: "Nearby cameras")
    case "pl": return Nearby(title: "W pobliżu", gas: "Stacja paliw", parking: "Parking", food: "Kawiarnie i restauracje", repair: "Naprawa i wulkanizacja", hospital: "Szpital", pharmacy: "Apteka", cameras: "Kamery w pobliżu")
    default: return Nearby(title: "Рядом", gas: "АЗС", parking: "Парковка", food: "Кафе и рестораны", repair: "Ремонт и шиномонтаж", hospital: "Больница", pharmacy: "Аптека", cameras: "Камеры рядом")
    }
  }

  static func settings(_ language: String) -> Settings {
    switch language {
    case "uk":
      return Settings(back: "Назад", countriesTitle: "Країни та дані", countries: "Країни", settings: "Налаштування", warnings: "Попередження про камери", laws: "Правила по країнах", lawsNote: "Розділ лише повідомляє про місцеві обмеження. Він не вмикає і не вимикає попередження.", premium: "CamAlert Premium", premiumSub: "Більше можливостей у кожній поїздці", redeem: "Активувати промокод", share: "Поділитися CamAlert", welcome: "Переглянути привітання", feedback: "Залишити побажання", history: "Історія попереджень", country: "Країна", countryMeta: "Вибір країни та завантаження бази", theme: "Тема застосунку", auto: "Як у системі", nightDrive: "Нічна поїздка", dayDrive: "Денна поїздка", previewTitle: "Перевірити попередження", previewSub: "Приклад сповіщення · 250 м · 78 / 90 км/год", language: "Мова", voice: "Голос", vibration: "Вібрація", smart: "Розумна дистанція за швидкістю", distances: "Дистанції попередження", band1: "До 60 км/год", band2: "60–89 км/год", band3: "90–119 км/год", band4: "120+ км/год", about: "Про застосунок", privacy: "Політика конфіденційності", help: "Як користуватися", report: "Повідомити про камеру")
    case "en":
      return Settings(back: "Back", countriesTitle: "Countries and data", countries: "Countries", settings: "Settings", warnings: "Camera warnings", laws: "Rules by country", lawsNote: "This section only describes local limits. It does not turn warnings on or off.", premium: "CamAlert Premium", premiumSub: "More in every drive", redeem: "Redeem code", share: "Share CamAlert", welcome: "View welcome", feedback: "Send feedback", history: "Warning history", country: "Country", countryMeta: "Choose a country and download its database", theme: "App theme", auto: "Match system", nightDrive: "Night Drive", dayDrive: "Day Drive", previewTitle: "Check a warning", previewSub: "Sample alert · 250 m · 78 / 90 km/h", language: "Language", voice: "Voice", vibration: "Vibration", smart: "Smart distance by speed", distances: "Alert distances", band1: "Up to 60 km/h", band2: "60–89 km/h", band3: "90–119 km/h", band4: "120+ km/h", about: "About", privacy: "Privacy Policy", help: "How to use", report: "Report a camera")
    case "pl":
      return Settings(back: "Wstecz", countriesTitle: "Kraje i dane", countries: "Kraje", settings: "Ustawienia", warnings: "Ostrzeżenia o kamerach", laws: "Przepisy według krajów", lawsNote: "Ta sekcja tylko opisuje lokalne ograniczenia. Nie włącza i nie wyłącza ostrzeżeń.", premium: "CamAlert Premium", premiumSub: "Więcej możliwości w każdej jeździe", redeem: "Aktywuj kod", share: "Udostępnij CamAlert", welcome: "Zobacz powitanie", feedback: "Prześlij opinię", history: "Historia ostrzeżeń", country: "Kraj", countryMeta: "Wybór kraju i pobieranie bazy", theme: "Motyw aplikacji", auto: "Jak w systemie", nightDrive: "Nocna jazda", dayDrive: "Dzienna jazda", previewTitle: "Sprawdź ostrzeżenie", previewSub: "Przykład powiadomienia · 250 m · 78 / 90 km/h", language: "Język", voice: "Głos", vibration: "Wibracje", smart: "Inteligentna odległość według prędkości", distances: "Odległości ostrzegania", band1: "Do 60 km/h", band2: "60–89 km/h", band3: "90–119 km/h", band4: "120+ km/h", about: "O aplikacji", privacy: "Polityka prywatności", help: "Jak korzystać", report: "Zgłoś fotoradar")
    default:
      return Settings(back: "Назад", countriesTitle: "Страны и данные", countries: "Страны", settings: "Настройки", warnings: "Предупреждения о камерах", laws: "Правила по странам", lawsNote: "Раздел только сообщает о местных ограничениях. Он не включает и не выключает предупреждения.", premium: "CamAlert Premium", premiumSub: "Больше возможностей в каждой поездке", redeem: "Активировать промокод", share: "Поделиться CamAlert", welcome: "Посмотреть приветствие", feedback: "Оставить пожелания", history: "История предупреждений", country: "Страна", countryMeta: "Выбор страны и загрузка базы", theme: "Тема приложения", auto: "Как в системе", nightDrive: "Ночная поездка", dayDrive: "Дневная поездка", previewTitle: "Проверить предупреждение", previewSub: "Пример оповещения · 250 м · 78 / 90 км/ч", language: "Язык", voice: "Голос", vibration: "Вибрация", smart: "Умная дистанция по скорости", distances: "Дистанции предупреждения", band1: "До 60 км/ч", band2: "60–89 км/ч", band3: "90–119 км/ч", band4: "120+ км/ч", about: "О приложении", privacy: "Политика конфиденциальности", help: "Как пользоваться", report: "Сообщить о камере")
    }
  }

  static func welcome(_ language: String) -> Welcome {
    switch language {
    case "uk": return Welcome(back: "Назад", skip: "Пропустити", next: "Далі", continueTitle: "Продовжити", welcome: "Впевненість на кожному кілометрі", intro: "Ваш помічник у дорозі: попередження про камери та контроль швидкості.", camera: "Камери попереду", cameraBody: "Знайте про камери заздалегідь", voice: "Звукові сигнали", voiceBody: "Попередження під час поїздки", world: "Камери в усьому світі", worldBody: "Дані про камери різних країн — для ваших поїздок поруч із домом і за кордоном.", countries: "Країни", cameras: "Камери", freedom: "Свобода в дорозі", subtitle: "Попередження навіть без інтернету", offlineBody: "Завантажте базу потрібної країни заздалегідь і отримуйте попередження в поїздці, навіть якщо зв’язок зникне.", offline: "ОФЛАЙН", works: "Працює офлайн", worksBody: "За заздалегідь завантаженою базою камер")
    case "en": return Welcome(back: "Back", skip: "Skip", next: "Next", continueTitle: "Continue", welcome: "Confidence on every kilometre", intro: "Your driving companion: camera alerts and speed awareness.", camera: "Cameras ahead", cameraBody: "Know about cameras in advance", voice: "Audio alerts", voiceBody: "Warnings during your trip", world: "Cameras around the world", worldBody: "Camera data for trips close to home and abroad.", countries: "Countries", cameras: "Cameras", freedom: "Freedom on the road", subtitle: "Alerts even without internet", offlineBody: "Download your country’s database ahead of time and receive alerts even when connectivity drops.", offline: "OFFLINE", works: "Works offline", worksBody: "With a previously downloaded camera database")
    case "pl": return Welcome(back: "Wstecz", skip: "Pomiń", next: "Dalej", continueTitle: "Kontynuuj", welcome: "Pewność na każdym kilometrze", intro: "Twój pomocnik w drodze: ostrzeżenia o kamerach i kontrola prędkości.", camera: "Kamery przed Tobą", cameraBody: "Dowiedz się o kamerach wcześniej", voice: "Sygnały dźwiękowe", voiceBody: "Ostrzeżenia podczas podróży", world: "Kamery na całym świecie", worldBody: "Dane o kamerach na podróże blisko domu i za granicą.", countries: "Kraje", cameras: "Kamery", freedom: "Wolność w drodze", subtitle: "Ostrzeżenia nawet bez internetu", offlineBody: "Pobierz wcześniej bazę wybranego kraju i otrzymuj ostrzeżenia także po utracie połączenia.", offline: "OFFLINE", works: "Działa offline", worksBody: "Z wcześniej pobraną bazą kamer")
    default: return Welcome(back: "Назад", skip: "Пропустить", next: "Далее", continueTitle: "Продолжить", welcome: "Уверенность на каждом километре", intro: "Ваш помощник в дороге: предупреждения о камерах и контроль скорости.", camera: "Камеры впереди", cameraBody: "Знайте о камерах заранее", voice: "Звуковые сигналы", voiceBody: "Предупреждения во время поездки", world: "Камеры по всему миру", worldBody: "Данные о камерах разных стран — для ваших поездок рядом с домом и за границей.", countries: "Страны", cameras: "Камеры", freedom: "Свобода в дороге", subtitle: "Предупреждения даже без интернета", offlineBody: "Загрузите базу нужной страны заранее и получайте предупреждения в поездке, даже если связь пропадёт.", offline: "ОФЛАЙН", works: "Работает офлайн", worksBody: "По заранее загруженной базе камер")
    }
  }

  struct VoiceRestart {
    let title: String
    let message: String
    let button: String
  }

  static func voiceRestart(_ language: String) -> VoiceRestart {
    switch language {
    case "uk":
      return VoiceRestart(
        title: "Залишився один крок",
        message: "Початкове налаштування завершено.\n\nЩоб голосова навігація працювала правильно, повністю закрийте CamAlert, змахнувши його картку вгору в списку відкритих програм, потім запустіть застосунок знову.\n\nЦе потрібно зробити лише один раз після встановлення.",
        button: "Зрозуміло"
      )
    case "en":
      return VoiceRestart(
        title: "One step left",
        message: "Initial setup is complete.\n\nFor voice navigation to work properly, fully close CamAlert by swiping its card up in the list of open apps, then open the app again.\n\nYou only need to do this once after installation.",
        button: "Got it"
      )
    case "pl":
      return VoiceRestart(
        title: "Został jeden krok",
        message: "Początkowa konfiguracja została zakończona.\n\nAby nawigacja głosowa działała poprawnie, całkowicie zamknij CamAlert, przesuwając jego kartę w górę na liście otwartych aplikacji, a następnie uruchom aplikację ponownie.\n\nTrzeba to zrobić tylko raz po instalacji.",
        button: "Rozumiem"
      )
    default:
      return VoiceRestart(
        title: "Остался один шаг",
        message: "Первоначальная настройка завершена.\n\nЧтобы голосовая навигация работала правильно, полностью закройте CamAlert, смахнув его карточку вверх в списке открытых приложений, затем запустите приложение снова.\n\nЭто нужно сделать только один раз после установки.",
        button: "Понятно"
      )
    }
  }

  static func countryName(_ code: String, language: String) -> String {
    let upper = code.uppercased()
    if upper == "UA" { return language == "en" ? "Ukraine" : language == "pl" ? "Ukraina" : language == "uk" ? "Україна" : "Украина" }
    if upper == "PL" { return language == "en" ? "Poland" : language == "pl" ? "Polska" : language == "uk" ? "Польща" : "Польша" }
    return upper
  }
}

final class DriveHostController: UIViewController {
  let home = HomeViewController()
  let map = ViewController()

  override func viewDidLoad() {
    super.viewDidLoad()
    embed(home)
    embed(map)
    map.view.isHidden = !ProcessInfo.processInfo.arguments.contains("--voice-check")
    home.view.isHidden = !map.view.isHidden
  }

  func showMap(search: Bool) {
    map.view.isHidden = false
    home.view.isHidden = true
    view.bringSubviewToFront(map.view)
    if search { map.focusDestination() }
  }

  func showHome() {
    guard map.navigatorIsIdle else { return }
    map.view.isHidden = true
    home.view.isHidden = false
    view.bringSubviewToFront(home.view)
  }

  private func embed(_ child: UIViewController) {
    addChild(child)
    child.view.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(child.view)
    NSLayoutConstraint.activate([
      child.view.topAnchor.constraint(equalTo: view.topAnchor),
      child.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      child.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      child.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])
    child.didMove(toParent: self)
  }
}

final class CamAlertShellController: UIViewController {
  private let session = CamAlertSession.shared
  private var driveHost: DriveHostController?
  private let nearby = NearbyViewController()
  private let settings = SettingsViewController()
  private var pages: [UINavigationController] = []
  private let bar = UIStackView()
  private var tabButtons: [UIButton] = []
  private var current = "drive"

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = CamAlertPalette.page
    pages = [UINavigationController(), nav(CameraBrowseViewController()), nav(nearby), nav(settings)]
    for child in pages {
      addChild(child)
      child.didMove(toParent: self)
    }
    bar.axis = .horizontal
    bar.distribution = .fillEqually
    bar.spacing = 2
    bar.backgroundColor = .white
    bar.layer.cornerRadius = 20
    bar.layoutMargins = UIEdgeInsets(top: 6, left: 6, bottom: 6, right: 6)
    bar.isLayoutMarginsRelativeArrangement = true
    bar.layer.shadowColor = UIColor.black.cgColor
    bar.layer.shadowOpacity = 0.12
    bar.layer.shadowRadius = 15
    bar.layer.shadowOffset = CGSize(width: 0, height: 6)
    bar.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(bar)
    NSLayoutConstraint.activate([
      bar.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
      bar.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
      bar.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -8),
      bar.heightAnchor.constraint(equalToConstant: 64),
    ])
    if !ProcessInfo.processInfo.arguments.contains("--show-premium") {
      attach(0)
    }
    NotificationCenter.default.addObserver(self, selector: #selector(showRequested(_:)), name: .camalertShowTab, object: nil)
    rebuildTabs()
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    if ProcessInfo.processInfo.arguments.contains("--voice-check") {
      show("drive")
    }
    if ProcessInfo.processInfo.arguments.contains("--show-premium"), presentedViewController == nil {
      let screen = PremiumViewController()
      screen.modalPresentationStyle = .fullScreen
      present(screen, animated: false)
    }
  }

  private func nav(_ root: UIViewController) -> UINavigationController {
    let navigation = UINavigationController(rootViewController: root)
    navigation.setNavigationBarHidden(true, animated: false)
    navigation.navigationBar.tintColor = CamAlertPalette.blue
    return navigation
  }

  private func rebuildTabs() {
    bar.arrangedSubviews.forEach { $0.removeFromSuperview() }
    tabButtons.removeAll()
    let copy = CamAlertPhrases.tabs(session.settings.language)
    let items = [("drive", "🚗", copy.drive), ("map", "🗺️", copy.map), ("nearby", "📍", copy.nearby), ("settings", "⚙️", copy.settings)]
    for item in items {
      let button = UIButton(type: .custom)
      let label = NSMutableAttributedString(string: "\(item.1)\n", attributes: [.font: UIFont.camalert(17)])
      label.append(NSAttributedString(string: item.2, attributes: [.font: UIFont.camalert(12, weight: .medium)]))
      button.setAttributedTitle(label, for: .normal)
      button.titleLabel?.numberOfLines = 2
      button.titleLabel?.textAlignment = .center
      button.titleLabel?.lineBreakMode = .byTruncatingTail
      button.titleLabel?.adjustsFontSizeToFitWidth = true
      button.titleLabel?.minimumScaleFactor = 0.72
      button.setTitleColor(UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1), for: .normal)
      button.layer.cornerRadius = 13
      button.tag = ["drive", "map", "nearby", "settings"].firstIndex(of: item.0) ?? 0
      button.accessibilityIdentifier = item.0
      button.addAction(UIAction { [weak self] _ in self?.show(item.0) }, for: .touchUpInside)
      tabButtons.append(button)
      bar.addArrangedSubview(button)
    }
    paintTabs()
  }

  private func paintTabs() {
    let night = CamAlertPalette.night(session.settings)
    bar.backgroundColor = night ? UIColor(red: 23 / 255, green: 42 / 255, blue: 64 / 255, alpha: 1) : .white
    view.backgroundColor = night ? CamAlertPalette.nightPage : UIColor(red: 245 / 255, green: 246 / 255, blue: 248 / 255, alpha: 1)
    for button in tabButtons {
      let on = button.accessibilityIdentifier == current
      button.backgroundColor = on ? (night ? UIColor(red: 41 / 255, green: 67 / 255, blue: 90 / 255, alpha: 1) : UIColor(red: 238 / 255, green: 240 / 255, blue: 243 / 255, alpha: 1)) : .clear
      let color = night ? UIColor.white : UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1)
      if let title = button.attributedTitle(for: .normal) {
        let colored = NSMutableAttributedString(attributedString: title)
        colored.addAttribute(.foregroundColor, value: color, range: NSRange(location: 0, length: colored.length))
        button.setAttributedTitle(colored, for: .normal)
      }
    }
  }

  private func show(_ tab: String) {
    let names = ["drive", "map", "nearby", "settings"]
    guard let index = names.firstIndex(of: tab) else { return }
    current = tab
    attach(index)
    paintTabs()
  }

  private func attach(_ index: Int) {
    if index == 0, driveHost == nil {
      let host = DriveHostController()
      driveHost = host
      pages[0].setViewControllers([host], animated: false)
      pages[0].setNavigationBarHidden(true, animated: false)
    }
    for (offset, page) in pages.enumerated() {
      if offset == index, page.view.superview == nil {
        page.view.translatesAutoresizingMaskIntoConstraints = false
        view.insertSubview(page.view, belowSubview: bar)
        NSLayoutConstraint.activate([
          page.view.topAnchor.constraint(equalTo: view.topAnchor),
          page.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
          page.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
          page.view.bottomAnchor.constraint(equalTo: bar.topAnchor, constant: -8),
        ])
      }
      page.viewIfLoaded?.isHidden = offset != index
    }
  }

  @objc private func showRequested(_ note: Notification) {
    guard let name = note.object as? String else { return }
    if name == "refresh" {
      rebuildTabs()
      return
    }
    if name == "welcome" {
      presentWelcome()
      return
    }
    if name == "countries" {
      settings.segment = "countries"
      show("settings")
      return
    }
    if name == "search" {
      show("drive")
      driveHost?.showMap(search: true)
      return
    }
    if name == "trip" {
      PremiumStore.shared.beginTripIfOpen()
      show("drive")
      driveHost?.showMap(search: false)
      return
    }
    if name == "home" {
      PremiumStore.shared.endTrip()
      show("drive")
      driveHost?.showHome()
      return
    }
    if name == "settings" { settings.segment = "settings" }
    show(name == "map" || name == "nearby" || name == "settings" || name == "drive" ? name : "drive")
  }

  private func presentWelcome() {
    let welcome = WelcomeViewController()
    welcome.modalPresentationStyle = .fullScreen
    present(welcome, animated: true)
  }
}

final class NearbyViewController: UIViewController, CLLocationManagerDelegate {
  private let session = CamAlertSession.shared
  private let locator = CLLocationManager()
  private let stack = UIStackView()
  private let results = UIStackView()
  private var selectedId: String?
  private var origin: CLLocation?
  private let categories: [(id: String, types: [String])] = [
    ("gas", ["gas_station"]),
    ("parking", ["parking"]),
    ("food", ["cafe", "restaurant"]),
    ("repair", ["car_repair", "tire_shop"]),
    ("hospital", ["hospital"]),
    ("pharmacy", ["pharmacy"]),
    ("cameras", []),
  ]

  override func viewDidLoad() {
    super.viewDidLoad()
    let scroll = UIScrollView()
    scroll.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .vertical
    stack.spacing = 12
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(scroll)
    scroll.addSubview(stack)
    NSLayoutConstraint.activate([
      scroll.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
      scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: 8),
      stack.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 16),
      stack.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -16),
      stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -20),
      stack.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor, constant: -32),
    ])
    results.axis = .vertical
    results.spacing = 8
    locator.delegate = self
    locator.requestWhenInUseAuthorization()
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    navigationController?.setNavigationBarHidden(true, animated: animated)
    rebuild()
  }

  private func rebuild() {
    stack.arrangedSubviews.forEach { $0.removeFromSuperview() }
    let night = CamAlertPalette.night(session.settings)
    let copy = CamAlertPhrases.nearby(session.settings.language)
    let backCopy = CamAlertPhrases.settings(session.settings.language)
    view.backgroundColor = night ? CamAlertPalette.nightPage : UIColor(red: 245 / 255, green: 246 / 255, blue: 248 / 255, alpha: 1)
    let ink = night ? UIColor.white : UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1)
    let back = UIButton(type: .system)
    back.setTitle("‹  \(backCopy.back)", for: .normal)
    back.setTitleColor(ink, for: .normal)
    back.titleLabel?.font = .camalert(17, weight: .bold)
    back.backgroundColor = night ? UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 0.94) : .white
    back.layer.cornerRadius = 14
    back.contentEdgeInsets = UIEdgeInsets(top: 8, left: 12, bottom: 8, right: 12)
    back.addAction(UIAction { _ in NotificationCenter.default.post(name: .camalertShowTab, object: "drive") }, for: .touchUpInside)
    let title = UILabel()
    title.text = copy.title
    title.font = .camalert(22, weight: .heavy)
    title.adjustsFontSizeToFitWidth = true
    title.minimumScaleFactor = 0.75
    title.numberOfLines = 2
    title.textColor = ink
    let header = UIStackView(arrangedSubviews: [back, title])
    header.axis = .horizontal
    header.alignment = .center
    header.spacing = 10
    stack.addArrangedSubview(header)
    let names = [copy.gas, copy.parking, copy.food, copy.repair, copy.hospital, copy.pharmacy, copy.cameras]
    var row = UIStackView()
    row.axis = .horizontal
    row.spacing = 8
    row.distribution = .fillEqually
    for (index, name) in names.enumerated() {
      if index > 0, index % 3 == 0 {
        stack.addArrangedSubview(row)
        row = UIStackView()
        row.axis = .horizontal
        row.spacing = 8
        row.distribution = .fillEqually
      }
      let button = UIButton(type: .system)
      button.setTitle(name, for: .normal)
      button.titleLabel?.numberOfLines = 3
      button.titleLabel?.lineBreakMode = .byWordWrapping
      button.titleLabel?.textAlignment = .center
      button.titleLabel?.font = .camalert(12, weight: .semibold)
      button.contentEdgeInsets = UIEdgeInsets(top: 6, left: 6, bottom: 6, right: 6)
      button.setTitleColor(ink, for: .normal)
      button.backgroundColor = night ? CamAlertPalette.cardNight : .white
      button.layer.cornerRadius = 16
      button.layer.borderWidth = 1
      button.layer.borderColor = UIColor(red: 228 / 255, green: 232 / 255, blue: 237 / 255, alpha: 1).cgColor
      button.heightAnchor.constraint(equalToConstant: 56).isActive = true
      let category = categories[index]
      let selected = category.id == selectedId
      if selected {
        button.backgroundColor = UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1)
        button.setTitleColor(.white, for: .normal)
      }
      button.addAction(UIAction { [weak self] _ in self?.choose(category.id) }, for: .touchUpInside)
      row.addArrangedSubview(button)
    }
    while row.arrangedSubviews.count < 3 {
      let spacer = UIView()
      row.addArrangedSubview(spacer)
    }
    stack.addArrangedSubview(row)
    stack.addArrangedSubview(results)
    renderResults()
  }

  private func choose(_ id: String) {
    selectedId = id
    rebuild()
    guard let category = categories.first(where: { $0.id == id }) else { return }
    if category.types.isEmpty {
      renderCameras()
      return
    }
    locateThenSearch(category.types)
  }

  private func locateThenSearch(_ types: [String]) {
    switch locator.authorizationStatus {
    case .denied, .restricted:
      note(nearbyPhrase("denied"))
      return
    case .notDetermined:
      locator.requestWhenInUseAuthorization()
      note(nearbyPhrase("loading"))
      return
    default:
      break
    }
    if let origin {
      search(types, origin: origin)
    } else {
      note(nearbyPhrase("loading"))
      locator.requestLocation()
    }
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    guard manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse else { return }
    manager.requestLocation()
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    origin = locations.last
    guard let origin, let id = selectedId, let types = categories.first(where: { $0.id == id })?.types, !types.isEmpty else { return }
    search(types, origin: origin)
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    if selectedId != nil, selectedId != "cameras" { note(nearbyPhrase("error")) }
  }

  private func search(_ types: [String], origin: CLLocation) {
    note(nearbyPhrase("loading"))
    let language = session.settings.language
    PlacesClient.nearby(types: types, latitude: origin.coordinate.latitude, longitude: origin.coordinate.longitude, language: language) { [weak self] result in
      guard let self, self.selectedId != "cameras" else { return }
      switch result {
      case .failure:
        self.note(self.nearbyPhrase("error"))
      case .success(let places):
        if places.isEmpty { self.note(self.nearbyPhrase("empty")); return }
        self.results.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for place in places { self.results.addArrangedSubview(self.placeCard(place)) }
      }
    }
  }

  private func renderCameras() {
    results.arrangedSubviews.forEach { $0.removeFromSuperview() }
    guard let origin else {
      note(nearbyPhrase("loading"))
      locator.requestLocation()
      return
    }
    let cameras = session.catalog.nearby(session.settings.country.uppercased(), latitude: origin.coordinate.latitude, longitude: origin.coordinate.longitude, radius: 5000)
      .sorted { CamAlertGeo.distanceMeters(origin.coordinate.latitude, origin.coordinate.longitude, $0.latitude, $0.longitude) < CamAlertGeo.distanceMeters(origin.coordinate.latitude, origin.coordinate.longitude, $1.latitude, $1.longitude) }
      .prefix(30)
    if cameras.isEmpty { note(nearbyPhrase("empty")); return }
    let night = CamAlertPalette.night(session.settings)
    let ink = night ? UIColor.white : UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1)
    for camera in cameras {
      let meters = Int(CamAlertGeo.distanceMeters(origin.coordinate.latitude, origin.coordinate.longitude, camera.latitude, camera.longitude).rounded())
      let card = UILabel()
      card.numberOfLines = 0
      card.text = "\(camera.location ?? camera.name ?? "Камера")\n\(meters) м"
      card.textColor = ink
      card.font = .camalert(16, weight: .heavy)
      card.backgroundColor = night ? CamAlertPalette.cardNight : .white
      card.layer.cornerRadius = 16
      card.clipsToBounds = true
      card.layoutMargins = UIEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)
      results.addArrangedSubview(padded(card))
    }
  }

  private func renderResults() {
    results.arrangedSubviews.forEach { $0.removeFromSuperview() }
  }

  private func placeCard(_ place: PlacesClient.NearbyPlace) -> UIView {
    let night = CamAlertPalette.night(session.settings)
    let ink = night ? UIColor.white : UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1)
    let name = UILabel()
    name.text = place.name
    name.font = .camalert(16, weight: .heavy)
    name.textColor = ink
    name.numberOfLines = 2
    let address = UILabel()
    address.text = place.address
    address.font = .camalert(13)
    address.textColor = night ? CamAlertPalette.mutedNight : CamAlertPalette.muted
    address.numberOfLines = 2
    let distance = UILabel()
    distance.text = place.distance >= 1000 ? String(format: "%.1f км", Double(place.distance) / 1000) : "\(place.distance) м"
    distance.font = .camalert(13, weight: .bold)
    distance.textColor = ink
    let go = UIButton(type: .system)
    go.setTitle(session.settings.language == "uk" ? "Поїхати" : session.settings.language == "en" ? "Go" : session.settings.language == "pl" ? "Jedź" : "Поехать", for: .normal)
    go.setTitleColor(.white, for: .normal)
    go.titleLabel?.font = .camalert(15, weight: .heavy)
    go.backgroundColor = CamAlertPalette.blue
    go.layer.cornerRadius = 14
    go.heightAnchor.constraint(equalToConstant: 44).isActive = true
    go.addAction(UIAction { _ in
      NotificationCenter.default.post(name: .camalertShowTab, object: "drive")
      NotificationCenter.default.post(name: .camalertRouteTo, object: nil, userInfo: [
        "lat": place.latitude, "lng": place.longitude, "title": place.name,
      ])
    }, for: .touchUpInside)
    let column = UIStackView(arrangedSubviews: [name, address, distance, go])
    column.axis = .vertical
    column.spacing = 4
    column.layoutMargins = UIEdgeInsets(top: 14, left: 14, bottom: 14, right: 14)
    column.isLayoutMarginsRelativeArrangement = true
    column.backgroundColor = night ? CamAlertPalette.cardNight : .white
    column.layer.cornerRadius = 16
    column.layer.borderWidth = 1
    column.layer.borderColor = UIColor(red: 228 / 255, green: 232 / 255, blue: 237 / 255, alpha: 1).cgColor
    return column
  }

  private func note(_ text: String) {
    results.arrangedSubviews.forEach { $0.removeFromSuperview() }
    let label = UILabel()
    label.text = text
    label.numberOfLines = 0
    label.font = .camalert(15)
    label.textColor = CamAlertPalette.night(session.settings) ? CamAlertPalette.mutedNight : CamAlertPalette.muted
    results.addArrangedSubview(label)
  }

  private func padded(_ label: UILabel) -> UIView {
    label.translatesAutoresizingMaskIntoConstraints = false
    let box = UIView()
    box.backgroundColor = label.backgroundColor
    label.backgroundColor = .clear
    box.layer.cornerRadius = 16
    box.addSubview(label)
    NSLayoutConstraint.activate([
      label.topAnchor.constraint(equalTo: box.topAnchor, constant: 12),
      label.leadingAnchor.constraint(equalTo: box.leadingAnchor, constant: 12),
      label.trailingAnchor.constraint(equalTo: box.trailingAnchor, constant: -12),
      label.bottomAnchor.constraint(equalTo: box.bottomAnchor, constant: -12),
    ])
    return box
  }

  private func nearbyPhrase(_ key: String) -> String {
    let language = session.settings.language
    let table: [String: [String: String]] = [
      "ru": ["loading": "Ищем места…", "empty": "Рядом ничего не найдено", "error": "Нет сети. Поиск не выполнен", "denied": "Нет доступа к геолокации"],
      "uk": ["loading": "Шукаємо місця…", "empty": "Поруч нічого не знайдено", "error": "Немає мережі. Пошук не виконано", "denied": "Немає доступу до геолокації"],
      "en": ["loading": "Searching nearby…", "empty": "Nothing nearby", "error": "No network. The search did not run", "denied": "Location permission is denied"],
      "pl": ["loading": "Szukamy miejsc…", "empty": "W pobliżu nic nie znaleziono", "error": "Brak sieci. Wyszukiwanie nie zostało wykonane", "denied": "Brak dostępu do lokalizacji"],
    ]
    return table[language]?[key] ?? table["ru"]?[key] ?? key
  }
}

final class WelcomeViewController: UIViewController {
  private let session = CamAlertSession.shared
  private var page = 0
  private let content = UIView()
  private var player: AVQueuePlayer?
  private var looper: AVPlayerLooper?
  private let nextButton = UIButton(type: .system)

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(red: 7 / 255, green: 21 / 255, blue: 37 / 255, alpha: 1)
    content.translatesAutoresizingMaskIntoConstraints = false
    nextButton.backgroundColor = UIColor(red: 18 / 255, green: 96 / 255, blue: 232 / 255, alpha: 1)
    nextButton.setTitleColor(.white, for: .normal)
    nextButton.titleLabel?.font = .camalert(20, weight: .bold)
    nextButton.layer.cornerRadius = 21
    nextButton.translatesAutoresizingMaskIntoConstraints = false
    nextButton.addTarget(self, action: #selector(advance), for: .touchUpInside)
    view.addSubview(content)
    view.addSubview(nextButton)
    NSLayoutConstraint.activate([
      content.topAnchor.constraint(equalTo: view.topAnchor),
      content.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      content.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      content.bottomAnchor.constraint(equalTo: nextButton.topAnchor, constant: -8),
      nextButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 22),
      nextButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -22),
      nextButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12),
      nextButton.heightAnchor.constraint(equalToConstant: 56),
    ])
    render()
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    navigationController?.setNavigationBarHidden(true, animated: animated)
    player?.play()
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    content.subviews.first { $0.layer.sublayers?.contains(where: { $0 is AVPlayerLayer }) == true }?.frame = view.bounds
    if let host = content.subviews.first(where: { $0.layer.sublayers?.contains(where: { $0 is AVPlayerLayer }) == true }) {
      host.layer.sublayers?.forEach { $0.frame = view.bounds }
    }
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    player?.pause()
  }

  private func render() {
    content.subviews.forEach { $0.removeFromSuperview() }
    player?.pause()
    let copy = CamAlertPhrases.welcome(session.settings.language)
    if page == 0 { addVideo() }
    let back = UIButton(type: .system)
    back.setTitle("‹  \(copy.back)", for: .normal)
    back.setTitleColor(.white, for: .normal)
    back.titleLabel?.font = .camalert(17, weight: .bold)
    back.backgroundColor = UIColor(red: 7 / 255, green: 21 / 255, blue: 37 / 255, alpha: 0.65)
    back.layer.cornerRadius = 22
    back.contentEdgeInsets = UIEdgeInsets(top: 8, left: 12, bottom: 8, right: 12)
    back.addTarget(self, action: #selector(retreat), for: .touchUpInside)
    back.translatesAutoresizingMaskIntoConstraints = false
    let skip = UIButton(type: .system)
    skip.setTitle(copy.skip, for: .normal)
    skip.setTitleColor(UIColor(red: 184 / 255, green: 200 / 255, blue: 218 / 255, alpha: 1), for: .normal)
    skip.titleLabel?.font = .camalert(15, weight: .semibold)
    skip.addTarget(self, action: #selector(finish), for: .touchUpInside)
    skip.translatesAutoresizingMaskIntoConstraints = false
    content.addSubview(back)
    content.addSubview(skip)
    NSLayoutConstraint.activate([
      back.topAnchor.constraint(equalTo: content.safeAreaLayoutGuide.topAnchor, constant: 6),
      back.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 16),
      skip.centerYAnchor.constraint(equalTo: back.centerYAnchor),
      skip.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -16),
    ])
    let scroll = UIScrollView()
    scroll.translatesAutoresizingMaskIntoConstraints = false
    scroll.alwaysBounceVertical = true
    scroll.showsVerticalScrollIndicator = false
    let column = UIStackView()
    column.axis = .vertical
    column.spacing = 8
    column.translatesAutoresizingMaskIntoConstraints = false
    content.addSubview(scroll)
    scroll.addSubview(column)
    let fill = column.heightAnchor.constraint(greaterThanOrEqualTo: scroll.frameLayoutGuide.heightAnchor)
    fill.priority = .defaultHigh
    NSLayoutConstraint.activate([
      scroll.topAnchor.constraint(equalTo: back.bottomAnchor, constant: 8),
      scroll.leadingAnchor.constraint(equalTo: content.leadingAnchor),
      scroll.trailingAnchor.constraint(equalTo: content.trailingAnchor),
      scroll.bottomAnchor.constraint(equalTo: content.bottomAnchor),
      column.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
      column.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 22),
      column.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -22),
      column.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
      column.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor, constant: -44),
      fill,
    ])
    if page == 0 {
      let spacer = UIView()
      let minimum = spacer.heightAnchor.constraint(greaterThanOrEqualToConstant: max(140, view.bounds.height * 0.30))
      minimum.priority = .required
      minimum.isActive = true
      spacer.setContentHuggingPriority(.init(1), for: .vertical)
      spacer.setContentCompressionResistancePriority(.init(1), for: .vertical)
      column.addArrangedSubview(spacer)
    } else {
      let hero = UIImageView(image: CamAlertImages.named(page == 1 ? "onboarding-world" : "onboarding-night"))
      hero.contentMode = .scaleAspectFill
      hero.clipsToBounds = true
      hero.layer.cornerRadius = 21
      hero.layer.borderWidth = 1
      hero.layer.borderColor = UIColor(red: 28 / 255, green: 57 / 255, blue: 79 / 255, alpha: 1).cgColor
      hero.translatesAutoresizingMaskIntoConstraints = false
      hero.heightAnchor.constraint(equalToConstant: 190).isActive = true
      if page == 2 {
        let badge = UILabel()
        badge.text = "  \(copy.offline)  "
        badge.textColor = UIColor(red: 142 / 255, green: 234 / 255, blue: 255 / 255, alpha: 1)
        badge.font = .camalert(12, weight: .bold)
        badge.backgroundColor = UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 0.9)
        badge.layer.cornerRadius = 14
        badge.clipsToBounds = true
        badge.translatesAutoresizingMaskIntoConstraints = false
        hero.addSubview(badge)
        NSLayoutConstraint.activate([
          badge.topAnchor.constraint(equalTo: hero.topAnchor, constant: 12),
          badge.leadingAnchor.constraint(equalTo: hero.leadingAnchor, constant: 12),
          badge.heightAnchor.constraint(equalToConstant: 28),
        ])
      }
      column.addArrangedSubview(hero)
    }
    let brand = UILabel()
    let brandText = NSMutableAttributedString(string: "Cam", attributes: [.foregroundColor: UIColor.white, .font: UIFont.camalert(32, weight: .black)])
    brandText.append(NSAttributedString(string: "Alert", attributes: [.foregroundColor: UIColor(red: 35 / 255, green: 211 / 255, blue: 239 / 255, alpha: 1), .font: UIFont.camalert(32, weight: .black)]))
    brand.attributedText = brandText
    let title = UILabel()
    title.text = page == 0 ? copy.welcome : page == 1 ? copy.world : copy.freedom
    title.textColor = .white
    title.font = .camalert(28, weight: .heavy)
    title.numberOfLines = 0
    let body = UILabel()
    body.textColor = UIColor(red: 184 / 255, green: 200 / 255, blue: 218 / 255, alpha: 1)
    body.font = .camalert(16)
    body.numberOfLines = 0
    body.text = page == 0 ? copy.intro : page == 1 ? copy.worldBody : copy.offlineBody
    column.addArrangedSubview(brand)
    column.addArrangedSubview(title)
    if page == 2 {
      let subtitle = UILabel()
      subtitle.text = copy.subtitle
      subtitle.textColor = .white
      subtitle.font = .camalert(16, weight: .bold)
      subtitle.numberOfLines = 0
      column.addArrangedSubview(subtitle)
    }
    column.addArrangedSubview(body)
    let extra = welcomeExtra(session.settings.language)
    if page == 0 {
      column.addArrangedSubview(card("⌖", copy.camera, copy.cameraBody))
      column.addArrangedSubview(card("))", copy.voice, copy.voiceBody))
    } else if page == 1 {
      column.addArrangedSubview(card("◎", "122\n\(copy.countries)", extra.international))
      column.addArrangedSubview(card("⌖", "114 794\n\(copy.cameras)", extra.published))
      column.addArrangedSubview(notice(extra.updated, extra.updatedBody))
      let date = UILabel()
      date.text = "\(extra.date) 13.10.2026 · CamAlert"
      date.textColor = UIColor(red: 184 / 255, green: 200 / 255, blue: 218 / 255, alpha: 1)
      date.font = .camalert(11)
      column.addArrangedSubview(date)
    } else {
      column.addArrangedSubview(card("⌁", copy.works, copy.worksBody))
      column.addArrangedSubview(card("⌖", extra.gps, extra.gpsBody))
      column.addArrangedSubview(notice(nil, extra.notice))
    }
    let dots = UIStackView()
    dots.axis = .horizontal
    dots.spacing = 8
    dots.alignment = .center
    for index in 0..<3 {
      let dot = UIView()
      dot.backgroundColor = index == page ? UIColor(red: 35 / 255, green: 211 / 255, blue: 239 / 255, alpha: 1) : UIColor(red: 83 / 255, green: 111 / 255, blue: 140 / 255, alpha: 1)
      dot.layer.cornerRadius = 4
      dot.translatesAutoresizingMaskIntoConstraints = false
      dot.widthAnchor.constraint(equalToConstant: index == page ? 24 : 8).isActive = true
      dot.heightAnchor.constraint(equalToConstant: 8).isActive = true
      dots.addArrangedSubview(dot)
    }
    let dotsWrap = UIView()
    dots.translatesAutoresizingMaskIntoConstraints = false
    dotsWrap.addSubview(dots)
    NSLayoutConstraint.activate([
      dots.centerXAnchor.constraint(equalTo: dotsWrap.centerXAnchor),
      dots.topAnchor.constraint(equalTo: dotsWrap.topAnchor, constant: 8),
      dots.bottomAnchor.constraint(equalTo: dotsWrap.bottomAnchor),
    ])
    column.addArrangedSubview(dotsWrap)
    content.bringSubviewToFront(scroll)
    content.bringSubviewToFront(back)
    content.bringSubviewToFront(skip)
    nextButton.setTitle("\(page == 2 ? copy.continueTitle : copy.next)  →", for: .normal)
  }

  private func addVideo() {
    guard let url = Bundle.main.url(forResource: "onboarding-drive-loop", withExtension: "mp4") else { return }
    let item = AVPlayerItem(url: url)
    let queue = AVQueuePlayer()
    queue.isMuted = true
    looper = AVPlayerLooper(player: queue, templateItem: item)
    player = queue
    let layer = AVPlayerLayer(player: queue)
    layer.videoGravity = .resizeAspectFill
    layer.frame = view.bounds
    let host = UIView(frame: view.bounds)
    host.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    host.isUserInteractionEnabled = false
    host.layer.addSublayer(layer)
    let poster = UIImageView(image: CamAlertImages.named("onboarding-first-frame"))
    poster.isUserInteractionEnabled = false
    poster.contentMode = .scaleAspectFill
    poster.frame = view.bounds
    poster.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    content.insertSubview(poster, at: 0)
    content.insertSubview(host, at: 1)
    queue.play()
  }

  private func welcomeExtra(_ language: String) -> (international: String, published: String, updated: String, updatedBody: String, date: String, gps: String, gpsBody: String, notice: String) {
    switch language {
    case "uk": return ("Міжнародна база", "Опубліковані дані", "База камер регулярно оновлюється", "Ми додаємо нові камери й уточнюємо наявні дані.", "Версія бази", "GPS-позиція", "Визначається пристроєм", "Для офлайн-попереджень заздалегідь завантажте базу камер потрібної країни.")
    case "en": return ("International database", "Published data", "The camera database is regularly updated", "We add new cameras and refine existing data.", "Database version", "GPS position", "Determined by your device", "Download the camera database for your country before using offline alerts.")
    case "pl": return ("Międzynarodowa baza", "Opublikowane dane", "Baza kamer jest regularnie aktualizowana", "Dodajemy nowe kamery i uściślamy istniejące dane.", "Wersja bazy", "Pozycja GPS", "Określana przez urządzenie", "Aby otrzymywać ostrzeżenia offline, pobierz wcześniej bazę kamer wybranego kraju.")
    default: return ("Международная база", "Опубликованные данные", "База камер регулярно обновляется", "Мы добавляем новые камеры и уточняем существующие данные.", "Версия базы", "GPS-позиция", "Определяется устройством", "Для офлайн-предупреждений заранее загрузите базу камер нужной страны.")
    }
  }

  private func card(_ icon: String, _ title: String, _ body: String) -> UIView {
    let mark = UILabel()
    mark.text = icon
    mark.textColor = UIColor(red: 35 / 255, green: 211 / 255, blue: 239 / 255, alpha: 1)
    mark.font = .camalert(22, weight: .bold)
    mark.setContentHuggingPriority(.required, for: .horizontal)
    let heading = UILabel()
    heading.text = title
    heading.textColor = .white
    heading.font = .camalert(16, weight: .bold)
    heading.numberOfLines = 2
    let detail = UILabel()
    detail.text = body
    detail.textColor = UIColor(red: 184 / 255, green: 200 / 255, blue: 218 / 255, alpha: 1)
    detail.font = .camalert(13)
    detail.numberOfLines = 0
    let headingRow = UIStackView(arrangedSubviews: [mark, heading])
    headingRow.axis = .horizontal
    headingRow.alignment = .center
    headingRow.spacing = 8
    let column = UIStackView(arrangedSubviews: [headingRow, detail])
    column.axis = .vertical
    column.spacing = 4
    column.layoutMargins = UIEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)
    column.isLayoutMarginsRelativeArrangement = true
    column.backgroundColor = UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1)
    column.layer.cornerRadius = 19
    column.layer.borderWidth = 1
    column.layer.borderColor = UIColor(red: 24 / 255, green: 52 / 255, blue: 73 / 255, alpha: 1).cgColor
    return column
  }

  private func notice(_ title: String?, _ body: String) -> UIView {
    let text = UILabel()
    text.numberOfLines = 0
    if let title {
      let value = NSMutableAttributedString(string: title + "\n", attributes: [.foregroundColor: UIColor.white, .font: UIFont.camalert(16, weight: .bold)])
      value.append(NSAttributedString(string: body, attributes: [.foregroundColor: UIColor(red: 184 / 255, green: 200 / 255, blue: 218 / 255, alpha: 1), .font: UIFont.camalert(13)]))
      text.attributedText = value
    } else {
      text.text = body
      text.textColor = UIColor(red: 184 / 255, green: 200 / 255, blue: 218 / 255, alpha: 1)
      text.font = .camalert(13)
    }
    let column = UIStackView(arrangedSubviews: [text])
    column.layoutMargins = UIEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)
    column.isLayoutMarginsRelativeArrangement = true
    column.backgroundColor = UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1)
    column.layer.cornerRadius = 19
    return column
  }

  @objc private func advance() {
    if page < 2 {
      page += 1
      render()
    } else {
      finish()
    }
  }

  @objc private func retreat() {
    if page > 0 {
      page -= 1
      render()
    } else {
      finish()
    }
  }

  @objc private func finish() {
    UserDefaults.standard.set(true, forKey: "camalert.welcome.done")
    NotificationCenter.default.post(name: .camalertShowTab, object: "drive")
    if presentingViewController != nil {
      dismiss(animated: true)
      return
    }
    if let delegate = view.window?.windowScene?.delegate as? SceneDelegate {
      delegate.showApp()
    }
  }
}
