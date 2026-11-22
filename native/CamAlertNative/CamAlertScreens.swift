import CoreLocation
import GoogleMaps
import StoreKit
import UIKit

enum CamAlertImages {
  static func named(_ name: String) -> UIImage? {
    if let image = UIImage(named: name), image.size.width > 1 { return image }
    for ext in ["jpg", "jpeg", "png"] {
      let url = Bundle.main.url(forResource: name, withExtension: ext)
        ?? Bundle.main.url(forResource: name, withExtension: ext, subdirectory: "uk-voice")
      if let url, let image = UIImage(contentsOfFile: url.path), image.size.width > 1 { return image }
    }
    return nil
  }
}

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
    let phrases = CamAlertPhrases.home(session.settings.language)
    stack.addArrangedSubview(filledButton("▶   \(phrases.start)", action: #selector(startTrip)))
    stack.addArrangedSubview(outlineButton(phrases.where, night: night, action: #selector(openSearch)))
    stack.addArrangedSubview(countryCard(card: card, line: line, ink: ink, muted: muted))
  }

  private func header(night: Bool, ink: UIColor) -> UIView {
    let brand = UILabel()
    let text = NSMutableAttributedString(string: "Cam", attributes: [.foregroundColor: ink, .font: UIFont.camalert(28, weight: .black)])
    text.append(NSAttributedString(string: "Alert", attributes: [.foregroundColor: CamAlertPalette.cyan, .font: UIFont.camalert(28, weight: .black)]))
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
    settings.titleLabel?.font = .camalert(22)
    settings.tintColor = ink
    settings.backgroundColor = night ? CamAlertPalette.cardNight : UIColor(red: 241 / 255, green: 245 / 255, blue: 250 / 255, alpha: 1)
    settings.layer.cornerRadius = 14
    settings.addTarget(self, action: #selector(openSettings), for: .touchUpInside)
    settings.translatesAutoresizingMaskIntoConstraints = false
    settings.widthAnchor.constraint(equalToConstant: 48).isActive = true
    settings.heightAnchor.constraint(equalToConstant: 48).isActive = true
    let back = UIButton(type: .system)
    back.setTitle("‹  Назад", for: .normal)
    back.setTitleColor(night ? .white : CamAlertPalette.ink, for: .normal)
    back.titleLabel?.font = .camalert(16, weight: .bold)
    back.backgroundColor = night ? UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 0.94) : UIColor(white: 1, alpha: 0.96)
    back.layer.cornerRadius = 14
    back.contentEdgeInsets = UIEdgeInsets(top: 8, left: 10, bottom: 8, right: 12)
    back.addTarget(self, action: #selector(reopenWelcome), for: .touchUpInside)
    let row = UIStackView(arrangedSubviews: [back, mark, brand, settings])
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
    glyph.font = .camalert(26, weight: .bold)
    glyph.textColor = ink
    let name = UILabel()
    name.text = title
    name.font = .camalert(12, weight: .bold)
    name.textColor = ink
    let dot = UIView()
    dot.backgroundColor = ready ? UIColor(red: 31 / 255, green: 184 / 255, blue: 73 / 255, alpha: 1) : UIColor(red: 224 / 255, green: 163 / 255, blue: 45 / 255, alpha: 1)
    dot.layer.cornerRadius = 4
    dot.translatesAutoresizingMaskIntoConstraints = false
    dot.widthAnchor.constraint(equalToConstant: 8).isActive = true
    dot.heightAnchor.constraint(equalToConstant: 8).isActive = true
    let detail = UILabel()
    detail.text = value
    detail.font = .camalert(11, weight: .semibold)
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
    let image = UIImageView(image: CamAlertImages.named("onboarding-window-view"))
    image.contentMode = .scaleAspectFill
    image.clipsToBounds = true
    image.layer.cornerRadius = 21
    image.translatesAutoresizingMaskIntoConstraints = false
    image.heightAnchor.constraint(equalToConstant: 158).isActive = true
    let shade = UIView()
    shade.backgroundColor = UIColor(red: 9 / 255, green: 30 / 255, blue: 47 / 255, alpha: 0.18)
    shade.translatesAutoresizingMaskIntoConstraints = false
    let car = UILabel()
    car.text = "🚙"
    car.font = .camalert(41)
    car.translatesAutoresizingMaskIntoConstraints = false
    let road = UIView()
    road.backgroundColor = UIColor(white: 1, alpha: 0.62)
    road.translatesAutoresizingMaskIntoConstraints = false
    image.addSubview(shade)
    image.addSubview(car)
    image.addSubview(road)
    NSLayoutConstraint.activate([
      shade.topAnchor.constraint(equalTo: image.topAnchor),
      shade.leadingAnchor.constraint(equalTo: image.leadingAnchor),
      shade.trailingAnchor.constraint(equalTo: image.trailingAnchor),
      shade.bottomAnchor.constraint(equalTo: image.bottomAnchor),
      car.bottomAnchor.constraint(equalTo: image.bottomAnchor, constant: -13),
      car.centerXAnchor.constraint(equalTo: image.centerXAnchor, constant: 28),
      road.leadingAnchor.constraint(equalTo: image.leadingAnchor),
      road.trailingAnchor.constraint(equalTo: image.trailingAnchor),
      road.bottomAnchor.constraint(equalTo: image.bottomAnchor, constant: -7),
      road.heightAnchor.constraint(equalToConstant: 2),
    ])
    return image
  }

  private func titleBlock(ink: UIColor, muted: UIColor) -> UIView {
    let title = UILabel()
    title.text = CamAlertPhrases.home(session.settings.language).title
    title.font = .camalert(34, weight: .black)
    title.textColor = ink
    let subtitle = UILabel()
    subtitle.text = CamAlertPhrases.home(session.settings.language).subtitle
    subtitle.font = .camalert(17, weight: .medium)
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
    button.titleLabel?.font = .camalert(17, weight: .heavy)
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
    button.titleLabel?.font = .camalert(17, weight: .heavy)
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
    label.font = .camalert(14, weight: .heavy)
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
    button.titleLabel?.font = .camalert(12, weight: .bold)
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
    flag.font = .camalert(36)
    let title = UILabel()
    title.text = "\(name) · \(count > 0 ? "База загружена" : "Базы пока нет")"
    title.font = .camalert(15, weight: .heavy)
    title.textColor = ink
    let meta = UILabel()
    meta.text = count > 0 ? "Доступна офлайн" : "Офлайн не подтверждён"
    meta.font = .camalert(12)
    meta.textColor = muted
    let update = UILabel()
    update.text = "\(count) камер"
    update.font = .camalert(11)
    update.textColor = muted
    let column = UIStackView(arrangedSubviews: [title, meta, update])
    column.axis = .vertical
    column.spacing = 2
    let chevron = UILabel()
    chevron.text = "›"
    chevron.font = .camalert(30, weight: .regular)
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

  @objc private func startTrip() { NotificationCenter.default.post(name: .camalertShowTab, object: "drive") }
  @objc private func openSearch() { NotificationCenter.default.post(name: .camalertShowTab, object: "search") }
  @objc private func openCountries() { NotificationCenter.default.post(name: .camalertShowTab, object: "countries") }
  @objc private func openSettings() { NotificationCenter.default.post(name: .camalertShowTab, object: "settings") }
  @objc private func reopenWelcome() { NotificationCenter.default.post(name: .camalertShowTab, object: "welcome") }
}

final class SettingsViewController: UIViewController, UISearchBarDelegate {
  private let session = CamAlertSession.shared
  private let scroll = UIScrollView()
  private let stack = UIStackView()
  private let countrySearch = UISearchBar()
  private let countryStack = UIStackView()
  private var countryQuery = ""
  private var loadingCode: String?
  private var advancedOpen = false
  private var coverageOpen = false
  private var updatingDatabase = false
  var segment = "settings"

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
    children.forEach { child in
      child.willMove(toParent: nil)
      child.view.removeFromSuperview()
      child.removeFromParent()
    }
    stack.arrangedSubviews.forEach { $0.removeFromSuperview() }
    let night = CamAlertPalette.night(session.settings)
    let language = session.settings.language
    let copy = CamAlertPhrases.settings(language)
    view.backgroundColor = night ? CamAlertPalette.nightPage : UIColor(red: 245 / 255, green: 246 / 255, blue: 248 / 255, alpha: 1)
    let ink = night ? UIColor.white : UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1)
    let muted = night ? CamAlertPalette.mutedNight : UIColor(red: 82 / 255, green: 103 / 255, blue: 127 / 255, alpha: 1)
    stack.addArrangedSubview(screenHeader(copy.back, copy.countriesTitle, night: night, ink: ink))
    stack.addArrangedSubview(segmentControl(copy, night: night))
    if segment == "countries" {
      let saved = UILabel()
      saved.numberOfLines = 0
      saved.font = .camalert(17, weight: .heavy)
      saved.textColor = ink
      saved.text = "\(countryCopy.saved): \(session.catalog.storedCodes.count) / 2"
      saved.tag = 71
      let limit = UILabel()
      limit.numberOfLines = 0
      limit.font = .camalert(15)
      limit.textColor = muted
      limit.text = countryCopy.limit
      countrySearch.placeholder = countryCopy.search
      countrySearch.searchBarStyle = .minimal
      countrySearch.delegate = self
      countrySearch.text = countryQuery
      countrySearch.backgroundImage = UIImage()
      if countrySearch.constraints.filter({ $0.firstAttribute == .height }).isEmpty {
        countrySearch.heightAnchor.constraint(equalToConstant: 48).isActive = true
      }
      countryStack.axis = .vertical
      countryStack.spacing = 10
      stack.addArrangedSubview(saved)
      stack.addArrangedSubview(limit)
      stack.addArrangedSubview(countrySearch)
      stack.addArrangedSubview(countryStack)
      reloadCountryCards()
      Task {
        _ = await self.session.catalog.refreshManifest()
        await MainActor.run { self.reloadCountryCards() }
      }
      return
    }
    stack.addArrangedSubview(toggle(copy.warnings, session.settings.cameraWarnings) { self.session.settings.cameraWarnings = $0; self.session.save() })
    stack.addArrangedSubview(outline("\(copy.laws)  →", night: night, ink: ink, action: #selector(openLaws)))
    let lawsNote = UILabel()
    lawsNote.text = copy.lawsNote
    lawsNote.numberOfLines = 0
    lawsNote.font = .camalert(13)
    lawsNote.textColor = muted
    stack.addArrangedSubview(lawsNote)
    stack.addArrangedSubview(premiumEntry(copy))
    stack.addArrangedSubview(outline("\(copy.redeem)  →", night: night, ink: ink, action: #selector(redeemCode)))
    stack.addArrangedSubview(outline(copy.share, night: night, ink: ink, action: #selector(shareApp)))
    stack.addArrangedSubview(darkCard(copy.welcome, nil, action: #selector(openWelcome)))
    stack.addArrangedSubview(rateButton(extraCopy.rate))
    stack.addArrangedSubview(outline("\(copy.feedback)  →", night: night, ink: ink, action: #selector(sendFeedback)))
    stack.addArrangedSubview(outline("\(copy.history)  →", night: night, ink: ink, action: #selector(openHistory)))
    stack.addArrangedSubview(heading(copy.country, ink))
    stack.addArrangedSubview(countryChoice(copy, night: night, ink: ink, muted: muted))
    stack.addArrangedSubview(heading(copy.theme, ink))
    stack.addArrangedSubview(themeRow(copy, night: night, ink: ink))
    stack.addArrangedSubview(darkCard(copy.previewTitle, copy.previewSub, action: #selector(previewAlert)))
    stack.addArrangedSubview(heading(copy.language, ink))
    stack.addArrangedSubview(languageRow(ink: ink))
    stack.addArrangedSubview(toggle(copy.voice, session.settings.voice) { self.session.settings.voice = $0; self.session.save() })
    stack.addArrangedSubview(toggle(copy.vibration, session.settings.vibration) { self.session.settings.vibration = $0; self.session.save() })
    stack.addArrangedSubview(toggle(copy.smart, session.settings.smartDistance) { self.session.settings.smartDistance = $0; self.session.save() })
    stack.addArrangedSubview(outline("\(extraCopy.advanced)  \(advancedOpen ? "−" : "＋")", night: night, ink: ink, action: #selector(toggleAdvanced)))
    if advancedOpen {
      stack.addArrangedSubview(heading(copy.distances, ink))
      stack.addArrangedSubview(distance(copy.band1, \.cityDistance))
      stack.addArrangedSubview(distance(copy.band2, \.roadDistance))
      stack.addArrangedSubview(distance(copy.band3, \.highwayDistance))
      stack.addArrangedSubview(distance(copy.band4, \.fastDistance))
    }
    stack.addArrangedSubview(heading(lowerCopy.database, ink))
    stack.addArrangedSubview(databaseCard(lowerCopy, night: night, ink: ink, muted: muted))
    stack.addArrangedSubview(outline("\(lowerCopy.coverage)  \(coverageOpen ? "↓" : "→")", night: night, ink: ink, action: #selector(toggleCoverage)))
    if coverageOpen {
      stack.addArrangedSubview(coverageList(night: night, ink: ink, muted: muted))
    }
    stack.addArrangedSubview(outline("＋  \(copy.report)", night: night, ink: ink, action: #selector(openReport)))
    stack.addArrangedSubview(outline("\(extraCopy.location)  ›", night: night, ink: ink, action: #selector(openLocationSettings)))
    stack.addArrangedSubview(outline("\(extraCopy.howTo)  ›", night: night, ink: ink, action: #selector(openHelp)))
    stack.addArrangedSubview(heading(copy.about, ink))
    stack.addArrangedSubview(linkRow(copy.privacy, "https://camera.21wek.com/privacy.html", ink: ink))
    stack.addArrangedSubview(linkRow(lowerCopy.safety, "https://camera.21wek.com/safety.html", ink: ink))
    stack.addArrangedSubview(linkRow(lowerCopy.sources, "https://camera.21wek.com/sources.html", ink: ink))
    stack.addArrangedSubview(linkRow(extraCopy.reportHelp, "https://camera.21wek.com/report-camera.html", ink: ink))
    stack.addArrangedSubview(linkRow(lowerCopy.support, "https://camera.21wek.com/support.html", ink: ink))
    stack.addArrangedSubview(linkRow(lowerCopy.terms, "https://camera.21wek.com/terms.html", ink: ink))
    stack.addArrangedSubview(linkRow(lowerCopy.website, "https://camera.21wek.com/", ink: ink))
    stack.addArrangedSubview(buildStamp(muted))
  }

  private func buildStamp(_ color: UIColor) -> UILabel {
    let label = UILabel()
    let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
    let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""
    label.text = version.isEmpty ? "Сборка \(build)" : "\(version)  ·  сборка \(build)"
    label.font = .systemFont(ofSize: 12, weight: .regular)
    label.textColor = color
    label.textAlignment = .center
    return label
  }

  private var extraCopy: (update: String, updated: String, current: String, failed: String, rate: String, howTo: String, reportHelp: String, location: String, advanced: String) {
    switch session.settings.language {
    case "uk":
      return ("Оновити зараз", "Базу оновлено", "Нових даних немає. Версія бази не змінилася.", "Оновлення не вдалося. Використовується збережена база.", "Оцінити застосунок", "Як користуватися", "Як повідомити про камеру", "Дозволи та голос", "Розширені налаштування")
    case "en":
      return ("Update now", "Database updated", "No new data. The database version is unchanged.", "Update failed. Using the saved database.", "Rate the app", "How to use", "How to report a camera", "Permissions and voice", "Advanced settings")
    case "pl":
      return ("Aktualizuj teraz", "Baza zaktualizowana", "Brak nowych danych. Wersja bazy bez zmian.", "Aktualizacja nieudana. Używana jest zapisana baza.", "Oceń aplikację", "Jak korzystać", "Jak zgłosić kamerę", "Uprawnienia i głos", "Ustawienia zaawansowane")
    default:
      return ("Обновить сейчас", "База обновлена", "Новых данных нет. Версия базы не изменилась.", "Обновление не удалось. Используется сохранённая база.", "Оценить приложение", "Как пользоваться", "Как сообщить о камере", "Разрешения и голос", "Расширенные настройки")
    }
  }

  private var lowerCopy: (database: String, version: String, checked: String, coverage: String, safety: String, sources: String, support: String, terms: String, website: String) {
    switch session.settings.language {
    case "uk": return ("Оновлення бази", "Версія бази", "Остання перевірка", "Покриття", "Безпека", "Джерела даних", "Підтримка", "Умови використання", "Сайт застосунку")
    case "en": return ("Database update", "Database version", "Last check", "Coverage", "Safety", "Data sources", "Support", "Terms of use", "App website")
    case "pl": return ("Aktualizacja bazy", "Wersja bazy", "Ostatnie sprawdzenie", "Zasięg", "Bezpieczeństwo", "Źródła danych", "Wsparcie", "Warunki użytkowania", "Strona aplikacji")
    default: return ("Обновление базы", "Версия базы", "Последняя проверка", "Покрытие", "Безопасность", "Источники данных", "Поддержка", "Условия использования", "Сайт приложения")
    }
  }

  private func databaseCard(_ copy: (database: String, version: String, checked: String, coverage: String, safety: String, sources: String, support: String, terms: String, website: String), night: Bool, ink: UIColor, muted: UIColor) -> UIView {
    let version = UILabel()
    version.text = copy.version
    version.font = .camalert(13, weight: .semibold)
    version.textColor = muted
    let versionValue = UILabel()
    versionValue.text = Self.catalogStamp(session.catalog.publishedAt, time: false) ?? "—"
    versionValue.font = .camalert(18, weight: .heavy)
    versionValue.textColor = ink
    let checked = UILabel()
    checked.text = copy.checked
    checked.font = .camalert(13, weight: .semibold)
    checked.textColor = muted
    let checkedValue = UILabel()
    checkedValue.text = Self.catalogStamp(session.catalog.checkedAt, time: true) ?? "—"
    checkedValue.font = .camalert(18, weight: .heavy)
    checkedValue.textColor = ink
    checkedValue.numberOfLines = 0
    let update = UIButton(type: .system)
    update.setTitle(updatingDatabase ? "…" : extraCopy.update, for: .normal)
    update.setTitleColor(.white, for: .normal)
    update.titleLabel?.font = .camalert(16, weight: .heavy)
    update.backgroundColor = CamAlertPalette.blue
    update.layer.cornerRadius = 14
    update.isEnabled = !updatingDatabase
    update.heightAnchor.constraint(equalToConstant: 46).isActive = true
    update.addTarget(self, action: #selector(refreshDatabase), for: .touchUpInside)
    let column = UIStackView(arrangedSubviews: [version, versionValue, checked, checkedValue, update])
    column.axis = .vertical
    column.spacing = 4
    column.layoutMargins = UIEdgeInsets(top: 14, left: 14, bottom: 14, right: 14)
    column.isLayoutMarginsRelativeArrangement = true
    column.backgroundColor = night ? CamAlertPalette.cardNight : .white
    column.layer.cornerRadius = 16
    column.layer.borderWidth = 1
    column.layer.borderColor = UIColor(red: 221 / 255, green: 221 / 255, blue: 221 / 255, alpha: 1).cgColor
    return column
  }

  private func linkRow(_ title: String, _ url: String, ink: UIColor) -> UIButton {
    let button = outline(title, night: CamAlertPalette.night(session.settings), ink: ink, action: #selector(openLink(_:)))
    button.accessibilityValue = url
    return button
  }

  @objc private func openLink(_ sender: UIButton) {
    guard let value = sender.accessibilityValue, let url = URL(string: value) else { return }
    UIApplication.shared.open(url)
  }

  private var countryCopy: (saved: String, limit: String, search: String, cameras: String, unknown: String, offline: String, loading: String, download: String, delete: String, none: String, offlineTitle: String, offlineNote: String, version: String, checked: String, limitAlert: String) {
    switch session.settings.language {
    case "uk":
      return ("Збережено країн", "Щоб завантажити третю країну, спочатку видаліть одну базу.", "Знайти країну", "камер", "Кількість камер невідома", "Доступна без інтернету", "Завантажується…", "Натисніть, щоб вибрати й завантажити", "Видалити базу", "Країн не знайдено", "Доступність офлайн", "Офлайн-статус показуємо лише для баз, збережених на пристрої або вбудованих у застосунок.", "Версія бази:", "Остання перевірка:", "Можна зберігати бази двох країн. Спочатку видаліть одну із завантажених баз.")
    case "en":
      return ("Saved countries", "Delete one database before downloading a third country.", "Find a country", "cameras", "Camera count unavailable", "Available offline", "Loading…", "Tap to select and download", "Delete database", "No countries found", "Offline availability", "Offline status is shown only for databases saved on this device or bundled with the app.", "Database version:", "Last check:", "You can keep two country databases. Delete one downloaded database first.")
    case "pl":
      return ("Zapisane kraje", "Usuń jedną bazę przed pobraniem trzeciego kraju.", "Znajdź kraj", "kamer", "Liczba kamer nieznana", "Dostępna offline", "Ładowanie…", "Dotknij, aby wybrać i pobrać", "Usuń bazę", "Nie znaleziono krajów", "Dostępność offline", "Status offline pokazujemy tylko dla baz zapisanych na urządzeniu lub dołączonych do aplikacji.", "Wersja bazy:", "Ostatnie sprawdzenie:", "Można przechowywać bazy dwóch krajów. Najpierw usuń jedną pobraną bazę.")
    default:
      return ("Сохранено стран", "Для загрузки третьей страны сначала удалите одну базу.", "Найти страну", "камер", "Количество камер неизвестно", "Доступна без интернета", "Загружается…", "Нажмите, чтобы выбрать и загрузить", "Удалить базу", "Страны не найдены", "Доступность офлайн", "Показываем офлайн-статус только для баз, сохранённых на устройстве или встроенных в приложение.", "Версия базы:", "Последняя проверка:", "Можно хранить базы двух стран. Сначала удалите одну базу из скачанных.")
    }
  }

  private static func grouped(_ value: Int) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .decimal
    formatter.groupingSeparator = " "
    formatter.locale = Locale(identifier: "ru_RU")
    return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
  }

  private static func catalogStamp(_ date: Date?, time: Bool) -> String? {
    guard let date else { return nil }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "ru_RU")
    formatter.dateStyle = .short
    formatter.timeStyle = time ? .short : .none
    return formatter.string(from: date)
  }

  private func displayCountry(_ code: String, fallback: String) -> String {
    let names = ["ru": ["UA": "Украина", "PL": "Польша"], "uk": ["UA": "Україна", "PL": "Польща"], "en": ["UA": "Ukraine", "PL": "Poland"], "pl": ["UA": "Ukraina", "PL": "Polska"]]
    return names[session.settings.language]?[code] ?? fallback
  }

  private func reloadCountryCards() {
    countryStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
    let copy = countryCopy
    if let saved = stack.viewWithTag(71) as? UILabel {
      saved.text = "\(copy.saved): \(session.catalog.storedCodes.count) / 2"
    }
    let night = CamAlertPalette.night(session.settings)
    let ink = night ? UIColor.white : UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1)
    let muted = night ? CamAlertPalette.mutedNight : UIColor(red: 82 / 255, green: 106 / 255, blue: 128 / 255, alpha: 1)
    let needle = countryQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let rows = session.catalog.directory().filter { needle.isEmpty || $0.name.lowercased().contains(needle) || $0.code.lowercased().contains(needle) || displayCountry($0.code, fallback: $0.name).lowercased().contains(needle) }
    if rows.isEmpty {
      let empty = UILabel()
      empty.text = copy.none
      empty.textColor = muted
      empty.font = .camalert(15)
      countryStack.addArrangedSubview(empty)
    }
    for row in rows {
      countryStack.addArrangedSubview(countryCard(row, copy: copy, night: night, ink: ink, muted: muted))
    }
    let noteTitle = UILabel()
    noteTitle.text = copy.offlineTitle
    noteTitle.font = .camalert(16, weight: .heavy)
    noteTitle.textColor = ink
    let noteBody = UILabel()
    noteBody.text = copy.offlineNote
    noteBody.numberOfLines = 0
    noteBody.font = .camalert(14)
    noteBody.textColor = muted
    let version = UILabel()
    version.text = "\(copy.version) \(Self.catalogStamp(session.catalog.publishedAt, time: false) ?? "—")"
    version.font = .camalert(13)
    version.textColor = muted
    let checked = UILabel()
    checked.text = "\(copy.checked) \(Self.catalogStamp(session.catalog.checkedAt, time: true) ?? "—")"
    checked.font = .camalert(13)
    checked.textColor = muted
    let note = UIStackView(arrangedSubviews: [noteTitle, noteBody, version, checked])
    note.axis = .vertical
    note.spacing = 6
    note.layoutMargins = UIEdgeInsets(top: 14, left: 14, bottom: 14, right: 14)
    note.isLayoutMarginsRelativeArrangement = true
    note.backgroundColor = night ? CamAlertPalette.cardNight : .white
    note.layer.cornerRadius = 16
    countryStack.addArrangedSubview(note)
  }

  private func countryCard(_ row: CountryListing, copy: (saved: String, limit: String, search: String, cameras: String, unknown: String, offline: String, loading: String, download: String, delete: String, none: String, offlineTitle: String, offlineNote: String, version: String, checked: String, limitAlert: String), night: Bool, ink: UIColor, muted: UIColor) -> UIView {
    let stored = session.catalog.isStored(row.code)
    let selected = row.code == session.settings.country.uppercased()
    let loading = loadingCode == row.code
    let name = UILabel()
    name.text = displayCountry(row.code, fallback: row.name)
    name.font = .camalert(18, weight: .heavy)
    name.textColor = ink
    let count = UILabel()
    let shown = row.recordCount > 0 ? row.recordCount : session.catalog.cameras(for: row.code).count
    count.text = shown > 0 ? "\(Self.grouped(shown)) \(copy.cameras)" : copy.unknown
    count.font = .camalert(15)
    count.textColor = muted
    let status = UILabel()
    status.text = loading ? copy.loading : stored ? copy.offline : copy.download
    status.font = .camalert(15, weight: .semibold)
    status.textColor = stored ? UIColor(red: 22 / 255, green: 140 / 255, blue: 72 / 255, alpha: 1) : muted
    status.numberOfLines = 2
    let copyColumn = UIStackView(arrangedSubviews: [name, count, status])
    copyColumn.axis = .vertical
    copyColumn.spacing = 2
    let flag = UILabel()
    flag.text = CamAlertPalette.flag(row.code)
    flag.font = .camalert(32)
    let mark = UILabel()
    mark.text = stored ? "✓" : "↓"
    mark.font = .camalert(22, weight: .bold)
    mark.textColor = stored ? UIColor(red: 22 / 255, green: 163 / 255, blue: 74 / 255, alpha: 1) : CamAlertPalette.blue
    if loading {
      let spinner = UIActivityIndicatorView(style: .medium)
      spinner.startAnimating()
      mark.isHidden = true
      let rowView = UIStackView(arrangedSubviews: [flag, copyColumn, spinner])
      rowView.axis = .horizontal
      rowView.alignment = .center
      rowView.spacing = 12
      return finishCountryCard(rowView, row: row, stored: stored, selected: selected, copy: copy, night: night)
    }
    let rowView = UIStackView(arrangedSubviews: [flag, copyColumn, mark])
    rowView.axis = .horizontal
    rowView.alignment = .center
    rowView.spacing = 12
    return finishCountryCard(rowView, row: row, stored: stored, selected: selected, copy: copy, night: night)
  }

  private func finishCountryCard(_ rowView: UIStackView, row: CountryListing, stored: Bool, selected: Bool, copy: (saved: String, limit: String, search: String, cameras: String, unknown: String, offline: String, loading: String, download: String, delete: String, none: String, offlineTitle: String, offlineNote: String, version: String, checked: String, limitAlert: String), night: Bool) -> UIView {
    let tap = UIButton(type: .custom)
    tap.addAction(UIAction { [weak self] _ in self?.chooseCountry(row.code) }, for: .touchUpInside)
    tap.translatesAutoresizingMaskIntoConstraints = false
    rowView.isUserInteractionEnabled = false
    let box = UIStackView()
    box.axis = .vertical
    box.spacing = 0
    let wrap = UIView()
    wrap.addSubview(rowView)
    wrap.addSubview(tap)
    rowView.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      rowView.topAnchor.constraint(equalTo: wrap.topAnchor, constant: 12),
      rowView.leadingAnchor.constraint(equalTo: wrap.leadingAnchor, constant: 12),
      rowView.trailingAnchor.constraint(equalTo: wrap.trailingAnchor, constant: -12),
      rowView.bottomAnchor.constraint(equalTo: wrap.bottomAnchor, constant: -12),
      tap.topAnchor.constraint(equalTo: wrap.topAnchor),
      tap.leadingAnchor.constraint(equalTo: wrap.leadingAnchor),
      tap.trailingAnchor.constraint(equalTo: wrap.trailingAnchor),
      tap.bottomAnchor.constraint(equalTo: wrap.bottomAnchor),
    ])
    box.addArrangedSubview(wrap)
    if stored {
      let delete = UIButton(type: .system)
      delete.setTitle(copy.delete, for: .normal)
      delete.setTitleColor(UIColor(red: 181 / 255, green: 33 / 255, blue: 50 / 255, alpha: 1), for: .normal)
      delete.titleLabel?.font = .camalert(17, weight: .heavy)
      delete.contentHorizontalAlignment = .leading
      delete.contentEdgeInsets = UIEdgeInsets(top: 8, left: 12, bottom: 12, right: 12)
      delete.addAction(UIAction { [weak self] _ in self?.deleteCountry(row.code) }, for: .touchUpInside)
      box.addArrangedSubview(delete)
    }
    box.backgroundColor = night ? CamAlertPalette.cardNight : .white
    box.layer.cornerRadius = 16
    box.layer.borderWidth = selected ? 1.5 : 1
    box.layer.borderColor = (selected ? CamAlertPalette.blue : UIColor(red: 228 / 255, green: 232 / 255, blue: 237 / 255, alpha: 1)).cgColor
    box.clipsToBounds = true
    return box
  }

  private func chooseCountry(_ code: String) {
    guard loadingCode == nil else { return }
    let stored = session.catalog.isStored(code)
    if !stored, session.catalog.storedCodes.count >= 2 {
      let alert = UIAlertController(title: "CamAlert", message: countryCopy.limitAlert, preferredStyle: .alert)
      alert.addAction(UIAlertAction(title: "OK", style: .default))
      present(alert, animated: true)
      return
    }
    session.settings.country = code
    session.save()
    guard !stored else { reloadCountryCards(); return }
    loadingCode = code
    reloadCountryCards()
    Task {
      let error = await session.catalog.ensureCountry(code)
      await MainActor.run {
        self.loadingCode = nil
        if let error {
          let alert = UIAlertController(title: "CamAlert", message: error, preferredStyle: .alert)
          alert.addAction(UIAlertAction(title: "OK", style: .default))
          self.present(alert, animated: true)
        }
        self.reloadCountryCards()
      }
    }
  }

  private func deleteCountry(_ code: String) {
    session.catalog.removeStored(code)
    reloadCountryCards()
  }

  func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
    countryQuery = searchText
    reloadCountryCards()
  }

  private func screenHeader(_ backTitle: String, _ titleText: String, night: Bool, ink: UIColor) -> UIView {
    let back = UIButton(type: .system)
    back.setTitle("‹  \(backTitle)", for: .normal)
    back.setTitleColor(night ? .white : ink, for: .normal)
    back.titleLabel?.font = .camalert(17, weight: .bold)
    back.backgroundColor = night ? UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 0.94) : UIColor(white: 1, alpha: 0.96)
    back.layer.cornerRadius = 14
    back.contentEdgeInsets = UIEdgeInsets(top: 8, left: 12, bottom: 8, right: 12)
    back.addTarget(self, action: #selector(goBack), for: .touchUpInside)
    let title = UILabel()
    title.text = titleText
    title.font = .camalert(32, weight: .black)
    title.textColor = ink
    title.numberOfLines = 2
    let row = UIStackView(arrangedSubviews: [back, title])
    row.axis = .horizontal
    row.alignment = .center
    row.spacing = 10
    return row
  }

  private func segmentControl(_ copy: CamAlertPhrases.Settings, night: Bool) -> UIView {
    let row = UIStackView()
    row.axis = .horizontal
    row.spacing = 4
    row.distribution = .fillEqually
    row.backgroundColor = night ? UIColor(red: 41 / 255, green: 67 / 255, blue: 90 / 255, alpha: 1) : UIColor(red: 232 / 255, green: 238 / 255, blue: 245 / 255, alpha: 1)
    row.layer.cornerRadius = 14
    row.layoutMargins = UIEdgeInsets(top: 3, left: 3, bottom: 3, right: 3)
    row.isLayoutMarginsRelativeArrangement = true
    for (key, label) in [("countries", copy.countries), ("settings", copy.settings)] {
      let button = UIButton(type: .custom)
      let on = segment == key
      button.setTitle(label, for: .normal)
      button.titleLabel?.font = .camalert(15, weight: .bold)
      button.backgroundColor = on ? UIColor(red: 18 / 255, green: 96 / 255, blue: 232 / 255, alpha: 1) : .clear
      button.setTitleColor(on ? .white : (night ? CamAlertPalette.mutedNight : UIColor(red: 82 / 255, green: 103 / 255, blue: 127 / 255, alpha: 1)), for: .normal)
      button.layer.cornerRadius = 11
      button.heightAnchor.constraint(equalToConstant: 36).isActive = true
      button.addAction(UIAction { [weak self] _ in
        self?.segment = key
        self?.rebuild()
      }, for: .touchUpInside)
      row.addArrangedSubview(button)
    }
    return row
  }

  private func outline(_ title: String, night: Bool, ink: UIColor, action: Selector) -> UIButton {
    let button = UIButton(type: .custom)
    button.setTitle(title, for: .normal)
    button.setTitleColor(ink, for: .normal)
    button.titleLabel?.font = .camalert(15, weight: .semibold)
    button.titleLabel?.adjustsFontSizeToFitWidth = true
    button.titleLabel?.minimumScaleFactor = 0.85
    button.backgroundColor = night ? CamAlertPalette.cardNight : .white
    button.layer.cornerRadius = 16
    button.layer.borderWidth = 1
    button.layer.borderColor = (night ? UIColor(red: 33 / 255, green: 59 / 255, blue: 85 / 255, alpha: 1) : UIColor(red: 226 / 255, green: 232 / 255, blue: 238 / 255, alpha: 1)).cgColor
    button.clipsToBounds = true
    button.heightAnchor.constraint(equalToConstant: 52).isActive = true
    button.addTarget(self, action: action, for: .touchUpInside)
    return button
  }

  private func rateButton(_ title: String) -> UIButton {
    let button = UIButton(type: .custom)
    button.backgroundColor = UIColor(red: 245 / 255, green: 182 / 255, blue: 76 / 255, alpha: 1)
    button.layer.cornerRadius = 14
    button.clipsToBounds = true
    button.setTitle("★  \(title)", for: .normal)
    button.setTitleColor(UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1), for: .normal)
    button.titleLabel?.font = .camalert(16, weight: .semibold)
    button.heightAnchor.constraint(equalToConstant: 52).isActive = true
    button.addTarget(self, action: #selector(rateApp), for: .touchUpInside)
    return button
  }

  private func darkCard(_ title: String, _ subtitle: String?, action: Selector) -> UIButton {
    let button = UIButton(type: .custom)
    button.backgroundColor = UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1)
    button.layer.cornerRadius = 14
    button.clipsToBounds = true
    button.contentHorizontalAlignment = .left
    button.contentEdgeInsets = UIEdgeInsets(top: 12, left: 14, bottom: 12, right: 14)
    let text = subtitle == nil ? title : "\(title)\n\(subtitle!)"
    button.setTitle(text, for: .normal)
    button.titleLabel?.numberOfLines = 2
    button.titleLabel?.lineBreakMode = .byWordWrapping
    button.titleLabel?.font = .camalert(15, weight: .semibold)
    button.setTitleColor(.white, for: .normal)
    button.addTarget(self, action: action, for: .touchUpInside)
    return button
  }

  private func themeRow(_ copy: CamAlertPhrases.Settings, night: Bool, ink: UIColor) -> UIView {
    let row = UIStackView()
    row.axis = .horizontal
    row.spacing = 9
    row.distribution = .fillEqually
    for (value, label) in [("auto", copy.auto), ("night", copy.nightDrive), ("day", copy.dayDrive)] {
      let button = UIButton(type: .system)
      let selected = session.settings.driveTheme == value
      button.setTitle(label, for: .normal)
      button.titleLabel?.font = .camalert(13, weight: .bold)
      button.titleLabel?.numberOfLines = 2
      button.titleLabel?.textAlignment = .center
      button.layer.cornerRadius = 13
      button.backgroundColor = selected ? UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1) : (night ? CamAlertPalette.cardNight : UIColor(red: 240 / 255, green: 242 / 255, blue: 245 / 255, alpha: 1))
      button.setTitleColor(selected ? .white : UIColor(red: 77 / 255, green: 94 / 255, blue: 112 / 255, alpha: 1), for: .normal)
      button.layer.borderWidth = 1
      button.layer.borderColor = (selected ? UIColor(red: 35 / 255, green: 211 / 255, blue: 239 / 255, alpha: 1) : UIColor(red: 228 / 255, green: 232 / 255, blue: 237 / 255, alpha: 1)).cgColor
      button.heightAnchor.constraint(equalToConstant: 64).isActive = true
      button.addAction(UIAction { [weak self] _ in
        guard let self else { return }
        self.session.settings.driveTheme = value
        self.session.settings.nightDrive = value == "night"
        self.session.save()
        self.rebuild()
        NotificationCenter.default.post(name: .camalertShowTab, object: "refresh")
      }, for: .touchUpInside)
      row.addArrangedSubview(button)
    }
    return row
  }

  private func languageRow(ink: UIColor) -> UIView {
    let row = UIStackView()
    row.axis = .horizontal
    row.spacing = 8
    row.distribution = .fillEqually
    for code in ["ru", "uk", "en", "pl"] {
      let button = UIButton(type: .system)
      let selected = session.settings.language == code
      button.setTitle(code == "uk" ? "UA" : code.uppercased(), for: .normal)
      button.titleLabel?.font = .camalert(16, weight: .bold)
      button.backgroundColor = selected ? UIColor(red: 207 / 255, green: 215 / 255, blue: 255 / 255, alpha: 1) : UIColor(red: 238 / 255, green: 238 / 255, blue: 238 / 255, alpha: 1)
      button.setTitleColor(ink, for: .normal)
      button.layer.cornerRadius = 16
      button.heightAnchor.constraint(equalToConstant: 48).isActive = true
      button.addAction(UIAction { [weak self] _ in
        self?.session.settings.language = code
        self?.session.save()
        self?.rebuild()
        NotificationCenter.default.post(name: .camalertShowTab, object: "refresh")
      }, for: .touchUpInside)
      row.addArrangedSubview(button)
    }
    return row
  }

  private func countryChoice(_ copy: CamAlertPhrases.Settings, night: Bool, ink: UIColor, muted: UIColor) -> UIView {
    let flag = UILabel()
    flag.text = CamAlertPalette.flag(session.settings.country)
    flag.font = .camalert(32)
    let name = UILabel()
    name.text = CamAlertPhrases.countryName(session.settings.country, language: session.settings.language)
    name.font = .camalert(17, weight: .heavy)
    name.textColor = ink
    let meta = UILabel()
    meta.text = copy.countryMeta
    meta.font = .camalert(13)
    meta.textColor = muted
    meta.numberOfLines = 2
    let chevron = UILabel()
    chevron.text = "›"
    chevron.font = .camalert(28, weight: .medium)
    chevron.textColor = muted
    let column = UIStackView(arrangedSubviews: [name, meta])
    column.axis = .vertical
    let row = UIStackView(arrangedSubviews: [flag, column, chevron])
    row.axis = .horizontal
    row.alignment = .center
    row.spacing = 12
    row.layoutMargins = UIEdgeInsets(top: 12, left: 14, bottom: 12, right: 14)
    row.isLayoutMarginsRelativeArrangement = true
    row.backgroundColor = night ? CamAlertPalette.cardNight : UIColor(red: 236 / 255, green: 244 / 255, blue: 252 / 255, alpha: 1)
    row.layer.cornerRadius = 18
    row.isUserInteractionEnabled = true
    row.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(showCountries)))
    return row
  }

  private func heading(_ text: String, _ color: UIColor) -> UILabel {
    let label = UILabel()
    label.text = text
    label.font = .camalert(18, weight: .heavy)
    label.textColor = color
    label.numberOfLines = 0
    return label
  }

  private func backButton(_ title: String) -> UIButton {
    let button = UIButton(type: .system)
    button.setTitle("‹  \(title)", for: .normal)
    button.setTitleColor(CamAlertPalette.blue, for: .normal)
    button.titleLabel?.font = .camalert(17, weight: .bold)
    button.contentHorizontalAlignment = .left
    button.addTarget(self, action: #selector(goBack), for: .touchUpInside)
    return button
  }

  private func toggle(_ title: String, _ value: Bool, changed: @escaping (Bool) -> Void) -> UIView {
    let label = UILabel()
    label.text = title
    label.font = .camalert(15)
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
    label.font = .camalert(15)
    label.textColor = CamAlertPalette.night(session.settings) ? .white : CamAlertPalette.ink
    let value = UILabel()
    value.text = "\(Int(session.settings[keyPath: key])) м"
    value.font = .camalert(15, weight: .bold)
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
    button.titleLabel?.font = .camalert(16, weight: .bold)
    button.addTarget(self, action: action, for: .touchUpInside)
    button.heightAnchor.constraint(equalToConstant: 44).isActive = true
    return button
  }

  private func premiumEntry(_ copy: CamAlertPhrases.Settings) -> UIButton {
    let button = UIButton(type: .custom)
    button.backgroundColor = UIColor(red: 26 / 255, green: 50 / 255, blue: 112 / 255, alpha: 1)
    button.layer.cornerRadius = 18
    button.layer.borderWidth = 1
    button.layer.borderColor = UIColor(red: 201 / 255, green: 161 / 255, blue: 91 / 255, alpha: 1).cgColor
    button.clipsToBounds = true
    let text = "★  \(copy.premium)\n\(copy.premiumSub)"
    let style = NSMutableParagraphStyle()
    style.lineSpacing = 2
    style.alignment = .left
    let caption = NSMutableAttributedString(string: text, attributes: [
      .font: UIFont.camalert(16, weight: .semibold),
      .foregroundColor: UIColor.white,
      .paragraphStyle: style,
    ])
    let sub = (text as NSString).range(of: copy.premiumSub)
    if sub.location != NSNotFound {
      caption.addAttribute(.font, value: UIFont.camalert(14, weight: .regular), range: sub)
    }
    button.setAttributedTitle(caption, for: .normal)
    button.titleLabel?.numberOfLines = 2
    button.titleLabel?.lineBreakMode = .byWordWrapping
    button.contentHorizontalAlignment = .left
    button.contentEdgeInsets = UIEdgeInsets(top: 14, left: 16, bottom: 14, right: 16)
    button.addTarget(self, action: #selector(openPremium), for: .touchUpInside)
    return button
  }

  private func coverageList(night: Bool, ink: UIColor, muted: UIColor) -> UIView {
    let column = UIStackView()
    column.axis = .vertical
    column.spacing = 6
    column.layoutMargins = UIEdgeInsets(top: 14, left: 14, bottom: 14, right: 14)
    column.isLayoutMarginsRelativeArrangement = true
    column.backgroundColor = night ? CamAlertPalette.cardNight : UIColor(red: 243 / 255, green: 244 / 255, blue: 246 / 255, alpha: 1)
    column.layer.cornerRadius = 14
    for row in session.catalog.directory() where row.recordCount > 0 || session.catalog.isStored(row.code) {
      let line = UILabel()
      let count = row.recordCount > 0 ? row.recordCount : session.catalog.cameras(for: row.code).count
      line.text = "\(CamAlertPalette.flag(row.code)) \(displayCountry(row.code, fallback: row.name)): \(Self.grouped(count))"
      line.font = .camalert(15, weight: .semibold)
      line.textColor = ink
      line.numberOfLines = 1
      column.addArrangedSubview(line)
    }
    let credit = UIButton(type: .system)
    credit.setTitle("© OpenStreetMap contributors · ODbL 1.0", for: .normal)
    credit.setTitleColor(muted, for: .normal)
    credit.titleLabel?.font = .camalert(13, weight: .semibold)
    credit.contentHorizontalAlignment = .left
    credit.addAction(UIAction { _ in
      if let url = URL(string: "https://www.openstreetmap.org/copyright") { UIApplication.shared.open(url) }
    }, for: .touchUpInside)
    column.addArrangedSubview(credit)
    return column
  }

  @objc private func toggleAdvanced() {
    advancedOpen.toggle()
    rebuild()
  }

  @objc private func toggleCoverage() {
    coverageOpen.toggle()
    rebuild()
  }

  @objc private func refreshDatabase() {
    guard !updatingDatabase else { return }
    updatingDatabase = true
    rebuild()
    let code = session.settings.country.uppercased()
    Task {
      let manifestError = await self.session.catalog.refreshManifest()
      let update = await self.session.catalog.updateStored(code)
      await MainActor.run {
        self.updatingDatabase = false
        let copy = self.extraCopy
        let message: String
        if update == "current" {
          message = copy.current
        } else if update != nil || manifestError != nil {
          message = update ?? manifestError ?? copy.failed
        } else {
          message = copy.updated
        }
        let alert = UIAlertController(title: "CamAlert", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        self.present(alert, animated: true)
        self.rebuild()
      }
    }
  }

  @objc private func rateApp() {
    guard let url = URL(string: "https://apps.apple.com/app/id6818647205?action=write-review") else { return }
    UIApplication.shared.open(url)
  }

  @objc private func openLocationSettings() {
    guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
    UIApplication.shared.open(url)
  }

  @objc private func goBack() { NotificationCenter.default.post(name: .camalertShowTab, object: "drive") }
  @objc private func showCountries() { segment = "countries"; rebuild() }
  @objc private func redeemCode() {
    if let url = URL(string: "https://apps.apple.com/redeem") { UIApplication.shared.open(url) }
  }
  @objc private func shareApp() {
    let controller = UIActivityViewController(activityItems: ["CamAlert", URL(string: "https://camera.21wek.com/")!], applicationActivities: nil)
    present(controller, animated: true)
  }
  @objc private func sendFeedback() {
    if let url = URL(string: "https://camera.21wek.com/support.html") { UIApplication.shared.open(url) }
  }
  @objc private func previewAlert() {
    let alert = UIAlertController(title: CamAlertPhrases.settings(session.settings.language).previewTitle, message: CamAlertPhrases.settings(session.settings.language).previewSub, preferredStyle: .alert)
    alert.addAction(UIAlertAction(title: "OK", style: .cancel))
    present(alert, animated: true)
  }
  @objc private func openLaws() { navigationController?.pushViewController(LawsViewController(), animated: true) }
  @objc private func openHelp() { navigationController?.pushViewController(HelpViewController(), animated: true) }
  @objc private func openWelcome() { NotificationCenter.default.post(name: .camalertShowTab, object: "welcome") }
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
  var showsChrome = true

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
    view.addSubview(search)
    view.addSubview(table)
    let top = search.topAnchor.constraint(equalTo: view.topAnchor, constant: 8)
    if showsChrome {
      let back = UIButton(type: .system)
      back.setTitle("‹  Назад", for: .normal)
      back.setTitleColor(CamAlertPalette.blue, for: .normal)
      back.titleLabel?.font = .camalert(17, weight: .bold)
      back.addTarget(self, action: #selector(goBack), for: .touchUpInside)
      back.translatesAutoresizingMaskIntoConstraints = false
      view.addSubview(back)
      NSLayoutConstraint.activate([
        back.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
        back.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
        search.topAnchor.constraint(equalTo: back.bottomAnchor, constant: 8),
      ])
    } else {
      top.isActive = true
    }
    NSLayoutConstraint.activate([
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


final class HelpViewController: UIViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
    let night = CamAlertPalette.night(CamAlertSession.shared.settings)
    view.backgroundColor = night ? CamAlertPalette.nightPage : CamAlertPalette.page
    let text = UITextView()
    text.isEditable = false
    text.backgroundColor = .clear
    text.textColor = night ? CamAlertPalette.mutedNight : CamAlertPalette.ink
    text.font = .camalert(16)
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
    back.titleLabel?.font = .camalert(17, weight: .bold)
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
    back.titleLabel?.font = .camalert(17, weight: .bold)
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
    back.titleLabel?.font = .camalert(17, weight: .bold)
    back.addTarget(self, action: #selector(goBack), for: .touchUpInside)
    back.translatesAutoresizingMaskIntoConstraints = false
    let title = UILabel()
    title.text = rows.isEmpty ? "Предупреждений пока не было." : "История"
    title.textColor = CamAlertPalette.night(CamAlertSession.shared.settings) ? .white : CamAlertPalette.ink
    title.font = .camalert(22, weight: .heavy)
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
    back.titleLabel?.font = .camalert(17, weight: .bold)
    back.addTarget(self, action: #selector(goBack), for: .touchUpInside)
    back.translatesAutoresizingMaskIntoConstraints = false
    let title = UILabel()
    title.text = "Сообщить о камере"
    title.font = .camalert(24, weight: .heavy)
    title.textColor = night ? .white : CamAlertPalette.ink
    title.translatesAutoresizingMaskIntoConstraints = false
    note.font = .camalert(16)
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

final class CameraBrowseViewController: UIViewController, GMSMapViewDelegate {
  private let session = CamAlertSession.shared
  private let mapView = GMSMapView()
  private var markers: [GMSMarker] = []
  private var cameras: [CameraRecord] = []
  private var fitted = false

  override func viewDidLoad() {
    super.viewDidLoad()
    let night = CamAlertPalette.night(session.settings)
    let language = session.settings.language
    view.backgroundColor = night ? CamAlertPalette.nightPage : UIColor(red: 245 / 255, green: 246 / 255, blue: 248 / 255, alpha: 1)
    cameras = session.catalog.cameras(for: session.settings.country.uppercased())
    let ink = night ? UIColor.white : UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1)
    let muted = night ? CamAlertPalette.mutedNight : CamAlertPalette.muted
    let back = UIButton(type: .system)
    back.setTitle("‹  \(CamAlertPhrases.settings(language).back)", for: .normal)
    back.setTitleColor(ink, for: .normal)
    back.titleLabel?.font = .camalert(17, weight: .bold)
    back.contentHorizontalAlignment = .leading
    back.addAction(UIAction { _ in NotificationCenter.default.post(name: .camalertShowTab, object: "drive") }, for: .touchUpInside)
    let title = UILabel()
    title.font = .camalert(34, weight: .black)
    title.textColor = ink
    title.numberOfLines = 2
    title.text = language == "uk" ? "Камери на дорогах" : language == "en" ? "Road Cameras" : language == "pl" ? "Kamery drogowe" : "Камеры на дорогах"
    let subtitle = UILabel()
    subtitle.font = .camalert(15, weight: .semibold)
    subtitle.textColor = muted
    subtitle.numberOfLines = 2
    subtitle.text = "\(CamAlertPhrases.countryName(session.settings.country, language: language)) · \(cameras.count)"
    let catalog = UIButton(type: .system)
    catalog.setTitle(language == "uk" ? "Каталог камер →" : language == "en" ? "Camera catalog →" : language == "pl" ? "Katalog kamer →" : "Каталог камер →", for: .normal)
    catalog.setTitleColor(.white, for: .normal)
    catalog.titleLabel?.font = .camalert(16, weight: .heavy)
    catalog.backgroundColor = CamAlertPalette.blue
    catalog.layer.cornerRadius = 16
    catalog.heightAnchor.constraint(equalToConstant: 48).isActive = true
    catalog.addAction(UIAction { [weak self] _ in
      self?.navigationController?.pushViewController(RoadCatalogViewController(), animated: true)
    }, for: .touchUpInside)
    let legend = UIStackView()
    legend.axis = .vertical
    legend.spacing = 6
    let kinds = [
      ("speed", language == "uk" ? "Камера швидкості" : language == "en" ? "Speed camera" : language == "pl" ? "Fotoradar" : "Камера скорости"),
      ("light", language == "uk" ? "Контроль червоного світла" : language == "en" ? "Red-light camera" : language == "pl" ? "Czerwone światło" : "Контроль красного света"),
      ("section", language == "uk" ? "Середня швидкість" : language == "en" ? "Average speed" : language == "pl" ? "Odcinkowy pomiar" : "Средняя скорость"),
      ("checkpoint", language == "uk" ? "Контрольна точка" : language == "en" ? "Checkpoint" : language == "pl" ? "Punkt kontroli" : "Контрольная точка"),
    ]
    for pair in stride(from: 0, to: kinds.count, by: 2) {
      let row = UIStackView()
      row.axis = .horizontal
      row.spacing = 12
      row.distribution = .fillEqually
      for item in kinds[pair..<min(pair + 2, kinds.count)] {
        row.addArrangedSubview(legendItem(item.0, item.1, night: night, ink: muted))
      }
      legend.addArrangedSubview(row)
    }
    mapView.translatesAutoresizingMaskIntoConstraints = false
    mapView.delegate = self
    mapView.settings.compassButton = false
    mapView.layer.cornerRadius = 18
    mapView.clipsToBounds = true
    mapView.heightAnchor.constraint(equalToConstant: 560).isActive = true
    if CLLocationManager().authorizationStatus == .authorizedAlways || CLLocationManager().authorizationStatus == .authorizedWhenInUse {
      mapView.isMyLocationEnabled = true
    }
    let stack = UIStackView(arrangedSubviews: [back, title, subtitle, catalog, legend, mapView])
    stack.axis = .vertical
    stack.spacing = 10
    stack.translatesAutoresizingMaskIntoConstraints = false
    let scroll = UIScrollView()
    scroll.translatesAutoresizingMaskIntoConstraints = false
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
      stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -16),
      stack.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor, constant: -32),
    ])
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    navigationController?.setNavigationBarHidden(true, animated: animated)
  }

  private func legendItem(_ kind: String, _ title: String, night: Bool, ink: UIColor) -> UIView {
    let mark = UIImageView(image: RoadPins.icon(kind: kind, count: nil, night: night))
    mark.translatesAutoresizingMaskIntoConstraints = false
    mark.widthAnchor.constraint(equalToConstant: 22).isActive = true
    mark.heightAnchor.constraint(equalToConstant: 22).isActive = true
    let label = UILabel()
    label.text = title
    label.font = .camalert(12, weight: .semibold)
    label.textColor = ink
    label.numberOfLines = 2
    let row = UIStackView(arrangedSubviews: [mark, label])
    row.axis = .horizontal
    row.spacing = 6
    row.alignment = .center
    return row
  }

  func mapView(_ mapView: GMSMapView, idleAt position: GMSCameraPosition) {
    if !fitted { fitCountry(); return }
    refreshPins()
  }

  func mapView(_ mapView: GMSMapView, didTap marker: GMSMarker) -> Bool {
    guard let span = marker.userData as? (Double, Double), span.0 > 0 || span.1 > 0 else { return false }
    let next = GMSCoordinateBounds(
      coordinate: CLLocationCoordinate2D(latitude: marker.position.latitude - max(span.0, 0.004), longitude: marker.position.longitude - max(span.1, 0.004)),
      coordinate: CLLocationCoordinate2D(latitude: marker.position.latitude + max(span.0, 0.004), longitude: marker.position.longitude + max(span.1, 0.004))
    )
    mapView.animate(with: GMSCameraUpdate.fit(next, withPadding: 40))
    return true
  }

  private func fitCountry() {
    fitted = true
    guard let first = cameras.first else { return }
    var south = first.latitude, north = first.latitude, west = first.longitude, east = first.longitude
    for camera in cameras {
      south = min(south, camera.latitude); north = max(north, camera.latitude)
      west = min(west, camera.longitude); east = max(east, camera.longitude)
    }
    let bounds = GMSCoordinateBounds(
      coordinate: CLLocationCoordinate2D(latitude: south, longitude: west),
      coordinate: CLLocationCoordinate2D(latitude: north, longitude: east)
    )
    mapView.moveCamera(GMSCameraUpdate.fit(bounds, withPadding: 32))
    refreshPins()
  }

  private func refreshPins() {
    let night = CamAlertPalette.night(session.settings)
    let region = mapView.projection.visibleRegion()
    let north = max(region.farLeft.latitude, region.farRight.latitude)
    let south = min(region.nearLeft.latitude, region.nearRight.latitude)
    let west = min(region.farLeft.longitude, region.nearLeft.longitude)
    let east = max(region.farRight.longitude, region.nearRight.longitude)
    let latDelta = max(north - south, 0.0001)
    let height = max(mapView.bounds.height, 1)
    let individual = latDelta * (32 / height) * 111_320 <= 70
    let visible = cameras.filter { $0.latitude >= south && $0.latitude <= north && $0.longitude >= west && $0.longitude <= east }
    markers.forEach { $0.map = nil }
    if individual {
      markers = visible.prefix(500).map { camera in
        let marker = GMSMarker(position: CLLocationCoordinate2D(latitude: camera.latitude, longitude: camera.longitude))
        marker.title = camera.location ?? camera.name
        marker.snippet = camera.speedLimit.map { "\(Int($0.rounded()))" }
        marker.icon = RoadPins.icon(kind: RoadPins.kind(camera.type), count: nil, night: night)
        marker.groundAnchor = CGPoint(x: 0.5, y: 0.5)
        marker.map = mapView
        return marker
      }
      return
    }
    let cellLat = latDelta * (32 / height)
    let cellLng = max(east - west, 0.0001) * (32 / max(mapView.bounds.width, 1))
    var groups: [String: [CameraRecord]] = [:]
    for camera in visible {
      let key = "\(Int((camera.latitude / cellLat).rounded(.down))):\(Int((camera.longitude / max(cellLng, 0.00001)).rounded(.down)))"
      groups[key, default: []].append(camera)
    }
    markers = groups.values.map { group in
      let latitude = group.map(\.latitude).reduce(0, +) / Double(group.count)
      let longitude = group.map(\.longitude).reduce(0, +) / Double(group.count)
      let marker = GMSMarker(position: CLLocationCoordinate2D(latitude: latitude, longitude: longitude))
      if group.count == 1, let camera = group.first {
        marker.title = camera.location ?? camera.name
        marker.icon = RoadPins.icon(kind: RoadPins.kind(camera.type), count: nil, night: night)
      } else {
        marker.icon = RoadPins.icon(kind: "speed", count: group.count, night: night)
        let spanLat = (group.map(\.latitude).max() ?? latitude) - (group.map(\.latitude).min() ?? latitude)
        let spanLng = (group.map(\.longitude).max() ?? longitude) - (group.map(\.longitude).min() ?? longitude)
        marker.userData = (max(spanLat * 1.2, 0.01), max(spanLng * 1.2, 0.01))
      }
      marker.groundAnchor = CGPoint(x: 0.5, y: 0.5)
      marker.map = mapView
      return marker
    }
  }
}

final class RoadCatalogViewController: UIViewController, GMSMapViewDelegate {
  private let session = CamAlertSession.shared
  private let mapView = GMSMapView()
  private let list = UIStackView()
  private var cameras: [CameraRecord] = []
  private var page = 0
  private var markers: [GMSMarker] = []
  private let pageLabel = UILabel()

  override func viewDidLoad() {
    super.viewDidLoad()
    let night = CamAlertPalette.night(session.settings)
    let language = session.settings.language
    view.backgroundColor = night ? CamAlertPalette.nightPage : UIColor(red: 245 / 255, green: 246 / 255, blue: 248 / 255, alpha: 1)
    cameras = session.catalog.cameras(for: session.settings.country.uppercased())
    let ink = night ? UIColor.white : UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1)
    let back = UIButton(type: .system)
    back.setTitle("‹  \(CamAlertPhrases.settings(language).back)", for: .normal)
    back.setTitleColor(ink, for: .normal)
    back.titleLabel?.font = .camalert(17, weight: .bold)
    back.contentHorizontalAlignment = .leading
    back.addAction(UIAction { [weak self] _ in self?.navigationController?.popViewController(animated: true) }, for: .touchUpInside)
    let title = UILabel()
    title.text = language == "uk" ? "Каталог камер" : language == "en" ? "Camera catalog" : language == "pl" ? "Katalog kamer" : "Каталог камер"
    title.font = .camalert(28, weight: .black)
    title.textColor = ink
    let note = UILabel()
    note.text = language == "uk" ? "Точки контролю на дорогах. Відеотрансляції не підключені." : language == "en" ? "Road enforcement locations. Video feeds are not connected." : language == "pl" ? "Punkty kontroli drogowej. Transmisje wideo nie są podłączone." : "Точки контроля на дорогах. Видеотрансляции не подключены."
    note.numberOfLines = 0
    note.font = .camalert(14)
    note.textColor = night ? CamAlertPalette.mutedNight : CamAlertPalette.muted
    mapView.translatesAutoresizingMaskIntoConstraints = false
    mapView.delegate = self
    mapView.layer.cornerRadius = 16
    mapView.clipsToBounds = true
    mapView.heightAnchor.constraint(equalToConstant: 275).isActive = true
    list.axis = .vertical
    list.spacing = 8
    let previous = pagerButton(language == "uk" ? "Назад" : language == "en" ? "Previous" : language == "pl" ? "Wstecz" : "Назад", delta: -1)
    let next = pagerButton(language == "uk" ? "Далі" : language == "en" ? "Next" : language == "pl" ? "Dalej" : "Далее", delta: 1)
    pageLabel.font = .camalert(14, weight: .semibold)
    pageLabel.textColor = note.textColor
    pageLabel.textAlignment = .center
    let pager = UIStackView(arrangedSubviews: [previous, pageLabel, next])
    pager.axis = .horizontal
    pager.distribution = .fillEqually
    pager.spacing = 8
    let stack = UIStackView(arrangedSubviews: [back, title, note, mapView, list, pager])
    stack.axis = .vertical
    stack.spacing = 10
    stack.translatesAutoresizingMaskIntoConstraints = false
    let scroll = UIScrollView()
    scroll.translatesAutoresizingMaskIntoConstraints = false
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
      stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -16),
      stack.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor, constant: -32),
    ])
    showPage()
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    navigationController?.setNavigationBarHidden(true, animated: animated)
  }

  private func pagerButton(_ title: String, delta: Int) -> UIButton {
    let button = UIButton(type: .system)
    button.setTitle(title, for: .normal)
    button.setTitleColor(UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1), for: .normal)
    button.titleLabel?.font = .camalert(15, weight: .bold)
    button.backgroundColor = .white
    button.layer.cornerRadius = 14
    button.heightAnchor.constraint(equalToConstant: 40).isActive = true
    button.addAction(UIAction { [weak self] _ in
      guard let self else { return }
      let pages = max(1, Int(ceil(Double(self.cameras.count) / 50)))
      self.page = min(max(self.page + delta, 0), pages - 1)
      self.showPage()
    }, for: .touchUpInside)
    return button
  }

  private func showPage() {
    let pages = max(1, Int(ceil(Double(cameras.count) / 50)))
    page = min(page, pages - 1)
    let slice = Array(cameras.dropFirst(page * 50).prefix(50))
    pageLabel.text = "\(page + 1) / \(pages)"
    list.arrangedSubviews.forEach { $0.removeFromSuperview() }
    markers.forEach { $0.map = nil }
    let night = CamAlertPalette.night(session.settings)
    let ink = night ? UIColor.white : UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1)
    markers = slice.map { camera in
      let marker = GMSMarker(position: CLLocationCoordinate2D(latitude: camera.latitude, longitude: camera.longitude))
      marker.title = camera.location ?? camera.name
      marker.icon = RoadPins.icon(kind: RoadPins.kind(camera.type), count: nil, night: night)
      marker.groundAnchor = CGPoint(x: 0.5, y: 0.5)
      marker.map = mapView
      return marker
    }
    if let first = slice.first {
      var bounds = GMSCoordinateBounds(coordinate: CLLocationCoordinate2D(latitude: first.latitude, longitude: first.longitude), coordinate: CLLocationCoordinate2D(latitude: first.latitude, longitude: first.longitude))
      for camera in slice {
        bounds = bounds.includingCoordinate(CLLocationCoordinate2D(latitude: camera.latitude, longitude: camera.longitude))
      }
      mapView.moveCamera(GMSCameraUpdate.fit(bounds, withPadding: 28))
    }
    for camera in slice {
      let row = UIButton(type: .system)
      let limit = camera.speedLimit.map { " · \(Int($0.rounded()))" } ?? ""
      row.setTitle("\(camera.location ?? camera.name ?? RoadPins.kind(camera.type))\(limit)", for: .normal)
      row.setTitleColor(ink, for: .normal)
      row.titleLabel?.font = .camalert(15, weight: .semibold)
      row.titleLabel?.numberOfLines = 2
      row.contentHorizontalAlignment = .leading
      row.backgroundColor = night ? CamAlertPalette.cardNight : .white
      row.layer.cornerRadius = 14
      row.contentEdgeInsets = UIEdgeInsets(top: 10, left: 12, bottom: 10, right: 12)
      row.addAction(UIAction { [weak self] _ in
        self?.mapView.animate(to: GMSCameraPosition.camera(withLatitude: camera.latitude, longitude: camera.longitude, zoom: 16))
      }, for: .touchUpInside)
      list.addArrangedSubview(row)
    }
  }
}

enum RoadPins {
  static func kind(_ type: String?) -> String {
    let value = type ?? "speed_camera"
    if value == "red_light" { return "light" }
    if value.contains("average") { return "section" }
    if value == "checkpoint" || value == "other_enforcement" { return "checkpoint" }
    return "speed"
  }

  static func icon(kind: String, count: Int?, night: Bool) -> UIImage {
    let size = CGSize(width: 28, height: 28)
    let fill: UIColor
    if count != nil {
      fill = night ? UIColor(red: 232 / 255, green: 238 / 255, blue: 246 / 255, alpha: 1) : UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1)
    } else {
      switch kind {
      case "light": fill = UIColor(red: 27 / 255, green: 36 / 255, blue: 48 / 255, alpha: 1)
      case "section": fill = UIColor(red: 18 / 255, green: 96 / 255, blue: 232 / 255, alpha: 1)
      case "checkpoint": fill = UIColor(red: 75 / 255, green: 85 / 255, blue: 99 / 255, alpha: 1)
      default: fill = UIColor(red: 208 / 255, green: 18 / 255, blue: 18 / 255, alpha: 1)
      }
    }
    return UIGraphicsImageRenderer(size: size).image { _ in
      fill.setFill()
      UIBezierPath(ovalIn: CGRect(x: 1, y: 1, width: 26, height: 26)).fill()
      UIColor.white.setStroke()
      let ring = UIBezierPath(ovalIn: CGRect(x: 1, y: 1, width: 26, height: 26))
      ring.lineWidth = 1.5
      ring.stroke()
      if let count {
        let text = (count > 99 ? "99+" : "\(count)") as NSString
        let style = NSMutableParagraphStyle()
        style.alignment = .center
        let color: UIColor = night ? UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1) : .white
        text.draw(in: CGRect(x: 0, y: 6, width: 28, height: 16), withAttributes: [
          .font: UIFont.camalert(11, weight: .heavy),
          .foregroundColor: color,
          .paragraphStyle: style,
        ])
      } else {
        UIColor.white.setFill()
        UIBezierPath(roundedRect: CGRect(x: 8, y: 10, width: 12, height: 8), cornerRadius: 2).fill()
      }
    }
  }
}

enum CarPlaySupport {
  static let backgroundLocationReady = true
}
