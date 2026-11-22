import CoreLocation
import StoreKit
import UIKit

enum CamAlertPalette {
  static let blue = UIColor(red: 21 / 255, green: 88 / 255, blue: 237 / 255, alpha: 1)
  static let ink = UIColor(red: 16 / 255, green: 42 / 255, blue: 77 / 255, alpha: 1)
  static let cyan = UIColor(red: 23 / 255, green: 191 / 255, blue: 224 / 255, alpha: 1)
  static let page = UIColor(red: 247 / 255, green: 251 / 255, blue: 255 / 255, alpha: 1)
  static let nightPage = UIColor(red: 11 / 255, green: 24 / 255, blue: 41 / 255, alpha: 1)
  static let card = UIColor(red: 247 / 255, green: 250 / 255, blue: 254 / 255, alpha: 1)
  static let cardNight = UIColor(red: 23 / 255, green: 42 / 255, blue: 64 / 255, alpha: 1)
  static let line = UIColor(red: 225 / 255, green: 234 / 255, blue: 244 / 255, alpha: 1)
  static let lineNight = UIColor(red: 41 / 255, green: 67 / 255, blue: 90 / 255, alpha: 1)
  static let muted = UIColor(red: 67 / 255, green: 93 / 255, blue: 120 / 255, alpha: 1)
  static let mutedNight = UIColor(red: 202 / 255, green: 215 / 255, blue: 231 / 255, alpha: 1)
  static let gold = UIColor(red: 245 / 255, green: 182 / 255, blue: 76 / 255, alpha: 1)

  static func night(_ settings: AlertSettings) -> Bool {
    if settings.driveTheme == "day" { return false }
    if settings.driveTheme == "night" { return true }
    return UITraitCollection.current.userInterfaceStyle == .dark
  }

  static func flag(_ code: String) -> String {
    let scalars = code.uppercased().unicodeScalars
    let chars = scalars.compactMap { UnicodeScalar(127397 + $0.value) }.map(String.init)
    return chars.count == 2 ? chars.joined() : "🏳️"
  }
}

final class HomeViewController: UIViewController {
  private let session = CamAlertSession.shared
  private let scroll = UIScrollView()
  private let stack = UIStackView()
  private let statusLabel = UILabel()
  private var locationGranted = false

  override func viewDidLoad() {
    super.viewDidLoad()
    scroll.translatesAutoresizingMaskIntoConstraints = false
    scroll.alwaysBounceVertical = true
    stack.axis = .vertical
    stack.spacing = 10
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
      stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -24),
    ])
    Task { await session.catalog.refreshManifest() }
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    navigationController?.setNavigationBarHidden(true, animated: animated)
    locationGranted = CLLocationManager().authorizationStatus == .authorizedAlways || CLLocationManager().authorizationStatus == .authorizedWhenInUse
    rebuild()
  }

  private func rebuild() {
    stack.arrangedSubviews.forEach { $0.removeFromSuperview() }
    let night = CamAlertPalette.night(session.settings)
    view.backgroundColor = night ? CamAlertPalette.nightPage : CamAlertPalette.page
    let ink = night ? UIColor.white : CamAlertPalette.ink
    let muted = night ? CamAlertPalette.mutedNight : CamAlertPalette.muted
    let card = night ? CamAlertPalette.cardNight : CamAlertPalette.card
    let line = night ? CamAlertPalette.lineNight : CamAlertPalette.line

    stack.addArrangedSubview(header(night: night, ink: ink))
    stack.addArrangedSubview(statusRow(night: night, card: card, ink: ink, muted: muted))
    stack.addArrangedSubview(hero())
    stack.addArrangedSubview(titleBlock(ink: ink, muted: muted))
    stack.addArrangedSubview(filledButton("▶   Начать поездку", action: #selector(startTrip)))
    stack.addArrangedSubview(outlineButton("Куда едем?", night: night, action: #selector(openSearch)))
    stack.addArrangedSubview(sectionLabel("Выберите навигацию", color: ink))
    let nav = UIStackView(arrangedSubviews: [
      navCard("⌖", "Apple Maps", card: card, line: line, ink: muted, action: #selector(openApple)),
      navCard("📍", "Google Maps", card: card, line: line, ink: muted, action: #selector(openGoogle)),
    ])
    nav.axis = .horizontal
    nav.spacing = 7
    nav.distribution = .fillEqually
    stack.addArrangedSubview(nav)
    let note = UILabel()
    note.text = "Фоновые предупреждения рядом с навигатором ещё требуют настройки и проверки."
    note.font = .systemFont(ofSize: 11)
    note.textColor = muted
    note.numberOfLines = 0
    stack.addArrangedSubview(note)
    stack.addArrangedSubview(countryCard(card: card, line: line, ink: ink, muted: muted))
  }

  private func header(night: Bool, ink: UIColor) -> UIView {
    let brand = UILabel()
    let text = NSMutableAttributedString(string: "Cam", attributes: [.foregroundColor: ink, .font: UIFont.systemFont(ofSize: 28, weight: .black)])
    text.append(NSAttributedString(string: "Alert", attributes: [.foregroundColor: CamAlertPalette.cyan, .font: UIFont.systemFont(ofSize: 28, weight: .black)]))
    brand.attributedText = text
    let mark = UILabel()
    mark.text = "A"
    mark.font = .italicSystemFont(ofSize: 26)
    mark.textColor = CamAlertPalette.cyan
    mark.textAlignment = .center
    mark.backgroundColor = night ? CamAlertPalette.cardNight : UIColor(red: 229 / 255, green: 248 / 255, blue: 252 / 255, alpha: 1)
    mark.layer.cornerRadius = 11
    mark.clipsToBounds = true
    mark.translatesAutoresizingMaskIntoConstraints = false
    mark.widthAnchor.constraint(equalToConstant: 34).isActive = true
    mark.heightAnchor.constraint(equalToConstant: 34).isActive = true
    let settings = UIButton(type: .system)
    settings.setTitle("⚙", for: .normal)
    settings.titleLabel?.font = .systemFont(ofSize: 22)
    settings.tintColor = ink
    settings.backgroundColor = night ? CamAlertPalette.cardNight : UIColor(red: 241 / 255, green: 245 / 255, blue: 250 / 255, alpha: 1)
    settings.layer.cornerRadius = 14
    settings.addTarget(self, action: #selector(openSettings), for: .touchUpInside)
    settings.translatesAutoresizingMaskIntoConstraints = false
    settings.widthAnchor.constraint(equalToConstant: 48).isActive = true
    settings.heightAnchor.constraint(equalToConstant: 48).isActive = true
    let row = UIStackView(arrangedSubviews: [mark, brand, settings])
    row.axis = .horizontal
    row.alignment = .center
    row.spacing = 8
    return row
  }

  private func statusRow(night: Bool, card: UIColor, ink: UIColor, muted: UIColor) -> UIView {
    let statusFill = night ? card : UIColor(red: 234 / 255, green: 247 / 255, blue: 248 / 255, alpha: 1)
    let gps = statusCard("⌖", "GPS", locationGranted ? "Разрешение есть" : "Нужен доступ", ready: locationGranted, card: statusFill, ink: ink, muted: muted)
    let ready = session.catalog.totalRecords > 0 || !session.catalog.cameras(for: session.settings.country.uppercased()).isEmpty
    let base = statusCard("▤", "База камер", ready ? "Обновлена" : "Локальная база", ready: true, card: statusFill, ink: ink, muted: muted)
    let row = UIStackView(arrangedSubviews: [gps, base])
    row.axis = .horizontal
    row.spacing = 9
    row.distribution = .fillEqually
    return row
  }

  private func statusCard(_ icon: String, _ title: String, _ value: String, ready: Bool, card: UIColor, ink: UIColor, muted: UIColor) -> UIView {
    let box = UIStackView()
    box.axis = .horizontal
    box.spacing = 8
    box.alignment = .center
    box.layoutMargins = UIEdgeInsets(top: 8, left: 10, bottom: 8, right: 10)
    box.isLayoutMarginsRelativeArrangement = true
    box.backgroundColor = card
    box.layer.cornerRadius = 17
    let glyph = UILabel()
    glyph.text = icon
    glyph.font = .systemFont(ofSize: 26, weight: .bold)
    glyph.textColor = ink
    let name = UILabel()
    name.text = title
    name.font = .systemFont(ofSize: 12, weight: .bold)
    name.textColor = ink
    let dot = UIView()
    dot.backgroundColor = ready ? UIColor(red: 31 / 255, green: 184 / 255, blue: 73 / 255, alpha: 1) : UIColor(red: 224 / 255, green: 163 / 255, blue: 45 / 255, alpha: 1)
    dot.layer.cornerRadius = 4
    dot.translatesAutoresizingMaskIntoConstraints = false
    dot.widthAnchor.constraint(equalToConstant: 8).isActive = true
    dot.heightAnchor.constraint(equalToConstant: 8).isActive = true
    let detail = UILabel()
    detail.text = value
    detail.font = .systemFont(ofSize: 11, weight: .semibold)
    detail.textColor = muted
    let values = UIStackView(arrangedSubviews: [dot, detail])
    values.spacing = 5
    values.alignment = .center
    let column = UIStackView(arrangedSubviews: [name, values])
    column.axis = .vertical
    column.spacing = 3
    box.addArrangedSubview(glyph)
    box.addArrangedSubview(column)
    box.heightAnchor.constraint(greaterThanOrEqualToConstant: 58).isActive = true
    return box
  }

  private func hero() -> UIView {
    let image = UIImageView(image: UIImage(named: "onboarding-window-view"))
    image.contentMode = .scaleAspectFill
    image.clipsToBounds = true
    image.layer.cornerRadius = 21
    image.translatesAutoresizingMaskIntoConstraints = false
    image.heightAnchor.constraint(equalToConstant: 158).isActive = true
    let shade = UIView()
    shade.backgroundColor = UIColor(red: 9 / 255, green: 30 / 255, blue: 47 / 255, alpha: 0.18)
    shade.translatesAutoresizingMaskIntoConstraints = false
    image.addSubview(shade)
    NSLayoutConstraint.activate([
      shade.topAnchor.constraint(equalTo: image.topAnchor),
      shade.leadingAnchor.constraint(equalTo: image.leadingAnchor),
      shade.trailingAnchor.constraint(equalTo: image.trailingAnchor),
      shade.bottomAnchor.constraint(equalTo: image.bottomAnchor),
    ])
    return image
  }

  private func titleBlock(ink: UIColor, muted: UIColor) -> UIView {
    let title = UILabel()
    title.text = "В путь!"
    title.font = .systemFont(ofSize: 34, weight: .black)
    title.textColor = ink
    let subtitle = UILabel()
    subtitle.text = "Больше уверенности на каждой дороге"
    subtitle.font = .systemFont(ofSize: 17, weight: .medium)
    subtitle.textColor = muted
    subtitle.numberOfLines = 0
    let column = UIStackView(arrangedSubviews: [title, subtitle])
    column.axis = .vertical
    column.spacing = 2
    return column
  }

  private func filledButton(_ title: String, action: Selector) -> UIButton {
    let button = UIButton(type: .system)
    button.setTitle(title, for: .normal)
    button.setTitleColor(.white, for: .normal)
    button.titleLabel?.font = .systemFont(ofSize: 17, weight: .heavy)
    button.backgroundColor = CamAlertPalette.blue
    button.layer.cornerRadius = 20
    button.heightAnchor.constraint(equalToConstant: 58).isActive = true
    button.addTarget(self, action: action, for: .touchUpInside)
    return button
  }

  private func outlineButton(_ title: String, night: Bool, action: Selector) -> UIButton {
    let button = UIButton(type: .system)
    button.setTitle(title, for: .normal)
    button.setTitleColor(night ? UIColor(red: 214 / 255, green: 230 / 255, blue: 255 / 255, alpha: 1) : CamAlertPalette.blue, for: .normal)
    button.titleLabel?.font = .systemFont(ofSize: 17, weight: .heavy)
    button.backgroundColor = night ? UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1) : .white
    button.layer.cornerRadius = 20
    button.layer.borderWidth = 1.5
    button.layer.borderColor = (night ? UIColor(red: 126 / 255, green: 182 / 255, blue: 255 / 255, alpha: 1) : CamAlertPalette.blue).cgColor
    button.heightAnchor.constraint(equalToConstant: 54).isActive = true
    button.addTarget(self, action: action, for: .touchUpInside)
    return button
  }

  private func sectionLabel(_ text: String, color: UIColor) -> UILabel {
    let label = UILabel()
    label.text = text
    label.font = .systemFont(ofSize: 14, weight: .heavy)
    label.textColor = color
    return label
  }

  private func navCard(_ icon: String, _ title: String, card: UIColor, line: UIColor, ink: UIColor, action: Selector) -> UIButton {
    let button = UIButton(type: .system)
    button.backgroundColor = card
    button.layer.cornerRadius = 17
    button.layer.borderWidth = 1
    button.layer.borderColor = line.cgColor
    button.setTitle("\(icon)\n\(title)", for: .normal)
    button.titleLabel?.numberOfLines = 2
    button.titleLabel?.textAlignment = .center
    button.titleLabel?.font = .systemFont(ofSize: 12, weight: .bold)
    button.setTitleColor(ink, for: .normal)
    button.heightAnchor.constraint(equalToConstant: 82).isActive = true
    button.addTarget(self, action: action, for: .touchUpInside)
    return button
  }

  private func countryCard(card: UIColor, line: UIColor, ink: UIColor, muted: UIColor) -> UIView {
    let code = session.settings.country.uppercased()
    let count = session.catalog.cameras(for: code).count
    let name = session.catalog.countries.first { $0.code == code }?.name ?? (code == "UA" ? "Украина" : code)
    let flag = UILabel()
    flag.text = CamAlertPalette.flag(code)
    flag.font = .systemFont(ofSize: 36)
    let title = UILabel()
    title.text = "\(name) · \(count > 0 ? "База загружена" : "Базы пока нет")"
    title.font = .systemFont(ofSize: 15, weight: .heavy)
    title.textColor = ink
    let meta = UILabel()
    meta.text = count > 0 ? "Доступна офлайн" : "Офлайн не подтверждён"
    meta.font = .systemFont(ofSize: 12)
    meta.textColor = muted
    let update = UILabel()
    update.text = "\(count) камер"
    update.font = .systemFont(ofSize: 11)
    update.textColor = muted
    let column = UIStackView(arrangedSubviews: [title, meta, update])
    column.axis = .vertical
    column.spacing = 2
    let chevron = UILabel()
    chevron.text = "›"
    chevron.font = .systemFont(ofSize: 30, weight: .regular)
    chevron.textColor = ink
    let row = UIStackView(arrangedSubviews: [flag, column, chevron])
    row.axis = .horizontal
    row.alignment = .center
    row.spacing = 12
    row.layoutMargins = UIEdgeInsets(top: 10, left: 13, bottom: 10, right: 13)
    row.isLayoutMarginsRelativeArrangement = true
    row.backgroundColor = card
    row.layer.cornerRadius = 19
    row.layer.borderWidth = 1
    row.layer.borderColor = line.cgColor
    row.isUserInteractionEnabled = true
    row.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(openCountries)))
    row.heightAnchor.constraint(greaterThanOrEqualToConstant: 78).isActive = true
    return row
  }

  @objc private func startTrip() { navigationController?.pushViewController(ViewController(), animated: true) }
  @objc private func openSearch() {
    let drive = ViewController()
    drive.focusSearch = true
    navigationController?.pushViewController(drive, animated: true)
  }
  @objc private func openCountries() { navigationController?.pushViewController(CountriesViewController(), animated: true) }
  @objc private func openSettings() { navigationController?.pushViewController(SettingsViewController(), animated: true) }
  @objc private func openApple() {
    if let url = URL(string: "http://maps.apple.com/?dirflg=d") { UIApplication.shared.open(url) }
  }
  @objc private func openGoogle() { startTrip() }
}

final class SettingsViewController: UIViewController {
  private let session = CamAlertSession.shared
  private let scroll = UIScrollView()
  private let stack = UIStackView()

  override func viewDidLoad() {
    super.viewDidLoad()
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
      stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: 12),
      stack.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 16),
      stack.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -16),
      stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -28),
    ])
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    navigationController?.setNavigationBarHidden(true, animated: animated)
    rebuild()
  }

  private func rebuild() {
    stack.arrangedSubviews.forEach { $0.removeFromSuperview() }
    let night = CamAlertPalette.night(session.settings)
    view.backgroundColor = night ? CamAlertPalette.nightPage : CamAlertPalette.page
    let ink = night ? UIColor.white : CamAlertPalette.ink
    let muted = night ? CamAlertPalette.mutedNight : CamAlertPalette.muted
    stack.addArrangedSubview(backButton("Назад"))
    let title = UILabel()
    title.text = "Настройки"
    title.font = .systemFont(ofSize: 28, weight: .black)
    title.textColor = ink
    stack.addArrangedSubview(title)
    stack.addArrangedSubview(toggle("Предупреждения о камерах", session.settings.cameraWarnings) { self.session.settings.cameraWarnings = $0; self.session.save() })
    stack.addArrangedSubview(linkRow("Правила по странам", action: #selector(openLaws)))
    let lawsNote = UILabel()
    lawsNote.text = "Раздел только сообщает о местных ограничениях. Он не включает и не выключает предупреждения."
    lawsNote.numberOfLines = 0
    lawsNote.font = .systemFont(ofSize: 13)
    lawsNote.textColor = muted
    stack.addArrangedSubview(lawsNote)
    stack.addArrangedSubview(premiumEntry())
    stack.addArrangedSubview(linkRow("Как пользоваться", action: #selector(openHelp)))
    stack.addArrangedSubview(linkRow("Посмотреть приветствие", action: #selector(openWelcome)))
    stack.addArrangedSubview(linkRow("История предупреждений", action: #selector(openHistory)))
    stack.addArrangedSubview(linkRow("Сообщить о камере", action: #selector(openReport)))
    stack.addArrangedSubview(heading("Тема приложения", ink))
    let themes = UIStackView()
    themes.axis = .horizontal
    themes.spacing = 8
    themes.distribution = .fillEqually
    for (value, label) in [("auto", "Авто"), ("night", "Ночная поездка"), ("day", "Дневная поездка")] {
      let button = UIButton(type: .system)
      button.setTitle(label, for: .normal)
      button.titleLabel?.font = .systemFont(ofSize: 13, weight: .bold)
      button.titleLabel?.numberOfLines = 2
      button.titleLabel?.textAlignment = .center
      button.layer.cornerRadius = 12
      let selected = session.settings.driveTheme == value
      button.backgroundColor = selected ? CamAlertPalette.blue : (night ? CamAlertPalette.cardNight : UIColor(white: 0.93, alpha: 1))
      button.setTitleColor(selected ? .white : ink, for: .normal)
      button.heightAnchor.constraint(equalToConstant: 52).isActive = true
      button.addAction(UIAction { _ in
        self.session.settings.driveTheme = value
        self.session.settings.nightDrive = value == "night"
        self.session.save()
        self.rebuild()
      }, for: .touchUpInside)
      themes.addArrangedSubview(button)
    }
    stack.addArrangedSubview(themes)
    stack.addArrangedSubview(heading("Язык", ink))
    let languages = UIStackView()
    languages.axis = .horizontal
    languages.spacing = 8
    languages.distribution = .fillEqually
    for code in ["ru", "uk", "en", "pl"] {
      let button = UIButton(type: .system)
      button.setTitle(code == "uk" ? "UA" : code.uppercased(), for: .normal)
      let selected = session.settings.language == code
      button.backgroundColor = selected ? UIColor(red: 207 / 255, green: 215 / 255, blue: 255 / 255, alpha: 1) : UIColor(white: 0.93, alpha: 1)
      button.setTitleColor(ink, for: .normal)
      button.layer.cornerRadius = 12
      button.heightAnchor.constraint(equalToConstant: 48).isActive = true
      button.addAction(UIAction { _ in
        self.session.settings.language = code
        self.session.save()
        self.rebuild()
      }, for: .touchUpInside)
      languages.addArrangedSubview(button)
    }
    stack.addArrangedSubview(languages)
    stack.addArrangedSubview(toggle("Голос", session.settings.voice) { self.session.settings.voice = $0; self.session.save() })
    stack.addArrangedSubview(toggle("Вибрация", session.settings.vibration) { self.session.settings.vibration = $0; self.session.save() })
    stack.addArrangedSubview(toggle("Умная дистанция по скорости", session.settings.smartDistance) { self.session.settings.smartDistance = $0; self.session.save() })
    stack.addArrangedSubview(heading("Настройки дистанции и предупреждений", ink))
    stack.addArrangedSubview(distance("До 60 км/ч", \.cityDistance))
    stack.addArrangedSubview(distance("60–89 км/ч", \.roadDistance))
    stack.addArrangedSubview(distance("90–119 км/ч", \.highwayDistance))
    stack.addArrangedSubview(distance("120+ км/ч", \.fastDistance))
    stack.addArrangedSubview(linkRow("Политика конфиденциальности", action: #selector(openPrivacy)))
  }

  private func heading(_ text: String, _ color: UIColor) -> UILabel {
    let label = UILabel()
    label.text = text
    label.font = .systemFont(ofSize: 18, weight: .heavy)
    label.textColor = color
    label.numberOfLines = 0
    return label
  }

  private func backButton(_ title: String) -> UIButton {
    let button = UIButton(type: .system)
    button.setTitle("‹  \(title)", for: .normal)
    button.setTitleColor(CamAlertPalette.blue, for: .normal)
    button.titleLabel?.font = .systemFont(ofSize: 17, weight: .bold)
    button.contentHorizontalAlignment = .left
    button.addTarget(self, action: #selector(goBack), for: .touchUpInside)
    return button
  }

  private func toggle(_ title: String, _ value: Bool, changed: @escaping (Bool) -> Void) -> UIView {
    let label = UILabel()
    label.text = title
    label.font = .systemFont(ofSize: 15)
    label.textColor = CamAlertPalette.night(session.settings) ? .white : CamAlertPalette.ink
    label.numberOfLines = 0
    let toggle = UISwitch()
    toggle.isOn = value
    toggle.onTintColor = CamAlertPalette.blue
    toggle.addAction(UIAction { _ in changed(toggle.isOn) }, for: .valueChanged)
    let row = UIStackView(arrangedSubviews: [label, toggle])
    row.alignment = .center
    row.spacing = 12
    return row
  }

  private func distance(_ title: String, _ key: WritableKeyPath<AlertSettings, Double>) -> UIView {
    let label = UILabel()
    label.text = title
    label.font = .systemFont(ofSize: 15)
    label.textColor = CamAlertPalette.night(session.settings) ? .white : CamAlertPalette.ink
    let value = UILabel()
    value.text = "\(Int(session.settings[keyPath: key])) м"
    value.font = .systemFont(ofSize: 15, weight: .bold)
    value.textColor = label.textColor
    value.textAlignment = .center
    value.widthAnchor.constraint(equalToConstant: 72).isActive = true
    let minus = stepper("−") {
      self.session.settings[keyPath: key] = max(200, self.session.settings[keyPath: key] - 100)
      self.session.save()
      self.rebuild()
    }
    let plus = stepper("＋") {
      self.session.settings[keyPath: key] = min(3000, self.session.settings[keyPath: key] + 100)
      self.session.save()
      self.rebuild()
    }
    let controls = UIStackView(arrangedSubviews: [minus, value, plus])
    controls.spacing = 6
    controls.alignment = .center
    let row = UIStackView(arrangedSubviews: [label, controls])
    row.alignment = .center
    return row
  }

  private func stepper(_ title: String, action: @escaping () -> Void) -> UIButton {
    let button = UIButton(type: .system)
    button.setTitle(title, for: .normal)
    button.backgroundColor = UIColor(white: 0.93, alpha: 1)
    button.setTitleColor(CamAlertPalette.ink, for: .normal)
    button.layer.cornerRadius = 10
    button.widthAnchor.constraint(equalToConstant: 44).isActive = true
    button.heightAnchor.constraint(equalToConstant: 44).isActive = true
    button.addAction(UIAction { _ in action() }, for: .touchUpInside)
    return button
  }

  private func linkRow(_ title: String, action: Selector) -> UIButton {
    let button = UIButton(type: .system)
    button.setTitle(title, for: .normal)
    button.setTitleColor(CamAlertPalette.blue, for: .normal)
    button.contentHorizontalAlignment = .left
    button.titleLabel?.font = .systemFont(ofSize: 16, weight: .bold)
    button.addTarget(self, action: action, for: .touchUpInside)
    button.heightAnchor.constraint(equalToConstant: 44).isActive = true
    return button
  }

  private func premiumEntry() -> UIButton {
    let button = UIButton(type: .system)
    button.backgroundColor = UIColor(red: 26 / 255, green: 50 / 255, blue: 112 / 255, alpha: 1)
    button.layer.cornerRadius = 18
    button.layer.borderWidth = 1
    button.layer.borderColor = UIColor(red: 201 / 255, green: 161 / 255, blue: 91 / 255, alpha: 1).cgColor
    button.setTitle("★   CamAlert Premium\nБольше возможностей в каждой поездке", for: .normal)
    button.titleLabel?.numberOfLines = 2
    button.setTitleColor(.white, for: .normal)
    button.contentHorizontalAlignment = .left
    button.contentEdgeInsets = UIEdgeInsets(top: 12, left: 14, bottom: 12, right: 14)
    button.addTarget(self, action: #selector(openPremium), for: .touchUpInside)
    return button
  }

  @objc private func goBack() { navigationController?.popViewController(animated: true) }
  @objc private func openLaws() { navigationController?.pushViewController(LawsViewController(), animated: true) }
  @objc private func openHelp() { navigationController?.pushViewController(HelpViewController(), animated: true) }
  @objc private func openWelcome() { navigationController?.pushViewController(WelcomeViewController(), animated: true) }
  @objc private func openHistory() { navigationController?.pushViewController(HistoryViewController(), animated: true) }
  @objc private func openReport() { navigationController?.pushViewController(ReportViewController(), animated: true) }
  @objc private func openPremium() { navigationController?.pushViewController(PremiumViewController(), animated: true) }
  @objc private func openPrivacy() {
    if let url = URL(string: "https://camera.21wek.com/privacy.html") { UIApplication.shared.open(url) }
  }
}

final class CountriesViewController: UIViewController, UITableViewDataSource, UITableViewDelegate, UISearchBarDelegate {
  private let session = CamAlertSession.shared
  private let table = UITableView(frame: .zero, style: .plain)
  private let search = UISearchBar()
  private var rows: [CountryListing] = []

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = CamAlertPalette.night(session.settings) ? CamAlertPalette.nightPage : CamAlertPalette.page
    search.placeholder = "Найти страну"
    search.delegate = self
    search.searchBarStyle = .minimal
    search.translatesAutoresizingMaskIntoConstraints = false
    table.dataSource = self
    table.delegate = self
    table.backgroundColor = .clear
    table.translatesAutoresizingMaskIntoConstraints = false
    let back = UIButton(type: .system)
    back.setTitle("‹  Назад", for: .normal)
    back.setTitleColor(CamAlertPalette.blue, for: .normal)
    back.titleLabel?.font = .systemFont(ofSize: 17, weight: .bold)
    back.addTarget(self, action: #selector(goBack), for: .touchUpInside)
    back.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(back)
    view.addSubview(search)
    view.addSubview(table)
    NSLayoutConstraint.activate([
      back.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
      back.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      search.topAnchor.constraint(equalTo: back.bottomAnchor, constant: 8),
      search.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 8),
      search.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -8),
      table.topAnchor.constraint(equalTo: search.bottomAnchor),
      table.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      table.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      table.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])
    reloadRows("")
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    navigationController?.setNavigationBarHidden(true, animated: animated)
  }

  private func reloadRows(_ query: String) {
    let all = session.catalog.countries.isEmpty
      ? [
        CountryListing(code: "UA", name: "Украина", recordCount: session.catalog.cameras(for: "UA").count, version: nil, path: nil, sizeBytes: nil, checksum: nil),
        CountryListing(code: "PL", name: "Польша", recordCount: session.catalog.cameras(for: "PL").count, version: nil, path: nil, sizeBytes: nil, checksum: nil),
      ]
      : session.catalog.countries
    let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    rows = needle.isEmpty ? all : all.filter { $0.name.lowercased().contains(needle) || $0.code.lowercased().contains(needle) }
    table.reloadData()
  }

  func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { rows.count }
  func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = UITableViewCell(style: .subtitle, reuseIdentifier: nil)
    let row = rows[indexPath.row]
    let selected = row.code == session.settings.country.uppercased()
    let local = session.catalog.cameras(for: row.code).count
    cell.textLabel?.text = "\(CamAlertPalette.flag(row.code))  \(row.name)\(selected ? " · выбрана" : "")"
    cell.detailTextLabel?.text = local > 0 ? "\(local) камер · доступна без интернета" : "\(row.recordCount) камер · нажмите, чтобы загрузить"
    cell.backgroundColor = CamAlertPalette.night(session.settings) ? CamAlertPalette.cardNight : .white
    cell.textLabel?.textColor = CamAlertPalette.night(session.settings) ? .white : CamAlertPalette.ink
    cell.detailTextLabel?.textColor = CamAlertPalette.night(session.settings) ? CamAlertPalette.mutedNight : CamAlertPalette.muted
    cell.accessoryType = selected ? .checkmark : .none
    return cell
  }
  func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    let code = rows[indexPath.row].code
    session.settings.country = code
    session.save()
    tableView.reloadData()
    Task {
      let error = await session.catalog.ensureCountry(code)
      await MainActor.run {
        self.search.prompt = error
        self.reloadRows(self.search.text ?? "")
      }
    }
  }
  func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) { reloadRows(searchText) }
  @objc private func goBack() { navigationController?.popViewController(animated: true) }
}

final class PremiumViewController: UIViewController {
  private let session = CamAlertSession.shared
  private var products: [Product] = []
  private var selected = "camalert_premium_yearly"
  private let status = UILabel()
  private let plans = UIStackView()

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(red: 8 / 255, green: 15 / 255, blue: 41 / 255, alpha: 1)
    let scroll = UIScrollView()
    scroll.translatesAutoresizingMaskIntoConstraints = false
    let stack = UIStackView()
    stack.axis = .vertical
    stack.spacing = 10
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(scroll)
    scroll.addSubview(stack)
    NSLayoutConstraint.activate([
      scroll.topAnchor.constraint(equalTo: view.topAnchor),
      scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
      stack.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 16),
      stack.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -16),
      stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -24),
    ])
    stack.addArrangedSubview(hero())
    let slides = UILabel()
    slides.numberOfLines = 0
    slides.textColor = UIColor(red: 155 / 255, green: 176 / 255, blue: 199 / 255, alpha: 1)
    slides.font = .systemFont(ofSize: 15)
    slides.text = "Камеры — предупреждение до камеры, на экране и голосом.\nНавигация — маршрут и ведение по дороге.\nГолос — повороты и камеры произносятся вслух.\nФон — предупреждения идут и при погашенном экране.\nНастройки — дистанция, звуки и оформление поездки."
    stack.addArrangedSubview(slides)
    plans.axis = .vertical
    plans.spacing = 6
    stack.addArrangedSubview(plans)
    status.numberOfLines = 0
    status.textColor = .white
    status.font = .systemFont(ofSize: 14)
    status.text = "В опубликованной версии навигация и предупреждения открыты. Покупки ниже — те же продукты StoreKit."
    stack.addArrangedSubview(status)
    let unlock = UIButton(type: .system)
    unlock.setTitle("Разблокировать PRO  ›", for: .normal)
    unlock.setTitleColor(UIColor(red: 42 / 255, green: 22 / 255, blue: 8 / 255, alpha: 1), for: .normal)
    unlock.titleLabel?.font = .systemFont(ofSize: 18, weight: .heavy)
    unlock.backgroundColor = CamAlertPalette.gold
    unlock.layer.cornerRadius = 16
    unlock.heightAnchor.constraint(equalToConstant: 54).isActive = true
    unlock.addTarget(self, action: #selector(buySelected), for: .touchUpInside)
    stack.addArrangedSubview(unlock)
    let charge = UILabel()
    charge.text = "CamAlert деньги не списывает. Оплату проводит Apple."
    charge.textColor = UIColor(red: 155 / 255, green: 176 / 255, blue: 199 / 255, alpha: 1)
    charge.font = .systemFont(ofSize: 13)
    charge.numberOfLines = 0
    stack.addArrangedSubview(charge)
    let restore = UIButton(type: .system)
    restore.setTitle("↻  Восстановить покупки", for: .normal)
    restore.setTitleColor(.white, for: .normal)
    restore.addTarget(self, action: #selector(restorePurchases), for: .touchUpInside)
    stack.addArrangedSubview(restore)
    Task { await loadProducts() }
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    navigationController?.setNavigationBarHidden(true, animated: animated)
  }

  private func hero() -> UIView {
    let image = UIImageView(image: UIImage(named: "pro-evening-road"))
    image.contentMode = .scaleAspectFill
    image.clipsToBounds = true
    image.layer.cornerRadius = 24
    image.translatesAutoresizingMaskIntoConstraints = false
    image.heightAnchor.constraint(equalToConstant: 280).isActive = true
    let shade = UIView()
    shade.backgroundColor = UIColor(red: 8 / 255, green: 12 / 255, blue: 32 / 255, alpha: 0.28)
    shade.translatesAutoresizingMaskIntoConstraints = false
    let back = UIButton(type: .system)
    back.setTitle("×", for: .normal)
    back.setTitleColor(.white, for: .normal)
    back.titleLabel?.font = .systemFont(ofSize: 28, weight: .bold)
    back.addTarget(self, action: #selector(goBack), for: .touchUpInside)
    back.translatesAutoresizingMaskIntoConstraints = false
    let brand = UILabel()
    brand.text = "CamAlert  PRO"
    brand.textColor = .white
    brand.font = .systemFont(ofSize: 22, weight: .black)
    let headline = UILabel()
    headline.text = "Штрафы в прошлом."
    headline.textColor = .white
    headline.font = .systemFont(ofSize: 30, weight: .black)
    headline.numberOfLines = 0
    let lead = UILabel()
    lead.text = "Предупреждения о камерах, удобная навигация и уверенность в дороге."
    lead.textColor = UIColor(red: 246 / 255, green: 244 / 255, blue: 241 / 255, alpha: 1)
    lead.font = .systemFont(ofSize: 15, weight: .medium)
    lead.numberOfLines = 0
    let text = UIStackView(arrangedSubviews: [brand, headline, lead])
    text.axis = .vertical
    text.spacing = 6
    text.translatesAutoresizingMaskIntoConstraints = false
    image.addSubview(shade)
    image.addSubview(back)
    image.addSubview(text)
    NSLayoutConstraint.activate([
      shade.topAnchor.constraint(equalTo: image.topAnchor),
      shade.leadingAnchor.constraint(equalTo: image.leadingAnchor),
      shade.trailingAnchor.constraint(equalTo: image.trailingAnchor),
      shade.bottomAnchor.constraint(equalTo: image.bottomAnchor),
      back.topAnchor.constraint(equalTo: image.topAnchor, constant: 12),
      back.leadingAnchor.constraint(equalTo: image.leadingAnchor, constant: 12),
      text.leadingAnchor.constraint(equalTo: image.leadingAnchor, constant: 16),
      text.trailingAnchor.constraint(equalTo: image.trailingAnchor, constant: -16),
      text.bottomAnchor.constraint(equalTo: image.bottomAnchor, constant: -18),
    ])
    return image
  }

  private func loadProducts() async {
    let names = ["camalert_premium_weekly": "Неделя", "camalert_premium_monthly": "Месяц", "camalert_premium_yearly": "Год", "camalert_premium_lifetime": "Навсегда"]
    products = (try? await Product.products(for: PremiumAccess.plans)) ?? []
    let ordered = PremiumAccess.plans.compactMap { id in products.first { $0.id == id } }
    await MainActor.run {
      self.plans.arrangedSubviews.forEach { $0.removeFromSuperview() }
      let shown = ordered.isEmpty ? PremiumAccess.plans.map { ($0, names[$0] ?? $0, "Цена появится из магазина") } : ordered.map { ($0.id, names[$0.id] ?? $0.displayName, $0.displayPrice) }
      for item in shown {
        let button = UIButton(type: .system)
        button.setTitle("\(item.1)          \(item.2)", for: .normal)
        button.contentHorizontalAlignment = .left
        button.contentEdgeInsets = UIEdgeInsets(top: 0, left: 14, bottom: 0, right: 14)
        button.backgroundColor = item.0 == self.selected ? UIColor(red: 23 / 255, green: 50 / 255, blue: 78 / 255, alpha: 1) : UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1)
        button.layer.cornerRadius = 14
        button.layer.borderWidth = 1
        button.layer.borderColor = (item.0 == "camalert_premium_yearly" ? CamAlertPalette.gold : UIColor(red: 30 / 255, green: 61 / 255, blue: 92 / 255, alpha: 1)).cgColor
        button.setTitleColor(.white, for: .normal)
        button.heightAnchor.constraint(equalToConstant: 48).isActive = true
        button.addAction(UIAction { _ in
          self.selected = item.0
          self.loadAgain()
        }, for: .touchUpInside)
        self.plans.addArrangedSubview(button)
      }
      if ordered.isEmpty { self.status.text = (self.status.text ?? "") + "\nПродукты StoreKit пока не пришли из App Store." }
    }
  }

  private func loadAgain() { Task { await loadProducts() } }

  @objc private func buySelected() {
    guard let product = products.first(where: { $0.id == selected }) else {
      status.text = "Этот продукт ещё не пришёл из App Store."
      return
    }
    Task {
      do {
        let result = try await product.purchase()
        if case .success(let verification) = result, case .verified = verification {
          await MainActor.run { self.status.text = "Магазин подтвердил покупку: \(product.displayName)" }
        }
      } catch {
        await MainActor.run { self.status.text = "Покупка не завершилась" }
      }
    }
  }

  @objc private func restorePurchases() {
    Task {
      try? await AppStore.sync()
      await MainActor.run { self.status.text = "Запрос восстановления отправлен в App Store." }
    }
  }

  @objc private func goBack() { navigationController?.popViewController(animated: true) }
}

final class HelpViewController: UIViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
    let night = CamAlertPalette.night(CamAlertSession.shared.settings)
    view.backgroundColor = night ? CamAlertPalette.nightPage : CamAlertPalette.page
    let text = UITextView()
    text.isEditable = false
    text.backgroundColor = .clear
    text.textColor = night ? CamAlertPalette.mutedNight : CamAlertPalette.ink
    text.font = .systemFont(ofSize: 16)
    text.text = """
    Как пользоваться

    Голосовая навигация
    Откройте поездку. В настройках должны быть включены «Голос» и предупреждения о камерах.
    Голос поворотов появляется после кнопки «В путь». «Начать поездку» включает GPS и предупреждения о камерах, но не произносит манёвры маршрута.

    Маршрут и кнопка «В путь»
    Найдите адрес в поле «Куда едем?» или выберите точку на карте, нажмите «Построить маршрут», затем «В путь».
    Google произносит ближайший поворот сразу после «В путь».
    Пока звучит предупреждение о камере, подсказки Google замолкают и возвращаются после него.

    Предупреждения о камерах без маршрута
    Нажмите «Начать поездку». Ту же камеру приложение не повторяет, пока вы не приблизились к ней ещё на 250 метров.

    Фоновая работа
    Чтобы предупреждения продолжались при заблокированном экране, нужна геолокация «Всегда». После принудительного закрытия приложения сессию нужно начать снова.
    """
    text.translatesAutoresizingMaskIntoConstraints = false
    let back = UIButton(type: .system)
    back.setTitle("‹  Назад", for: .normal)
    back.setTitleColor(CamAlertPalette.blue, for: .normal)
    back.titleLabel?.font = .systemFont(ofSize: 17, weight: .bold)
    back.addTarget(self, action: #selector(goBack), for: .touchUpInside)
    back.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(back)
    view.addSubview(text)
    NSLayoutConstraint.activate([
      back.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
      back.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      text.topAnchor.constraint(equalTo: back.bottomAnchor, constant: 8),
      text.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      text.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
      text.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])
  }
  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    navigationController?.setNavigationBarHidden(true, animated: animated)
  }
  @objc private func goBack() { navigationController?.popViewController(animated: true) }
}

final class LawsViewController: UIViewController, UITableViewDataSource, UISearchBarDelegate {
  private struct Notice { var name: String; var status: String; var text: String; var source: String }
  private var rows: [Notice] = []
  private var all: [Notice] = []
  private let table = UITableView(frame: .zero, style: .plain)
  private let search = UISearchBar()

  override func viewDidLoad() {
    super.viewDidLoad()
    let night = CamAlertPalette.night(CamAlertSession.shared.settings)
    view.backgroundColor = night ? CamAlertPalette.nightPage : CamAlertPalette.page
    if let url = Bundle.main.url(forResource: "laws", withExtension: "json"),
       let data = try? Data(contentsOf: url),
       let json = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
      all = json.compactMap { row in
        guard let name = row["name"] as? String else { return nil }
        return Notice(name: name, status: row["status"] as? String ?? "", text: row["text"] as? String ?? "", source: row["source"] as? String ?? "")
      }
    }
    rows = all
    search.placeholder = "Поиск страны"
    search.delegate = self
    search.searchBarStyle = .minimal
    search.translatesAutoresizingMaskIntoConstraints = false
    table.dataSource = self
    table.backgroundColor = .clear
    table.rowHeight = UITableView.automaticDimension
    table.estimatedRowHeight = 88
    table.translatesAutoresizingMaskIntoConstraints = false
    let back = UIButton(type: .system)
    back.setTitle("‹  Назад", for: .normal)
    back.setTitleColor(CamAlertPalette.blue, for: .normal)
    back.titleLabel?.font = .systemFont(ofSize: 17, weight: .bold)
    back.addTarget(self, action: #selector(goBack), for: .touchUpInside)
    back.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(back)
    view.addSubview(search)
    view.addSubview(table)
    NSLayoutConstraint.activate([
      back.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
      back.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      search.topAnchor.constraint(equalTo: back.bottomAnchor),
      search.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      search.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      table.topAnchor.constraint(equalTo: search.bottomAnchor),
      table.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      table.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      table.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])
  }
  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    navigationController?.setNavigationBarHidden(true, animated: animated)
  }
  func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { rows.count }
  func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = UITableViewCell(style: .subtitle, reuseIdentifier: nil)
    let row = rows[indexPath.row]
    cell.textLabel?.text = row.name
    cell.detailTextLabel?.text = "\(row.status)\n\(row.text)"
    cell.detailTextLabel?.numberOfLines = 4
    cell.textLabel?.textColor = CamAlertPalette.night(CamAlertSession.shared.settings) ? .white : CamAlertPalette.ink
    cell.detailTextLabel?.textColor = CamAlertPalette.muted
    cell.backgroundColor = .clear
    return cell
  }
  func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
    let needle = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    rows = needle.isEmpty ? all : all.filter { $0.name.lowercased().contains(needle) }
    table.reloadData()
  }
  @objc private func goBack() { navigationController?.popViewController(animated: true) }
}

final class HistoryViewController: UIViewController, UITableViewDataSource {
  private let rows: [[String: String]]
  private let table = UITableView()
  init() {
    rows = UserDefaults.standard.array(forKey: "camalert.history") as? [[String: String]] ?? []
    super.init(nibName: nil, bundle: nil)
  }
  required init?(coder: NSCoder) { nil }
  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = CamAlertPalette.night(CamAlertSession.shared.settings) ? CamAlertPalette.nightPage : CamAlertPalette.page
    table.dataSource = self
    table.backgroundColor = .clear
    table.translatesAutoresizingMaskIntoConstraints = false
    let back = UIButton(type: .system)
    back.setTitle("‹  Назад", for: .normal)
    back.setTitleColor(CamAlertPalette.blue, for: .normal)
    back.titleLabel?.font = .systemFont(ofSize: 17, weight: .bold)
    back.addTarget(self, action: #selector(goBack), for: .touchUpInside)
    back.translatesAutoresizingMaskIntoConstraints = false
    let title = UILabel()
    title.text = rows.isEmpty ? "Предупреждений пока не было." : "История"
    title.textColor = CamAlertPalette.night(CamAlertSession.shared.settings) ? .white : CamAlertPalette.ink
    title.font = .systemFont(ofSize: 22, weight: .heavy)
    title.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(back)
    view.addSubview(title)
    view.addSubview(table)
    NSLayoutConstraint.activate([
      back.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
      back.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      title.topAnchor.constraint(equalTo: back.bottomAnchor, constant: 12),
      title.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      table.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 8),
      table.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      table.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      table.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])
  }
  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    navigationController?.setNavigationBarHidden(true, animated: animated)
  }
  func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { rows.count }
  func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = UITableViewCell(style: .subtitle, reuseIdentifier: nil)
    cell.textLabel?.text = rows[indexPath.row]["title"]
    cell.detailTextLabel?.text = rows[indexPath.row]["when"]
    cell.backgroundColor = .clear
    cell.textLabel?.textColor = CamAlertPalette.night(CamAlertSession.shared.settings) ? .white : CamAlertPalette.ink
    return cell
  }
  @objc private func goBack() { navigationController?.popViewController(animated: true) }
}

final class ReportViewController: UIViewController {
  private let note = UITextView()
  override func viewDidLoad() {
    super.viewDidLoad()
    let night = CamAlertPalette.night(CamAlertSession.shared.settings)
    view.backgroundColor = night ? CamAlertPalette.nightPage : CamAlertPalette.page
    let back = UIButton(type: .system)
    back.setTitle("‹  Назад", for: .normal)
    back.setTitleColor(CamAlertPalette.blue, for: .normal)
    back.titleLabel?.font = .systemFont(ofSize: 17, weight: .bold)
    back.addTarget(self, action: #selector(goBack), for: .touchUpInside)
    back.translatesAutoresizingMaskIntoConstraints = false
    let title = UILabel()
    title.text = "Сообщить о камере"
    title.font = .systemFont(ofSize: 24, weight: .heavy)
    title.textColor = night ? .white : CamAlertPalette.ink
    title.translatesAutoresizingMaskIntoConstraints = false
    note.font = .systemFont(ofSize: 16)
    note.layer.cornerRadius = 14
    note.layer.borderWidth = 1
    note.layer.borderColor = CamAlertPalette.line.cgColor
    note.backgroundColor = night ? CamAlertPalette.cardNight : .white
    note.textColor = night ? .white : CamAlertPalette.ink
    note.text = "Комментарий, например направление или тип камеры"
    note.translatesAutoresizingMaskIntoConstraints = false
    let send = UIButton(type: .system)
    send.setTitle("Отправить", for: .normal)
    send.setTitleColor(.white, for: .normal)
    send.backgroundColor = CamAlertPalette.blue
    send.layer.cornerRadius = 16
    send.addTarget(self, action: #selector(sendReport), for: .touchUpInside)
    send.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(back)
    view.addSubview(title)
    view.addSubview(note)
    view.addSubview(send)
    NSLayoutConstraint.activate([
      back.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
      back.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      title.topAnchor.constraint(equalTo: back.bottomAnchor, constant: 12),
      title.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      note.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 12),
      note.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      note.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
      note.heightAnchor.constraint(equalToConstant: 140),
      send.topAnchor.constraint(equalTo: note.bottomAnchor, constant: 16),
      send.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      send.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
      send.heightAnchor.constraint(equalToConstant: 52),
    ])
  }
  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    navigationController?.setNavigationBarHidden(true, animated: animated)
  }
  @objc private func sendReport() {
    var rows = UserDefaults.standard.array(forKey: "camalert.reports") as? [String] ?? []
    rows.insert(note.text ?? "", at: 0)
    UserDefaults.standard.set(rows, forKey: "camalert.reports")
    navigationController?.popViewController(animated: true)
  }
  @objc private func goBack() { navigationController?.popViewController(animated: true) }
}

final class WelcomeViewController: UIViewController {
  private var page = 0
  private let image = UIImageView()
  private let body = UILabel()
  private let pages = [
    ("onboarding-first-frame", "Уверенность на каждом километре", "Ваш помощник в дороге: предупреждения о камерах и контроль скорости."),
    ("onboarding-coastal", "Камеры впереди", "Знайте о камерах заранее. Предупреждения звучат во время поездки."),
    ("onboarding-world", "Камеры по всему миру", "Загрузите базу нужной страны заранее и получайте предупреждения даже без интернета."),
  ]

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(red: 7 / 255, green: 21 / 255, blue: 37 / 255, alpha: 1)
    image.contentMode = .scaleAspectFill
    image.clipsToBounds = true
    image.translatesAutoresizingMaskIntoConstraints = false
    body.numberOfLines = 0
    body.textColor = .white
    body.font = .systemFont(ofSize: 18, weight: .medium)
    body.translatesAutoresizingMaskIntoConstraints = false
    let skip = UIButton(type: .system)
    skip.setTitle("Пропустить", for: .normal)
    skip.setTitleColor(.white, for: .normal)
    skip.addTarget(self, action: #selector(goBack), for: .touchUpInside)
    skip.translatesAutoresizingMaskIntoConstraints = false
    let next = UIButton(type: .system)
    next.setTitle("Далее", for: .normal)
    next.setTitleColor(UIColor(red: 7 / 255, green: 21 / 255, blue: 37 / 255, alpha: 1), for: .normal)
    next.backgroundColor = .white
    next.layer.cornerRadius = 16
    next.titleLabel?.font = .systemFont(ofSize: 17, weight: .heavy)
    next.addTarget(self, action: #selector(advance), for: .touchUpInside)
    next.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(image)
    view.addSubview(body)
    view.addSubview(skip)
    view.addSubview(next)
    NSLayoutConstraint.activate([
      image.topAnchor.constraint(equalTo: view.topAnchor),
      image.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      image.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      image.heightAnchor.constraint(equalTo: view.heightAnchor, multiplier: 0.48),
      skip.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
      skip.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
      body.topAnchor.constraint(equalTo: image.bottomAnchor, constant: 20),
      body.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
      body.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
      next.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
      next.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
      next.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
      next.heightAnchor.constraint(equalToConstant: 54),
    ])
    show()
  }
  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    navigationController?.setNavigationBarHidden(true, animated: animated)
  }
  private func show() {
    let item = pages[page]
    image.image = UIImage(named: item.0)
    body.text = "\(item.1)\n\n\(item.2)"
  }
  @objc private func advance() {
    if page < pages.count - 1 { page += 1; show() } else { goBack() }
  }
  @objc private func goBack() { navigationController?.popViewController(animated: true) }
}

enum CarPlaySupport {
  static let backgroundLocationReady = true
}
