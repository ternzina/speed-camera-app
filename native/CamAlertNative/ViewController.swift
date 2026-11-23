import AVFoundation
import CoreLocation
import GoogleMaps
import GoogleNavigation
import UIKit

/// Same order as the working Nav Voice Probe:
/// terms, enable navigation, setDestinations, then voiceGuidance immediately before guidance.
/// Phone location only. No navigation simulator and no React Native voice experiments.
final class ViewController: UIViewController, CLLocationManagerDelegate, GMSMapViewDelegate, GMSNavigatorListener, AVSpeechSynthesizerDelegate, UITextFieldDelegate, UITableViewDataSource, UITableViewDelegate {
  private let locationManager = CLLocationManager()
  private let mapView = GMSMapView()
  private let searchCard = UIView()
  private let searchField = UITextField()
  private let resultsTable = UITableView()
  private let statusLabel = UILabel()
  private let cameraBanner = UIStackView()
  private let bannerType = UILabel()
  private let bannerDistance = UILabel()
  private let bannerLimit = UILabel()
  private let routeButton = UIButton(type: .system)
  private let backButton = UIButton(type: .system)
  private var backTop: NSLayoutConstraint?
  private let startButton = UIButton(type: .system)
  private let stopButton = UIButton(type: .system)
  private let bottomBar = UIView()
  private let tripLabel = UILabel()
  private let summaryCard = UIView()
  private let distanceValue = UILabel()
  private let durationValue = UILabel()
  private let arrivalValue = UILabel()
  private let mapMenu = UIStackView()
  private weak var clearRouteButton: UIButton?
  private var routeMeters = 0
  private var routeMinutes = 0
  private let speedValue = UILabel()
  private var speedAboveBar: NSLayoutConstraint?
  private var speedAboveFloor: NSLayoutConstraint?
  private var resultsHeight: NSLayoutConstraint?
  private var suggestions: [PlacesClient.Suggestion] = []
  private var placeToken = UUID().uuidString
  private var searchTimer: Timer?
  private var searchTicket = 0
  private var lastLocation: CLLocation?
  private var destination: GMSNavigationWaypoint? { didSet { refreshDriveChrome() } }
  private var destinationMarker: GMSMarker?
  private var routeReady = false { didSet { refreshDriveChrome() } }
  private var routeTicket = 0
  var focusSearch = false

  func focusDestination() {
    searchField.becomeFirstResponder()
  }

  var navigatorIsIdle: Bool {
    mapView.navigator?.isGuidanceActive != true && !routeReady && destination == nil
  }
  private let session = CamAlertSession.shared
  private let speaker = AVSpeechSynthesizer()
  private let ukrainianPlayer = UkrainianClipPlayer()
  private var cameraMarkers: [GMSMarker] = []
  private var warnedAt = Date.distantPast

  override func viewDidLoad() {
    super.viewDidLoad()
    let night = CamAlertPalette.night(session.settings)
    view.backgroundColor = night ? CamAlertPalette.nightPage : UIColor(red: 221 / 255, green: 232 / 255, blue: 240 / 255, alpha: 1)
    overrideUserInterfaceStyle = night ? .dark : .light

    mapView.translatesAutoresizingMaskIntoConstraints = false
    mapView.delegate = self
    mapView.settings.compassButton = false
    mapView.settings.myLocationButton = false
    mapView.settings.isNavigationHeaderEnabled = false
    mapView.settings.isNavigationFooterEnabled = false
    mapView.settings.isRecenterButtonEnabled = false
    mapView.settings.showsDestinationMarkers = false
    mapView.settings.isNavigationReportIncidentButtonEnabled = false
    mapView.cameraMode = .free
    mapView.isMyLocationEnabled = true
    mapView.travelMode = .driving

    searchCard.translatesAutoresizingMaskIntoConstraints = false
    searchCard.backgroundColor = night ? UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 0.96) : UIColor(white: 1, alpha: 0.96)
    searchCard.layer.cornerRadius = 18
    searchField.placeholder = "Куда едем?"
    searchField.font = .camalert(17, weight: .semibold)
    searchField.textColor = night ? .white : CamAlertPalette.ink
    searchField.autocorrectionType = .no
    searchField.autocapitalizationType = .words
    searchField.returnKeyType = .search
    searchField.clearButtonMode = .whileEditing
    searchField.delegate = self
    searchField.addTarget(self, action: #selector(queryChanged), for: .editingChanged)
    searchField.translatesAutoresizingMaskIntoConstraints = false
    resultsTable.dataSource = self
    resultsTable.delegate = self
    resultsTable.backgroundColor = .clear
    resultsTable.separatorInset = UIEdgeInsets(top: 0, left: 12, bottom: 0, right: 12)
    resultsTable.keyboardDismissMode = .none
    resultsTable.translatesAutoresizingMaskIntoConstraints = false
    searchCard.addSubview(searchField)
    searchCard.addSubview(resultsTable)

    statusLabel.translatesAutoresizingMaskIntoConstraints = false
    statusLabel.numberOfLines = 2
    statusLabel.font = .camalert(14, weight: .bold)
    statusLabel.textColor = night ? .white : CamAlertPalette.ink
    statusLabel.text = "Введите адрес в поле «Куда едем?» или нажмите на карту"

    bottomBar.translatesAutoresizingMaskIntoConstraints = false
    bottomBar.backgroundColor = .clear

    configure(routeButton, title: "Построить маршрут", filled: true, size: 16, action: #selector(buildRoute))
    configure(startButton, title: "В путь", filled: true, size: 22, action: #selector(startGuidance))
    configure(stopButton, title: "Завершить поездку", filled: true, size: 16, action: #selector(stopGuidance))
    summaryCard.translatesAutoresizingMaskIntoConstraints = false
    summaryCard.backgroundColor = night ? UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 0.94) : UIColor(white: 1, alpha: 0.96)
    summaryCard.layer.cornerRadius = 16
    let summary = UIStackView(arrangedSubviews: [
      routeStat(distanceValue, "Расстояние", night: night),
      routeStat(durationValue, "В пути", night: night),
      routeStat(arrivalValue, "Прибытие", night: night),
    ])
    summary.axis = .horizontal
    summary.distribution = .fillEqually
    summary.translatesAutoresizingMaskIntoConstraints = false
    summaryCard.addSubview(summary)
    NSLayoutConstraint.activate([
      summary.topAnchor.constraint(equalTo: summaryCard.topAnchor, constant: 6),
      summary.leadingAnchor.constraint(equalTo: summaryCard.leadingAnchor, constant: 4),
      summary.trailingAnchor.constraint(equalTo: summaryCard.trailingAnchor, constant: -4),
      summary.bottomAnchor.constraint(equalTo: summaryCard.bottomAnchor, constant: -6),
      summaryCard.heightAnchor.constraint(greaterThanOrEqualToConstant: 52),
    ])
    tripLabel.isHidden = true
    let controls = UIStackView(arrangedSubviews: [summaryCard, statusLabel, routeButton, startButton, stopButton])
    controls.axis = .vertical
    controls.spacing = 8
    controls.translatesAutoresizingMaskIntoConstraints = false
    bottomBar.addSubview(controls)

    backButton.setTitle("‹  Назад", for: .normal)
    backButton.setTitleColor(CamAlertPalette.blue, for: .normal)
    backButton.titleLabel?.font = .camalert(17, weight: .bold)
    backButton.backgroundColor = night ? UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 0.94) : UIColor(white: 1, alpha: 0.94)
    backButton.layer.cornerRadius = 16
    backButton.contentEdgeInsets = UIEdgeInsets(top: 8, left: 12, bottom: 8, right: 14)
    backButton.addTarget(self, action: #selector(closeDrive), for: .touchUpInside)
    backButton.translatesAutoresizingMaskIntoConstraints = false

    speedValue.font = .camalert(26, weight: .black)
    speedValue.textColor = night ? .white : CamAlertPalette.ink
    speedValue.text = "0"
    speedValue.textAlignment = .center
    let speedUnit = UILabel()
    speedUnit.text = "км/ч"
    speedUnit.font = .camalert(11, weight: .bold)
    speedUnit.textColor = night ? CamAlertPalette.mutedNight : CamAlertPalette.muted
    speedUnit.textAlignment = .center
    let speedStack = UIStackView(arrangedSubviews: [speedValue, speedUnit])
    speedStack.axis = .vertical
    speedStack.alignment = .center
    let speedCircle = UIView()
    speedCircle.backgroundColor = bottomBar.backgroundColor
    speedCircle.layer.cornerRadius = 32
    speedCircle.layer.borderWidth = 1.5
    speedCircle.layer.borderColor = UIColor(red: 18 / 255, green: 96 / 255, blue: 232 / 255, alpha: 0.45).cgColor
    speedCircle.translatesAutoresizingMaskIntoConstraints = false
    speedStack.translatesAutoresizingMaskIntoConstraints = false
    speedCircle.addSubview(speedStack)

    let layers = mapTool("▦", action: #selector(toggleMapMenu))
    let locate = mapTool("⌖", action: #selector(recenterMap))
    let clear = mapTool("×", action: #selector(clearRoute))
    clear.setTitleColor(UIColor(red: 154 / 255, green: 52 / 255, blue: 18 / 255, alpha: 1), for: .normal)
    clearRouteButton = clear
    mapMenu.axis = .vertical
    mapMenu.spacing = 0
    mapMenu.isHidden = true
    mapMenu.backgroundColor = night ? UIColor(red: 22 / 255, green: 48 / 255, blue: 74 / 255, alpha: 1) : .white
    mapMenu.layer.cornerRadius = 12
    mapMenu.clipsToBounds = true
    mapMenu.translatesAutoresizingMaskIntoConstraints = false
    for (title, kind) in [("Схема", GMSMapViewType.normal), ("Спутник", GMSMapViewType.satellite), ("Гибрид", GMSMapViewType.hybrid)] {
      let row = UIButton(type: .system)
      row.setTitle(title, for: .normal)
      row.setTitleColor(night ? .white : CamAlertPalette.ink, for: .normal)
      row.titleLabel?.font = .camalert(15, weight: .bold)
      row.contentHorizontalAlignment = .leading
      row.contentEdgeInsets = UIEdgeInsets(top: 8, left: 12, bottom: 8, right: 12)
      row.addAction(UIAction { [weak self] _ in self?.chooseMap(kind) }, for: .touchUpInside)
      row.heightAnchor.constraint(equalToConstant: 40).isActive = true
      mapMenu.addArrangedSubview(row)
    }
    let toolRow = UIStackView(arrangedSubviews: [layers, locate, clear])
    toolRow.axis = .horizontal
    toolRow.spacing = 8
    toolRow.alignment = .center
    let mapTools = UIStackView(arrangedSubviews: [mapMenu, toolRow])
    mapTools.axis = .vertical
    mapTools.spacing = 6
    mapTools.alignment = .leading
    mapTools.translatesAutoresizingMaskIntoConstraints = false
    controls.addArrangedSubview(mapTools)
    cameraBanner.axis = .horizontal
    cameraBanner.spacing = 8
    cameraBanner.alignment = .center
    cameraBanner.layoutMargins = UIEdgeInsets(top: 6, left: 10, bottom: 6, right: 10)
    cameraBanner.isLayoutMarginsRelativeArrangement = true
    cameraBanner.backgroundColor = UIColor(red: 142 / 255, green: 42 / 255, blue: 34 / 255, alpha: 1)
    cameraBanner.layer.cornerRadius = 14
    cameraBanner.clipsToBounds = true
    cameraBanner.isHidden = true
    cameraBanner.translatesAutoresizingMaskIntoConstraints = false
    bannerType.font = .camalert(14, weight: .bold)
    bannerType.textColor = .white
    bannerType.numberOfLines = 2
    bannerDistance.font = .camalert(18, weight: .black)
    bannerDistance.textColor = .white
    bannerLimit.font = .camalert(18, weight: .black)
    bannerLimit.textColor = .white
    cameraBanner.addArrangedSubview(bannerType)
    cameraBanner.addArrangedSubview(bannerDistance)
    cameraBanner.addArrangedSubview(bannerLimit)

    let chrome = TouchPassView()
    chrome.translatesAutoresizingMaskIntoConstraints = false
    chrome.backgroundColor = .clear
    view.addSubview(mapView)
    view.addSubview(chrome)
    chrome.addSubview(searchCard)
    chrome.addSubview(cameraBanner)
    chrome.addSubview(backButton)
    chrome.addSubview(speedCircle)
    chrome.addSubview(bottomBar)
    NSLayoutConstraint.activate([
      chrome.topAnchor.constraint(equalTo: view.topAnchor),
      chrome.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      chrome.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      chrome.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])

    let guide = view.safeAreaLayoutGuide
    backTop = backButton.topAnchor.constraint(equalTo: view.topAnchor, constant: 78)
    resultsHeight = resultsTable.heightAnchor.constraint(equalToConstant: 0)
    NSLayoutConstraint.activate([
      mapView.topAnchor.constraint(equalTo: view.topAnchor),
      mapView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      mapView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      mapView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      backTop!,
      backButton.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 12),
      backButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
      searchCard.topAnchor.constraint(equalTo: backButton.bottomAnchor, constant: 10),
      searchCard.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 12),
      searchCard.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -12),
      searchField.topAnchor.constraint(equalTo: searchCard.topAnchor, constant: 8),
      searchField.leadingAnchor.constraint(equalTo: searchCard.leadingAnchor, constant: 14),
      searchField.trailingAnchor.constraint(equalTo: searchCard.trailingAnchor, constant: -14),
      searchField.heightAnchor.constraint(equalToConstant: 44),
      resultsTable.topAnchor.constraint(equalTo: searchField.bottomAnchor),
      resultsTable.leadingAnchor.constraint(equalTo: searchCard.leadingAnchor),
      resultsTable.trailingAnchor.constraint(equalTo: searchCard.trailingAnchor),
      resultsTable.bottomAnchor.constraint(equalTo: searchCard.bottomAnchor, constant: -6),
      resultsHeight!,
      cameraBanner.topAnchor.constraint(equalTo: searchCard.bottomAnchor, constant: 6),
      cameraBanner.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 12),
      cameraBanner.trailingAnchor.constraint(lessThanOrEqualTo: guide.trailingAnchor, constant: -72),
      speedCircle.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 12),
      speedCircle.widthAnchor.constraint(equalToConstant: 64),
      speedCircle.heightAnchor.constraint(equalToConstant: 64),
      speedStack.centerXAnchor.constraint(equalTo: speedCircle.centerXAnchor),
      speedStack.centerYAnchor.constraint(equalTo: speedCircle.centerYAnchor),
      bottomBar.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 12),
      bottomBar.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -12),
      bottomBar.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -8),
      controls.topAnchor.constraint(equalTo: bottomBar.topAnchor, constant: 10),
      controls.leadingAnchor.constraint(equalTo: bottomBar.leadingAnchor, constant: 10),
      controls.trailingAnchor.constraint(equalTo: bottomBar.trailingAnchor, constant: -10),
      controls.bottomAnchor.constraint(equalTo: bottomBar.bottomAnchor, constant: -10),
      routeButton.heightAnchor.constraint(equalToConstant: 44),
      startButton.heightAnchor.constraint(equalToConstant: 52),
      stopButton.heightAnchor.constraint(equalToConstant: 44),
      mapMenu.widthAnchor.constraint(equalToConstant: 168),
    ])
    speedAboveBar = speedCircle.bottomAnchor.constraint(equalTo: bottomBar.topAnchor, constant: -10)
    speedAboveFloor = speedCircle.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -16)
    refreshDriveChrome()

    NotificationCenter.default.addObserver(self, selector: #selector(routeRequested(_:)), name: .camalertRouteTo, object: nil)
    locationManager.delegate = self
    locationManager.allowsBackgroundLocationUpdates = false
    locationManager.pausesLocationUpdatesAutomatically = false
    locationManager.requestWhenInUseAuthorization()
    speaker.delegate = self
    showTerms()
    Task { _ = await session.catalog.ensureCountry(session.settings.country.uppercased()) }
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    navigationController?.setNavigationBarHidden(true, animated: animated)
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    scheduleVoiceRestartHint()
    if focusSearch {
      focusSearch = false
      searchField.becomeFirstResponder()
    }
    if ProcessInfo.processInfo.arguments.contains("--voice-check"), !voiceCheckStarted {
      voiceCheckStarted = true
      runVoiceCheck()
    }
  }

  override func viewSafeAreaInsetsDidChange() {
    super.viewSafeAreaInsetsDidChange()
    let top = view.safeAreaInsets.top
    backTop?.constant = (top > 20 ? top : 59) + 28
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    liftChrome()
  }

  private func liftChrome() {
    guard let chrome = backButton.superview else { return }
    view.bringSubviewToFront(chrome)
    chrome.bringSubviewToFront(searchCard)
    chrome.bringSubviewToFront(cameraBanner)
    chrome.bringSubviewToFront(bottomBar)
    if let tools = mapMenu.superview { chrome.bringSubviewToFront(tools) }
    if let circle = speedValue.superview?.superview { chrome.bringSubviewToFront(circle) }
    chrome.bringSubviewToFront(backButton)
  }

  private func mapTool(_ title: String, action: Selector) -> UIButton {
    let night = CamAlertPalette.night(session.settings)
    let button = UIButton(type: .system)
    button.setTitle(title, for: .normal)
    button.setTitleColor(night ? .white : CamAlertPalette.ink, for: .normal)
    button.titleLabel?.font = .camalert(18, weight: .bold)
    button.backgroundColor = night ? UIColor(red: 12 / 255, green: 31 / 255, blue: 49 / 255, alpha: 0.94) : UIColor(white: 1, alpha: 0.94)
    button.layer.cornerRadius = 14
    button.translatesAutoresizingMaskIntoConstraints = false
    button.widthAnchor.constraint(equalToConstant: 40).isActive = true
    button.heightAnchor.constraint(equalToConstant: 40).isActive = true
    button.addTarget(self, action: action, for: .touchUpInside)
    return button
  }

  @objc private func toggleMapMenu() {
    mapMenu.isHidden.toggle()
  }

  private func chooseMap(_ kind: GMSMapViewType) {
    mapView.mapType = kind
    mapMenu.isHidden = true
  }

  private func refreshDriveChrome() {
    guard isViewLoaded else { return }
    let guiding = mapView.navigator?.isGuidanceActive == true
    routeButton.isHidden = guiding || routeReady || destination == nil
    startButton.isHidden = guiding || !routeReady
    stopButton.isHidden = !guiding
    tripLabel.isHidden = true
    let quiet: Set<String> = [
      "Введите адрес в поле «Куда едем?» или нажмите на карту",
      "Нажмите на карту, чтобы построить маршрут",
      "Введите адрес или нажмите на карту",
      "Маршрут закрыт",
      "Навигация начата",
      "Навигация завершена",
      "Маршрут обновлён",
      "Ожидание геолокации",
    ]
    summaryCard.isHidden = !(routeReady || guiding)
    clearRouteButton?.isHidden = destination == nil && !routeReady && !guiding
    statusLabel.isHidden = !summaryCard.isHidden || quiet.contains(statusLabel.text ?? "")
    routeButton.isEnabled = !routeButton.isHidden
    startButton.isEnabled = !startButton.isHidden
    stopButton.isEnabled = !stopButton.isHidden
    bottomBar.isHidden = false
    speedAboveBar?.isActive = true
    speedAboveFloor?.isActive = false
  }

  private func routeStat(_ value: UILabel, _ caption: String, night: Bool) -> UIView {
    value.font = .camalert(18, weight: .heavy)
    value.textColor = night ? .white : CamAlertPalette.ink
    value.textAlignment = .center
    value.text = "—"
    value.adjustsFontSizeToFitWidth = true
    value.minimumScaleFactor = 0.7
    let note = UILabel()
    note.text = caption
    note.font = .camalert(11, weight: .semibold)
    note.textColor = night ? CamAlertPalette.mutedNight : CamAlertPalette.muted
    note.textAlignment = .center
    let column = UIStackView(arrangedSubviews: [value, note])
    column.axis = .vertical
    column.alignment = .center
    column.spacing = 1
    return column
  }

  private func rememberRoute(meters: Int, minutes: Int) {
    routeMeters = max(0, meters)
    routeMinutes = max(1, minutes)
    distanceValue.text = routeMeters >= 1000
      ? String(format: routeMeters >= 10000 ? "%.0f км" : "%.1f км", Double(routeMeters) / 1000)
      : "\(routeMeters) м"
    durationValue.text = routeMinutes >= 60
      ? "\(routeMinutes / 60) ч. \(routeMinutes % 60) мин"
      : "\(routeMinutes) мин"
    let arrival = Date().addingTimeInterval(TimeInterval(routeMinutes * 60))
    let clock = DateFormatter()
    clock.dateFormat = "HH:mm"
    arrivalValue.text = clock.string(from: arrival)
  }

  @objc private func recenterMap() {
    if mapView.navigator?.isGuidanceActive == true {
      mapView.cameraMode = .following
      return
    }
    guard let location = lastLocation ?? locationManager.location else { return }
    mapView.animate(to: GMSCameraPosition(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude, zoom: max(mapView.camera.zoom, 15)))
  }

  @objc private func clearRoute() {
    if mapView.navigator?.isGuidanceActive == true {
      stopGuidance()
      return
    }
    mapView.navigator?.clearDestinations()
    routeReady = false
    destination = nil
    routeMeters = 0
    routeMinutes = 0
    destinationMarker?.map = nil
    destinationMarker = nil
    statusLabel.text = "Маршрут закрыт"
    refreshDriveChrome()
  }

  private func configure(_ button: UIButton, title: String, filled: Bool, size: CGFloat = 15, action: Selector) {
    button.translatesAutoresizingMaskIntoConstraints = false
    var config = UIButton.Configuration.filled()
    config.title = title
    config.baseBackgroundColor = filled ? CamAlertPalette.blue : UIColor(red: 117 / 255, green: 34 / 255, blue: 44 / 255, alpha: 0.94)
    config.baseForegroundColor = .white
    config.cornerStyle = .fixed
    config.background.cornerRadius = filled ? 18 : 14
    config.contentInsets = NSDirectionalEdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12)
    config.titleLineBreakMode = .byTruncatingTail
    button.maximumContentSizeCategory = .extraExtraLarge
    button.titleLabel?.adjustsFontSizeToFitWidth = true
    button.titleLabel?.minimumScaleFactor = 0.7
    config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
      var outgoing = incoming
      outgoing.font = .camalert(size, weight: .heavy)
      return outgoing
    }
    button.configuration = config
    button.addTarget(self, action: action, for: .touchUpInside)
  }

  private func scheduleVoiceRestartHint() {
    DispatchQueue.main.async { [weak self] in
      self?.considerVoiceRestartHint()
    }
  }

  /// Public Google callback is the terms completion. The sheet waits until that
  /// dialog and the location prompt are both gone, then appears once.
  private func considerVoiceRestartHint(attempt: Int = 0) {
    let key = "camalert.voiceRestart.shown"
    guard !UserDefaults.standard.bool(forKey: key) else { return }
    guard !ProcessInfo.processInfo.arguments.contains("--voice-check") else { return }
    guard GMSNavigationServices.areTermsAndConditionsAccepted() else { return }
    switch locationManager.authorizationStatus {
    case .authorizedAlways, .authorizedWhenInUse:
      break
    default:
      return
    }
    guard let window = view.window else { return }
    let presenter = window.rootViewController ?? self
    let dialogStillUp = presentedViewController != nil || presenter.presentedViewController != nil
    if dialogStillUp {
      guard attempt < 8 else { return }
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
        self?.considerVoiceRestartHint(attempt: attempt + 1)
      }
      return
    }
    UserDefaults.standard.set(true, forKey: key)
    let sheet = VoiceRestartController(language: session.settings.language)
    sheet.modalPresentationStyle = .overFullScreen
    sheet.modalTransitionStyle = .crossDissolve
    presenter.present(sheet, animated: true)
  }

  private func showTerms() {
    let options = GMSNavigationTermsAndConditionsOptions(companyName: "CamAlert")
    GMSNavigationServices.showTermsAndConditionsDialogIfNeeded(with: options) { [weak self] accepted in
      guard let self else { return }
      guard accepted else {
        self.statusLabel.text = "Примите условия Google"
        return
      }
      self.mapView.isNavigationEnabled = true
      self.liftChrome()
      self.scheduleVoiceRestartHint()
      if self.destination != nil {
        self.buildRoute()
      } else if self.lastLocation == nil {
        self.statusLabel.text = "Ожидание геолокации"
      } else {
        self.statusLabel.text = "Введите адрес в поле «Куда едем?» или нажмите на карту"
      }
    }
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    switch manager.authorizationStatus {
    case .authorizedWhenInUse, .authorizedAlways:
      manager.startUpdatingLocation()
      mapView.isMyLocationEnabled = true
      scheduleVoiceRestartHint()
    case .denied, .restricted:
      statusLabel.text = "Геолокация запрещена"
    default:
      break
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    if voiceCheck, !voiceCheckInjecting {
      VoiceCheckLog.line("ignored-live-gps")
      return
    }
    guard let location = locations.last else { return }
    let first = lastLocation == nil
    lastLocation = location
    if first {
      mapView.camera = GMSCameraPosition.camera(withTarget: location.coordinate, zoom: 15)
      if GMSNavigationServices.areTermsAndConditionsAccepted(), destination == nil {
        statusLabel.text = "Нажмите на карту, чтобы построить маршрут"
      }
    }
    let speed = location.speed >= 0 ? location.speed * 3.6 : 0
    speedValue.text = String(Int(speed.rounded()))
    refreshCameras(around: location)
    considerSection(location)
    considerWarning(location)
  }

  private func refreshCameras(around location: CLLocation) {
    let code = session.settings.country.uppercased()
    let nearby = session.catalog.nearby(code, latitude: location.coordinate.latitude, longitude: location.coordinate.longitude, radius: 2500)
      .sorted { CamAlertGeo.distanceMeters(location.coordinate.latitude, location.coordinate.longitude, $0.latitude, $0.longitude) < CamAlertGeo.distanceMeters(location.coordinate.latitude, location.coordinate.longitude, $1.latitude, $1.longitude) }
      .prefix(120)
    let signature = nearby.map(\.id).joined(separator: ",")
    guard signature != cameraMarkers.compactMap(\.title).joined(separator: ",") else { return }
    cameraMarkers.forEach { $0.map = nil }
    cameraMarkers = nearby.map { camera in
      let marker = GMSMarker(position: CLLocationCoordinate2D(latitude: camera.latitude, longitude: camera.longitude))
      marker.title = camera.id
      marker.icon = GMSMarker.markerImage(with: markerColor(camera.type))
      marker.map = mapView
      return marker
    }
  }

  private func markerColor(_ type: String?) -> UIColor {
    switch type {
    case "red_light": return UIColor(red: 0.11, green: 0.14, blue: 0.19, alpha: 1)
    case "checkpoint": return UIColor(red: 0.29, green: 0.33, blue: 0.39, alpha: 1)
    case "average_speed_section": return UIColor(red: 0.07, green: 0.38, blue: 0.91, alpha: 1)
    default: return UIColor(red: 0.82, green: 0.07, blue: 0.07, alpha: 1)
    }
  }

  private func considerSection(_ location: CLLocation) {
    let heading = location.course >= 0 ? location.course : nil
    guard let notice = session.sectionNotice(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude, heading: heading) else { return }
    speak(notice.speech, title: notice.title, locale: notice.locale)
  }

  private var voiceCheckStarted = false
  private var voiceCheck = false
  private var voiceCheckInjecting = false

  private func updateCameraBanner(_ decision: WarningDecision) {
    let visible = decision.cameraId != nil && (decision.reason == "warn" || decision.reason == "repeat")
    cameraBanner.isHidden = !visible
    guard visible, let id = decision.cameraId else { return }
    let language = session.settings.language
    let camera = session.catalog.cameras(for: session.settings.country.uppercased()).first { $0.id == id }
    bannerType.text = Self.cameraKind(camera?.type, language: language)
    bannerType.isHidden = (bannerType.text ?? "").isEmpty
    if let distance = decision.distance {
      bannerDistance.text = "\(distance) \(Self.metersUnit(language))"
      bannerDistance.isHidden = false
    } else {
      bannerDistance.isHidden = true
    }
    if let limit = decision.limit {
      bannerLimit.text = "\(Int(limit.rounded())) \(Self.speedUnit(language))"
      bannerLimit.isHidden = false
    } else {
      bannerLimit.isHidden = true
    }
  }

  private static func cameraKind(_ type: String?, language: String) -> String {
    let key = type ?? "speed_camera"
    let labels: [String: [String: String]] = [
      "ru": ["speed_and_red_light": "Скорость и красный свет", "speed_camera": "Камера скорости", "red_light": "Контроль красного света", "checkpoint": "Контрольная точка", "average_speed": "Средняя скорость", "average_speed_section": "Средняя скорость"],
      "uk": ["speed_and_red_light": "Швидкість і червоне світло", "speed_camera": "Камера швидкості", "red_light": "Контроль червоного світла", "checkpoint": "Контрольна точка", "average_speed": "Середня швидкість", "average_speed_section": "Середня швидкість"],
      "en": ["speed_and_red_light": "Speed and red-light camera", "speed_camera": "Speed camera", "red_light": "Red-light camera", "checkpoint": "Checkpoint", "average_speed": "Average-speed control", "average_speed_section": "Average-speed control"],
      "pl": ["speed_and_red_light": "Prędkość i czerwone światło", "speed_camera": "Fotoradar", "red_light": "Kontrola czerwonego światła", "checkpoint": "Punkt kontroli", "average_speed": "Odcinkowy pomiar prędkości", "average_speed_section": "Odcinkowy pomiar prędkości"],
    ]
    let table = labels[language] ?? labels["ru"] ?? [:]
    return table[key] ?? key
  }

  private static func metersUnit(_ language: String) -> String {
    language == "en" || language == "pl" ? "m" : "м"
  }

  private static func speedUnit(_ language: String) -> String {
    switch language {
    case "uk": return "км/год"
    case "en", "pl": return "km/h"
    default: return "км/ч"
    }
  }

  private func considerWarning(_ location: CLLocation) {
    let speed = location.speed >= 0 ? location.speed * 3.6 : 0
    let heading = location.course >= 0 ? location.course : nil
    guard let decision = session.evaluate(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude, speedKmh: speed, heading: heading) else { return }
    if voiceCheck {
      VoiceCheckLog.line("decision speak=\(decision.speak) reason=\(decision.reason) id=\(decision.cameraId ?? "-") dist=\(decision.distance.map(String.init) ?? "-") speed=\(Int(speed.rounded())) course=\(heading.map { String(Int($0.rounded())) } ?? "-")")
    }
    updateCameraBanner(decision)
    guard decision.speak else { return }
    let copy = CameraCopy.alert(language: session.settings.language, distance: decision.distance ?? 0, limit: decision.limit, speedKmh: speed, speedAvailable: location.speed >= 0)
    let over = location.speed >= 0 && (decision.limit ?? 0) > 0 && speed > (decision.limit ?? 0)
    let country = session.settings.country.uppercased()
    let kind = country == "UA" ? "ua-camera" : (country == "PL" && session.settings.language == "uk" ? "pl-camera" : nil)
    let plan = kind.flatMap { UkrainianVoice.cameraPlan(kind: $0, distance: Double(decision.distance ?? 0), limit: decision.limit, over: over) }
    speak(copy.speech, title: copy.title, locale: copy.locale, clipPlan: plan)
  }

  private func speak(_ speech: String, title: String, locale: String, clipPlan: UkrainianVoice.Plan? = nil) {
    if Date().timeIntervalSince(warnedAt) <= 4 {
      if voiceCheck { VoiceCheckLog.line("gate-held \(speech)") }
      return
    }
    warnedAt = Date()
    statusLabel.text = title
    guard PremiumStore.shared.featuresOpen else {
      PremiumOffer.present(from: self)
      return
    }
    var history = UserDefaults.standard.array(forKey: "camalert.history") as? [[String: String]] ?? []
    history.insert(["title": title, "when": ISO8601DateFormatter().string(from: Date())], at: 0)
    UserDefaults.standard.set(Array(history.prefix(40)), forKey: "camalert.history")
    guard CameraSurfaces.voice(session.settings), !speaker.isSpeaking, !ukrainianPlayer.isPlaying else {
      if voiceCheck { VoiceCheckLog.line("not-spoken busy=\(speaker.isSpeaking || ukrainianPlayer.isPlaying) \(speech)") }
      return
    }
    let guiding = mapView.navigator?.isGuidanceActive == true
    if guiding {
      let before = String(describing: mapView.navigator?.voiceGuidance)
      mapView.navigator?.voiceGuidance = .silent
      if voiceCheck { VoiceCheckLog.line("google-muted from=\(before)") }
    }
    let plan = clipPlan ?? (locale.lowercased().hasPrefix("uk") ? UkrainianVoice.plan(from: speech) : nil)
    if let plan, UkrainianVoice.playable(plan) {
      if voiceCheck { VoiceCheckLog.line("clips \(plan.steps.map(\.id).joined(separator: "+")) guiding=\(guiding)") }
      ukrainianPlayer.play(plan, onOpen: { [weak self] id in
        guard self?.voiceCheck == true else { return }
        VoiceCheckLog.line("clip-open \(id)")
      }, done: { [weak self] played in
        guard let self else { return }
        if self.voiceCheck { VoiceCheckLog.line(played ? "clips-done" : "clips-failed") }
        if played {
          self.restoreNavigationVoice()
        } else {
          self.speakSystem(speech, locale: locale)
        }
      })
    } else {
      speakSystem(speech, locale: locale)
    }
    if session.settings.vibration { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
  }

  private func speakSystem(_ speech: String, locale: String) {
    let guiding = mapView.navigator?.isGuidanceActive == true
    let utterance = AVSpeechUtterance(string: speech)
    utterance.voice = AVSpeechSynthesisVoice(language: locale)
    speaker.speak(utterance)
    if voiceCheck { VoiceCheckLog.line("spoken guiding=\(guiding) \(speech)") }
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    restoreNavigationVoice()
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    restoreNavigationVoice()
  }

  private func restoreNavigationVoice() {
    let guiding = mapView.navigator?.isGuidanceActive == true
    guard guiding, session.settings.voice else {
      if voiceCheck { VoiceCheckLog.line("restore-skipped guiding=\(guiding) voice=\(session.settings.voice)") }
      return
    }
    let before = String(describing: mapView.navigator?.voiceGuidance)
    mapView.navigator?.voiceGuidance = .alertsAndGuidance
    if voiceCheck { VoiceCheckLog.line("google-restored from=\(before) to=alertsAndGuidance") }
  }

  func navigatorDidChangeRoute(_ navigator: GMSNavigator) {
    if navigator.isGuidanceActive {
      let meters = Int(navigator.distanceToNextDestination.rounded())
      let minutes = max(1, Int((navigator.timeToNextDestination / 60).rounded()))
      rememberRoute(meters: meters, minutes: minutes)
      statusLabel.text = "Маршрут обновлён"
      refreshDriveChrome()
    }
  }

  func mapView(_ mapView: GMSMapView, didTapAt coordinate: CLLocationCoordinate2D) {
    placeMapPoint(coordinate, title: "Точка на карте")
  }

  func mapView(_ mapView: GMSMapView, didTapPOIWithPlaceID placeID: String, name: String, location: CLLocationCoordinate2D) {
    placeMapPoint(location, title: name.isEmpty ? "Точка на карте" : name)
  }

  func mapView(_ mapView: GMSMapView, didTap marker: GMSMarker) -> Bool {
    mapView.selectedMarker = nil
    placeMapPoint(marker.position, title: "Точка на карте")
    return true
  }

  private func placeMapPoint(_ coordinate: CLLocationCoordinate2D, title: String) {
    guard mapView.navigator?.isGuidanceActive != true else { return }
    mapView.selectedMarker = nil
    mapView.cameraMode = .free
    setDestination(coordinate: coordinate, title: title)
    buildRoute()
  }

  @objc private func closeDrive() {
    searchField.resignFirstResponder()
    suggestions = []
    resultsTable.reloadData()
    resultsHeight?.constant = 0
    let guiding = mapView.navigator?.isGuidanceActive == true
    let hasTrip = guiding || routeReady || destination != nil || searchField.text?.isEmpty == false
    if hasTrip {
      stopGuidance()
      searchField.text = ""
      statusLabel.text = "Маршрут закрыт"
      return
    }
    if let navigationController, navigationController.viewControllers.count > 1 {
      navigationController.popViewController(animated: true)
      return
    }
    NotificationCenter.default.post(name: .camalertShowTab, object: "home")
  }

  @objc private func routeRequested(_ note: Notification) {
    let info = note.userInfo ?? [:]
    let latitude = (info["lat"] as? NSNumber)?.doubleValue ?? info["lat"] as? Double
    let longitude = (info["lng"] as? NSNumber)?.doubleValue ?? info["lng"] as? Double
    guard let latitude, let longitude else { return }
    let title = (info["title"] as? String)?.isEmpty == false ? (info["title"] as? String ?? "Адрес") : "Адрес"
    searchField.text = title
    suggestions = []
    resultsTable.reloadData()
    resultsHeight?.constant = 0
    setDestination(coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude), title: title)
    buildRoute()
  }

  @objc private func queryChanged() {
    searchTimer?.invalidate()
    let query = searchField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    searchTicket += 1
    let ticket = searchTicket
    if let point = PlacesClient.coordinate(in: query) {
      suggestions = [PlacesClient.Suggestion(placeId: "", title: query, address: "", latitude: point.latitude, longitude: point.longitude)]
      showSuggestions()
      return
    }
    guard query.count >= 2 else {
      suggestions = []
      showSuggestions()
      return
    }
    statusLabel.text = "Ищем адрес…"
    searchTimer = Timer.scheduledTimer(withTimeInterval: 0.4, repeats: false) { [weak self] _ in
      guard let self, ticket == self.searchTicket else { return }
      PlacesClient.autocomplete(input: query, token: self.placeToken, language: self.session.settings.language) { [weak self] result in
        guard let self, ticket == self.searchTicket else { return }
        switch result {
        case .failure(let code):
          self.suggestions = []
          self.showSuggestions()
          self.statusLabel.text = code.code == "missing-key" ? "Поиск адреса сейчас недоступен" : "Не удалось найти адрес"
        case .success(let found):
          self.suggestions = found
          self.showSuggestions()
          self.statusLabel.text = found.isEmpty ? "Ничего не найдено" : "Выберите адрес"
        }
      }
    }
  }

  private func showSuggestions() {
    resultsTable.reloadData()
    resultsHeight?.constant = CGFloat(min(suggestions.count, 5) * 52)
  }

  func textFieldShouldReturn(_ textField: UITextField) -> Bool {
    if let first = suggestions.first { choose(first) }
    return true
  }

  func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { suggestions.count }
  func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = UITableViewCell(style: .subtitle, reuseIdentifier: nil)
    let item = suggestions[indexPath.row]
    cell.textLabel?.text = item.title
    cell.detailTextLabel?.text = item.address.isEmpty ? "Точка" : item.address
    cell.textLabel?.textColor = CamAlertPalette.night(session.settings) ? .white : CamAlertPalette.ink
    cell.detailTextLabel?.textColor = CamAlertPalette.muted
    cell.backgroundColor = .clear
    cell.selectionStyle = .none
    return cell
  }
  func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    choose(suggestions[indexPath.row])
  }

  private func choose(_ suggestion: PlacesClient.Suggestion) {
    searchField.text = suggestion.title
    searchField.resignFirstResponder()
    suggestions = []
    showSuggestions()
    if let latitude = suggestion.latitude, let longitude = suggestion.longitude {
      setDestination(coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude), title: suggestion.title)
      buildRoute()
      return
    }
    statusLabel.text = "Ищем адрес…"
    let token = placeToken
    PlacesClient.location(placeId: suggestion.placeId, token: token) { [weak self] result in
      guard let self else { return }
      self.placeToken = UUID().uuidString
      switch result {
      case .failure:
        self.statusLabel.text = "Не удалось найти адрес"
      case .success(let point):
        self.setDestination(coordinate: CLLocationCoordinate2D(latitude: point.0, longitude: point.1), title: suggestion.title)
        self.buildRoute()
      }
    }
  }

  private func setDestination(coordinate: CLLocationCoordinate2D, title: String) {
    guard let waypoint = GMSNavigationWaypoint(location: coordinate, title: title) else {
      statusLabel.text = "Точку не удалось принять"
      return
    }
    destination = waypoint
    routeReady = false
    startButton.isEnabled = false
    destinationMarker?.map = nil
    let marker = GMSMarker(position: coordinate)
    marker.title = title
    marker.isTappable = false
    marker.map = mapView
    mapView.selectedMarker = nil
    destinationMarker = marker
    if searchField.text?.isEmpty != false { searchField.text = title }
  }

  @objc private func buildRoute() {
    guard GMSNavigationServices.areTermsAndConditionsAccepted() else {
      statusLabel.text = "Примите условия Google"
      refreshDriveChrome()
      showTerms()
      return
    }
    guard let navigator = mapView.navigator else {
      statusLabel.text = "Навигатор ещё не готов"
      refreshDriveChrome()
      showTerms()
      return
    }
    guard let destination else {
      statusLabel.text = "Введите адрес или нажмите на карту"
      refreshDriveChrome()
      return
    }
    routeReady = false
    startButton.isEnabled = false
    statusLabel.text = "Строим маршрут"
    refreshDriveChrome()
    mapView.travelMode = .driving
    mapView.cameraMode = .free
    routeTicket += 1
    let ticket = routeTicket
    let options = GMSNavigationMutableRoutingOptions(routingStrategy: .defaultBest)
    if !PremiumStore.shared.featuresOpen {
      options.alternateRoutesStrategy = .none
    }
    navigator.setDestinations([destination], routingOptions: options) { [weak self] routeStatus in
      guard let self, self.routeTicket == ticket else { return }
      guard routeStatus == .OK else {
        self.statusLabel.text = self.routeFailure(routeStatus)
        self.refreshDriveChrome()
        return
      }
      self.routeReady = true
      self.startButton.isEnabled = true
      self.mapView.selectedMarker = nil
      self.mapView.cameraMode = .overview
      let meters = Int(navigator.distanceToNextDestination.rounded())
      let minutes = max(1, Int((navigator.timeToNextDestination / 60).rounded()))
      self.rememberRoute(meters: meters, minutes: minutes)
      self.statusLabel.text = "Маршрут готов"
      self.refreshDriveChrome()
      DispatchQueue.main.async {
        guard self.routeTicket == ticket else { return }
        self.mapView.cameraMode = .free
        self.mapView.selectedMarker = nil
      }
    }
  }

  private func routeFailure(_ status: GMSRouteStatus) -> String {
    switch status {
    case .noRouteFound:
      return "Маршрут не найден"
    case .networkError:
      return "Нет сети для маршрута"
    case .quotaExceeded:
      return "Лимит Google исчерпан"
    case .apiKeyNotAuthorized:
      return "Ключ не разрешает маршруты"
    case .locationUnavailable:
      return "Нет геолокации"
    case .waypointError:
      return "Точка маршрута не принята"
    default:
      return "Маршрут не построен: \(status.rawValue)"
    }
  }

  @objc private func startGuidance() {
    guard routeReady, let navigator = mapView.navigator else {
      statusLabel.text = "Сначала постройте маршрут"
      return
    }
    let open = PremiumStore.shared.featuresOpen
    if open { PremiumStore.shared.beginTripIfOpen() }
    mapView.settings.isNavigationHeaderEnabled = true
    navigator.voiceGuidance = open ? .alertsAndGuidance : .silent
    navigator.isGuidanceActive = true
    navigator.add(self)
    locationManager.allowsBackgroundLocationUpdates = open
    if !open { PremiumOffer.present(from: self) }
    mapView.cameraMode = .following
    stopButton.isEnabled = true
    statusLabel.text = "Навигация начата"
    refreshDriveChrome()
  }

  @objc private func stopGuidance() {
    if let navigator = mapView.navigator {
      navigator.isGuidanceActive = false
      navigator.clearDestinations()
    }
    routeReady = false
    destination = nil
    startButton.isEnabled = false
    stopButton.isEnabled = false
    destinationMarker?.map = nil
    destinationMarker = nil
    mapView.selectedMarker = nil
    mapView.settings.isNavigationHeaderEnabled = false
    mapView.cameraMode = .free
    statusLabel.text = "Навигация завершена"
    routeMeters = 0
    routeMinutes = 0
    locationManager.allowsBackgroundLocationUpdates = false
    PremiumStore.shared.endTrip()
    refreshDriveChrome()
  }

  private func runVoiceCheck() {
    voiceCheck = true
    locationManager.stopUpdatingLocation()
    VoiceCheckLog.reset()
    VoiceCheckLog.line("begin country=\(session.settings.country) language=\(session.settings.language) voice=\(session.settings.voice) warnings=\(session.settings.cameraWarnings) clips=\(UkrainianVoice.bundledCount)")
    let course = 219.8
    let speed = 50.0 / 3.6
    let samples = [
      (50.47127575, 30.63059104, "kyiv-a-550"),
      (50.47023983, 30.62923344, "kyiv-a-400-repeat"),
      (50.46920389, 30.62787591, "kyiv-a-250-closer"),
      (50.45906467, 30.61459525, "kyiv-b-500"),
    ]
    feed(samples, course: course, speed: speed, index: 0) { [weak self] in
      self?.beginGuidedVoiceCheck(course: course, speed: speed)
    }
  }

  private func feed(_ samples: [(Double, Double, String)], course: Double, speed: Double, index: Int, done: @escaping () -> Void) {
    guard index < samples.count else {
      done()
      return
    }
    let sample = samples[index]
    locationManager.stopUpdatingLocation()
    VoiceCheckLog.line("fix \(sample.2)")
    voiceCheckInjecting = true
    let location = CLLocation(
      coordinate: CLLocationCoordinate2D(latitude: sample.0, longitude: sample.1),
      altitude: 180,
      horizontalAccuracy: 5,
      verticalAccuracy: 5,
      course: course,
      courseAccuracy: 5,
      speed: speed,
      speedAccuracy: 1,
      timestamp: Date()
    )
    locationManager(locationManager, didUpdateLocations: [location])
    voiceCheckInjecting = false
    DispatchQueue.main.asyncAfter(deadline: .now() + 5.2) { [weak self] in
      self?.feed(samples, course: course, speed: speed, index: index + 1, done: done)
    }
  }

  private func beginGuidedVoiceCheck(course: Double, speed: Double) {
    let away = CLLocation(
      coordinate: CLLocationCoordinate2D(latitude: 50.60, longitude: 30.80),
      altitude: 180, horizontalAccuracy: 5, verticalAccuracy: 5,
      course: 0, courseAccuracy: 5, speed: speed, speedAccuracy: 1, timestamp: Date()
    )
    voiceCheckInjecting = true
    locationManager(locationManager, didUpdateLocations: [away])
    voiceCheckInjecting = false
    locationManager.startUpdatingLocation()
    VoiceCheckLog.line("phase2 terms=\(GMSNavigationServices.areTermsAndConditionsAccepted())")
    waitForNavigator(attempt: 0, course: course, speed: speed)
  }

  private func waitForNavigator(attempt: Int, course: Double, speed: Double) {
    if GMSNavigationServices.areTermsAndConditionsAccepted(), mapView.navigator != nil {
      setDestination(coordinate: CLLocationCoordinate2D(latitude: 50.45284886, longitude: 30.60645275), title: "Проверка камер")
      buildRoute()
      waitForRoute(attempt: 0, course: course, speed: speed)
      return
    }
    if attempt >= 20 {
      VoiceCheckLog.line("phase2-skipped navigator-not-ready")
      VoiceCheckLog.line("done")
      return
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
      self?.waitForNavigator(attempt: attempt + 1, course: course, speed: speed)
    }
  }

  private func waitForRoute(attempt: Int, course: Double, speed: Double) {
    if routeReady {
      VoiceCheckLog.line("guidance-starting")
      startGuidance()
      let active = mapView.navigator?.isGuidanceActive == true
      VoiceCheckLog.line("guidance-active=\(active) mode=\(String(describing: mapView.navigator?.voiceGuidance))")
      DispatchQueue.main.asyncAfter(deadline: .now() + 5.2) { [weak self] in
        guard let self else { return }
        self.feed([(50.47127575, 30.63059104, "guided-kyiv-a-550")], course: course, speed: speed, index: 0) {
          DispatchQueue.main.asyncAfter(deadline: .now() + 8) {
            VoiceCheckLog.line("done")
          }
        }
      }
      return
    }
    if attempt >= 25 {
      VoiceCheckLog.line("phase2-skipped route-not-ready \(statusLabel.text ?? "")")
      VoiceCheckLog.line("done")
      return
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
      self?.waitForRoute(attempt: attempt + 1, course: course, speed: speed)
    }
  }
}

private final class TouchPassView: UIView {
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    let hit = super.hitTest(point, with: event)
    return hit === self ? nil : hit
  }
}

private enum VoiceCheckLog {
  static func reset() {
    guard let url = fileURL() else { return }
    try? "".write(to: url, atomically: true, encoding: .utf8)
  }

  static func line(_ text: String) {
    let row = "VOICECHECK \(text)\n"
    NSLog("%@", row.trimmingCharacters(in: .newlines))
    guard let url = fileURL(), let data = row.data(using: .utf8) else { return }
    if FileManager.default.fileExists(atPath: url.path) {
      if let handle = try? FileHandle(forWritingTo: url) {
        handle.seekToEndOfFile()
        handle.write(data)
        try? handle.close()
      }
    } else {
      try? data.write(to: url)
    }
  }

  private static func fileURL() -> URL? {
    FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?.appendingPathComponent("voice-check.log")
  }
}

final class VoiceRestartController: UIViewController {
  private let language: String

  init(language: String) {
    self.language = language
    super.init(nibName: nil, bundle: nil)
    modalPresentationStyle = .overFullScreen
  }

  required init?(coder: NSCoder) { nil }

  override func viewDidLoad() {
    super.viewDidLoad()
    let night = CamAlertPalette.night(CamAlertSession.shared.settings)
    let copy = CamAlertPhrases.voiceRestart(language)
    view.backgroundColor = UIColor(white: 0, alpha: 0.45)
    let card = UIView()
    card.backgroundColor = night ? UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 1) : .white
    card.layer.cornerRadius = 22
    card.translatesAutoresizingMaskIntoConstraints = false
    let title = UILabel()
    title.text = copy.title
    title.font = .camalert(22, weight: .heavy)
    title.textColor = night ? .white : CamAlertPalette.ink
    title.numberOfLines = 2
    let message = UILabel()
    message.text = copy.message
    message.font = .camalert(16)
    message.textColor = night ? CamAlertPalette.mutedNight : UIColor(red: 67 / 255, green: 93 / 255, blue: 120 / 255, alpha: 1)
    message.numberOfLines = 0
    let button = UIButton(type: .system)
    button.setTitle(copy.button, for: .normal)
    button.setTitleColor(.white, for: .normal)
    button.titleLabel?.font = .camalert(17, weight: .heavy)
    button.backgroundColor = CamAlertPalette.blue
    button.layer.cornerRadius = 16
    button.addAction(UIAction { [weak self] _ in self?.dismiss(animated: true) }, for: .touchUpInside)
    let stack = UIStackView(arrangedSubviews: [title, message, button])
    stack.axis = .vertical
    stack.spacing = 14
    stack.translatesAutoresizingMaskIntoConstraints = false
    card.addSubview(stack)
    view.addSubview(card)
    NSLayoutConstraint.activate([
      card.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 22),
      card.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -22),
      card.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 22),
      stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
      stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
      stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -20),
      button.heightAnchor.constraint(equalToConstant: 52),
    ])
  }
}
