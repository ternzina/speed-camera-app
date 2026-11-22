import AVFoundation
import CoreLocation
import GoogleMaps
import GoogleNavigation
import GooglePlaces
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
  private let routeButton = UIButton(type: .system)
  private let startButton = UIButton(type: .system)
  private let stopButton = UIButton(type: .system)
  private let bottomBar = UIView()
  private let speedValue = UILabel()
  private var resultsHeight: NSLayoutConstraint?
  private var predictions: [GMSAutocompletePrediction] = []
  private let places = GMSPlacesClient.shared()
  private var placeToken = GMSAutocompleteSessionToken()
  private var searchTicket = 0
  private var lastLocation: CLLocation?
  private var destination: GMSNavigationWaypoint?
  private var destinationMarker: GMSMarker?
  private var routeReady = false
  var focusSearch = false
  private let session = CamAlertSession.shared
  private let speaker = AVSpeechSynthesizer()
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
    mapView.settings.consumesGesturesInView = false
    mapView.isMyLocationEnabled = true

    searchCard.translatesAutoresizingMaskIntoConstraints = false
    searchCard.backgroundColor = night ? UIColor(red: 16 / 255, green: 38 / 255, blue: 59 / 255, alpha: 0.96) : UIColor(white: 1, alpha: 0.96)
    searchCard.layer.cornerRadius = 18
    searchField.placeholder = "Куда едем?"
    searchField.font = .systemFont(ofSize: 17, weight: .semibold)
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
    statusLabel.font = .systemFont(ofSize: 14, weight: .bold)
    statusLabel.textColor = night ? .white : CamAlertPalette.ink
    statusLabel.text = "Введите адрес в поле «Куда едем?» или нажмите на карту"

    bottomBar.translatesAutoresizingMaskIntoConstraints = false
    bottomBar.backgroundColor = night ? UIColor(red: 12 / 255, green: 31 / 255, blue: 49 / 255, alpha: 0.94) : UIColor(white: 1, alpha: 0.94)
    bottomBar.layer.cornerRadius = 18
    bottomBar.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]

    configure(routeButton, title: "Построить маршрут", filled: true, action: #selector(buildRoute))
    configure(startButton, title: "В путь", filled: true, action: #selector(startGuidance))
    configure(stopButton, title: "Завершить поездку", filled: false, action: #selector(stopGuidance))
    startButton.isEnabled = false
    stopButton.isEnabled = false

    let back = UIButton(type: .system)
    back.setTitle("‹  Назад", for: .normal)
    back.setTitleColor(CamAlertPalette.blue, for: .normal)
    back.titleLabel?.font = .systemFont(ofSize: 17, weight: .bold)
    back.addTarget(self, action: #selector(closeDrive), for: .touchUpInside)
    back.translatesAutoresizingMaskIntoConstraints = false

    speedValue.font = .systemFont(ofSize: 28, weight: .black)
    speedValue.textColor = night ? .white : CamAlertPalette.ink
    speedValue.text = "0"
    speedValue.textAlignment = .center
    let speedUnit = UILabel()
    speedUnit.text = "км/ч"
    speedUnit.font = .systemFont(ofSize: 11, weight: .bold)
    speedUnit.textColor = night ? CamAlertPalette.mutedNight : CamAlertPalette.muted
    speedUnit.textAlignment = .center
    let speedStack = UIStackView(arrangedSubviews: [speedValue, speedUnit])
    speedStack.axis = .vertical
    speedStack.alignment = .center
    let speedCircle = UIView()
    speedCircle.backgroundColor = bottomBar.backgroundColor
    speedCircle.layer.cornerRadius = 40
    speedCircle.layer.borderWidth = 1.5
    speedCircle.layer.borderColor = UIColor(red: 18 / 255, green: 96 / 255, blue: 232 / 255, alpha: 0.45).cgColor
    speedCircle.translatesAutoresizingMaskIntoConstraints = false
    speedStack.translatesAutoresizingMaskIntoConstraints = false
    speedCircle.addSubview(speedStack)

    let buttons = UIStackView(arrangedSubviews: [routeButton, startButton])
    buttons.axis = .vertical
    buttons.spacing = 8
    buttons.translatesAutoresizingMaskIntoConstraints = false
    bottomBar.addSubview(statusLabel)
    bottomBar.addSubview(buttons)
    bottomBar.addSubview(stopButton)
    view.addSubview(mapView)
    view.addSubview(searchCard)
    view.addSubview(back)
    view.addSubview(speedCircle)
    view.addSubview(bottomBar)

    let guide = view.safeAreaLayoutGuide
    resultsHeight = resultsTable.heightAnchor.constraint(equalToConstant: 0)
    NSLayoutConstraint.activate([
      mapView.topAnchor.constraint(equalTo: view.topAnchor),
      mapView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      mapView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      mapView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      back.topAnchor.constraint(equalTo: guide.topAnchor, constant: 4),
      back.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 12),
      searchCard.topAnchor.constraint(equalTo: back.bottomAnchor, constant: 6),
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
      speedCircle.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 16),
      speedCircle.bottomAnchor.constraint(equalTo: bottomBar.topAnchor, constant: -10),
      speedCircle.widthAnchor.constraint(equalToConstant: 80),
      speedCircle.heightAnchor.constraint(equalToConstant: 80),
      speedStack.centerXAnchor.constraint(equalTo: speedCircle.centerXAnchor),
      speedStack.centerYAnchor.constraint(equalTo: speedCircle.centerYAnchor),
      bottomBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      bottomBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      bottomBar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      statusLabel.topAnchor.constraint(equalTo: bottomBar.topAnchor, constant: 12),
      statusLabel.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 16),
      statusLabel.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -16),
      buttons.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 8),
      buttons.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 16),
      buttons.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -16),
      routeButton.heightAnchor.constraint(equalToConstant: 48),
      startButton.heightAnchor.constraint(equalToConstant: 58),
      stopButton.topAnchor.constraint(equalTo: buttons.bottomAnchor, constant: 8),
      stopButton.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 16),
      stopButton.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -16),
      stopButton.bottomAnchor.constraint(equalTo: guide.bottomAnchor, constant: -10),
      stopButton.heightAnchor.constraint(equalToConstant: 46),
    ])

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
    if focusSearch {
      focusSearch = false
      searchField.becomeFirstResponder()
    }
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    view.bringSubviewToFront(searchCard)
    view.bringSubviewToFront(bottomBar)
    if let circle = speedValue.superview?.superview { view.bringSubviewToFront(circle) }
  }

  private func configure(_ button: UIButton, title: String, filled: Bool, action: Selector) {
    button.translatesAutoresizingMaskIntoConstraints = false
    var config = UIButton.Configuration.filled()
    config.title = title
    config.baseBackgroundColor = filled ? CamAlertPalette.blue : UIColor(red: 117 / 255, green: 34 / 255, blue: 44 / 255, alpha: 0.94)
    config.baseForegroundColor = .white
    config.cornerStyle = .large
    config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
      var outgoing = incoming
      outgoing.font = .systemFont(ofSize: filled ? 17 : 15, weight: .heavy)
      return outgoing
    }
    button.configuration = config
    button.addTarget(self, action: action, for: .touchUpInside)
  }

  private func showTerms() {
    let options = GMSNavigationTermsAndConditionsOptions(companyName: "CamAlert Native")
    GMSNavigationServices.showTermsAndConditionsDialogIfNeeded(with: options) { [weak self] accepted in
      guard let self else { return }
      guard accepted else {
        self.statusLabel.text = "Примите условия Google"
        return
      }
      self.mapView.isNavigationEnabled = true
      self.view.bringSubviewToFront(self.searchCard)
      self.view.bringSubviewToFront(self.bottomBar)
      if self.lastLocation == nil {
        self.statusLabel.text = "Ожидание геолокации"
      } else if self.destination == nil {
        self.statusLabel.text = "Введите адрес в поле «Куда едем?» или нажмите на карту"
      }
    }
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    switch manager.authorizationStatus {
    case .authorizedWhenInUse, .authorizedAlways:
      manager.startUpdatingLocation()
      mapView.isMyLocationEnabled = true
    case .denied, .restricted:
      statusLabel.text = "Геолокация запрещена"
    default:
      break
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
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

  private func considerWarning(_ location: CLLocation) {
    let speed = location.speed >= 0 ? location.speed * 3.6 : 0
    let heading = location.course >= 0 ? location.course : nil
    guard let decision = session.evaluate(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude, speedKmh: speed, heading: heading) else { return }
    guard decision.speak else { return }
    let copy = CameraCopy.alert(language: session.settings.language, distance: decision.distance ?? 0, limit: decision.limit, speedKmh: speed, speedAvailable: location.speed >= 0)
    speak(copy.speech, title: copy.title, locale: copy.locale)
  }

  private func speak(_ speech: String, title: String, locale: String) {
    guard Date().timeIntervalSince(warnedAt) > 4 else { return }
    warnedAt = Date()
    statusLabel.text = title
    var history = UserDefaults.standard.array(forKey: "camalert.history") as? [[String: String]] ?? []
    history.insert(["title": title, "when": ISO8601DateFormatter().string(from: Date())], at: 0)
    UserDefaults.standard.set(Array(history.prefix(40)), forKey: "camalert.history")
    guard CameraSurfaces.voice(session.settings), !speaker.isSpeaking else { return }
    if mapView.navigator?.isGuidanceActive == true {
      mapView.navigator?.voiceGuidance = .silent
    }
    let utterance = AVSpeechUtterance(string: speech)
    utterance.voice = AVSpeechSynthesisVoice(language: locale)
    speaker.speak(utterance)
    if session.settings.vibration { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    restoreNavigationVoice()
  }

  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    restoreNavigationVoice()
  }

  private func restoreNavigationVoice() {
    guard mapView.navigator?.isGuidanceActive == true, session.settings.voice else { return }
    mapView.navigator?.voiceGuidance = .alertsAndGuidance
  }

  func navigatorDidChangeRoute(_ navigator: GMSNavigator) {
    if navigator.isGuidanceActive { statusLabel.text = "Маршрут обновлён" }
  }

  func mapView(_ mapView: GMSMapView, didTapAt coordinate: CLLocationCoordinate2D) {
    guard mapView.navigator?.isGuidanceActive != true else { return }
    setDestination(coordinate: coordinate, title: "Точка на карте")
    buildRoute()
  }

  @objc private func closeDrive() {
    searchField.resignFirstResponder()
    navigationController?.popViewController(animated: true)
  }

  @objc private func queryChanged() {
    let query = searchField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    searchTicket += 1
    let ticket = searchTicket
    guard query.count >= 2 else {
      predictions = []
      resultsTable.reloadData()
      resultsHeight?.constant = 0
      return
    }
    places.findAutocompletePredictions(fromQuery: query, filter: nil, sessionToken: placeToken) { [weak self] results, _ in
      DispatchQueue.main.async {
        guard let self, ticket == self.searchTicket else { return }
        self.predictions = results ?? []
        self.resultsTable.reloadData()
        self.resultsHeight?.constant = CGFloat(min(self.predictions.count, 5) * 52)
      }
    }
  }

  func textFieldShouldReturn(_ textField: UITextField) -> Bool {
    if let first = predictions.first { choose(first) }
    return true
  }

  func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { predictions.count }
  func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = UITableViewCell(style: .subtitle, reuseIdentifier: nil)
    let item = predictions[indexPath.row]
    cell.textLabel?.text = item.attributedPrimaryText.string
    cell.detailTextLabel?.text = item.attributedFullText.string
    cell.textLabel?.textColor = CamAlertPalette.night(session.settings) ? .white : CamAlertPalette.ink
    cell.detailTextLabel?.textColor = CamAlertPalette.muted
    cell.backgroundColor = .clear
    cell.selectionStyle = .none
    return cell
  }
  func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    choose(predictions[indexPath.row])
  }

  private func choose(_ prediction: GMSAutocompletePrediction) {
    searchField.text = prediction.attributedPrimaryText.string
    searchField.resignFirstResponder()
    predictions = []
    resultsTable.reloadData()
    resultsHeight?.constant = 0
    statusLabel.text = "Ищем адрес"
    places.fetchPlace(fromPlaceID: prediction.placeID, placeFields: .coordinate, sessionToken: placeToken) { [weak self] place, _ in
      DispatchQueue.main.async {
        guard let self else { return }
        self.placeToken = GMSAutocompleteSessionToken()
        guard let place, CLLocationCoordinate2DIsValid(place.coordinate) else {
          self.statusLabel.text = "У адреса нет координат"
          return
        }
        let title = self.searchField.text?.isEmpty == false ? (self.searchField.text ?? "Адрес") : "Адрес"
        self.setDestination(coordinate: place.coordinate, title: title)
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
    marker.map = mapView
    destinationMarker = marker
    if searchField.text?.isEmpty != false { searchField.text = title }
  }

  @objc private func buildRoute() {
    guard GMSNavigationServices.areTermsAndConditionsAccepted() else {
      statusLabel.text = "Примите условия Google"
      showTerms()
      return
    }
    guard mapView.navigator != nil else {
      statusLabel.text = "Навигатор ещё не готов"
      return
    }
    guard lastLocation != nil else {
      statusLabel.text = "Нет геолокации"
      return
    }
    guard let destination else {
      statusLabel.text = "Нажмите на карту"
      return
    }
    routeReady = false
    startButton.isEnabled = false
    statusLabel.text = "Строим маршрут"
    mapView.navigator?.setDestinations([destination]) { [weak self] routeStatus in
      guard let self else { return }
      guard routeStatus == .OK else {
        self.statusLabel.text = self.routeFailure(routeStatus)
        return
      }
      self.routeReady = true
      self.startButton.isEnabled = true
      self.mapView.cameraMode = .overview
      self.statusLabel.text = "Маршрут готов. Нажмите «В путь»"
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
    navigator.voiceGuidance = .alertsAndGuidance
    navigator.isGuidanceActive = true
    navigator.add(self)
    locationManager.allowsBackgroundLocationUpdates = true
    mapView.cameraMode = .following
    stopButton.isEnabled = true
    statusLabel.text = "Навигация начата"
  }

  @objc private func stopGuidance() {
    guard let navigator = mapView.navigator else { return }
    navigator.isGuidanceActive = false
    navigator.clearDestinations()
    routeReady = false
    startButton.isEnabled = false
    stopButton.isEnabled = false
    destinationMarker?.map = nil
    destinationMarker = nil
    mapView.cameraMode = .following
    statusLabel.text = "Навигация завершена"
  }
}
