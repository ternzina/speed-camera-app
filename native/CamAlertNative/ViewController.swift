import AVFoundation
import CoreLocation
import GoogleMaps
import GoogleNavigation
import GooglePlaces
import UIKit

/// Same order as the working Nav Voice Probe:
/// terms, enable navigation, setDestinations, then voiceGuidance immediately before guidance.
/// Phone location only. No navigation simulator and no React Native voice experiments.
final class ViewController: UIViewController, CLLocationManagerDelegate, GMSMapViewDelegate, GMSAutocompleteViewControllerDelegate, GMSNavigatorListener, AVSpeechSynthesizerDelegate {
  private let locationManager = CLLocationManager()
  private let mapView = GMSMapView()
  private let searchButton = UIButton(type: .system)
  private let statusLabel = UILabel()
  private let routeButton = UIButton(type: .system)
  private let startButton = UIButton(type: .system)
  private let stopButton = UIButton(type: .system)
  private let bottomBar = UIView()
  private var lastLocation: CLLocation?
  private var destination: GMSNavigationWaypoint?
  private var destinationMarker: GMSMarker?
  private var routeReady = false
  var openSearchOnAppear = false
  private let session = CamAlertSession.shared
  private let speaker = AVSpeechSynthesizer()
  private var cameraMarkers: [GMSMarker] = []
  private var warnedAt = Date.distantPast

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground

    mapView.translatesAutoresizingMaskIntoConstraints = false
    mapView.delegate = self
    mapView.settings.compassButton = true
    mapView.settings.myLocationButton = true
    mapView.settings.consumesGesturesInView = false

    var searchConfig = UIButton.Configuration.filled()
    searchConfig.title = "Куда едем"
    searchConfig.baseBackgroundColor = .systemBackground
    searchConfig.baseForegroundColor = .label
    searchConfig.cornerStyle = .medium
    searchConfig.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16)
    searchButton.configuration = searchConfig
    searchButton.translatesAutoresizingMaskIntoConstraints = false
    searchButton.addTarget(self, action: #selector(searchAddress), for: .touchUpInside)

    statusLabel.translatesAutoresizingMaskIntoConstraints = false
    statusLabel.numberOfLines = 2
    statusLabel.textAlignment = .center
    statusLabel.font = .preferredFont(forTextStyle: .subheadline)
    statusLabel.textColor = .label
    statusLabel.text = "Нажмите на карту, чтобы построить маршрут"

    bottomBar.translatesAutoresizingMaskIntoConstraints = false
    bottomBar.backgroundColor = .systemBackground

    configure(routeButton, title: "Маршрут", action: #selector(buildRoute))
    configure(startButton, title: "В путь", action: #selector(startGuidance))
    configure(stopButton, title: "Завершить", action: #selector(stopGuidance))
    startButton.isEnabled = false
    stopButton.isEnabled = false

    let buttons = UIStackView(arrangedSubviews: [routeButton, startButton, stopButton])
    buttons.translatesAutoresizingMaskIntoConstraints = false
    buttons.axis = .horizontal
    buttons.spacing = 8
    buttons.distribution = .fillEqually

    bottomBar.addSubview(statusLabel)
    bottomBar.addSubview(buttons)
    view.addSubview(mapView)
    view.addSubview(searchButton)
    view.addSubview(bottomBar)

    let guide = view.safeAreaLayoutGuide
    NSLayoutConstraint.activate([
      mapView.topAnchor.constraint(equalTo: view.topAnchor),
      mapView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      mapView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      mapView.bottomAnchor.constraint(equalTo: bottomBar.topAnchor),
      searchButton.topAnchor.constraint(equalTo: guide.topAnchor, constant: 12),
      searchButton.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 16),
      searchButton.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -16),
      bottomBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      bottomBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      bottomBar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      statusLabel.topAnchor.constraint(equalTo: bottomBar.topAnchor, constant: 8),
      statusLabel.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 16),
      statusLabel.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -16),
      buttons.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 8),
      buttons.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 16),
      buttons.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -16),
      buttons.bottomAnchor.constraint(equalTo: guide.bottomAnchor, constant: -12),
      buttons.heightAnchor.constraint(equalToConstant: 48),
    ])

    locationManager.delegate = self
    locationManager.allowsBackgroundLocationUpdates = false
    locationManager.pausesLocationUpdatesAutomatically = false
    locationManager.requestWhenInUseAuthorization()
    speaker.delegate = self
    showTerms()
    Task { _ = await session.catalog.ensureCountry(session.settings.country.uppercased()) }
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    if openSearchOnAppear {
      openSearchOnAppear = false
      searchAddress()
    }
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    view.bringSubviewToFront(searchButton)
    view.bringSubviewToFront(bottomBar)
  }

  private func configure(_ button: UIButton, title: String, action: Selector) {
    button.translatesAutoresizingMaskIntoConstraints = false
    var config = UIButton.Configuration.filled()
    config.title = title
    config.baseBackgroundColor = .secondarySystemBackground
    config.baseForegroundColor = .label
    config.cornerStyle = .medium
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
      self.view.bringSubviewToFront(self.searchButton)
      self.view.bringSubviewToFront(self.bottomBar)
      if self.lastLocation == nil {
        self.statusLabel.text = "Ожидание геолокации"
      } else if self.destination == nil {
        self.statusLabel.text = "Нажмите на карту, чтобы построить маршрут"
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

  @objc private func searchAddress() {
    let autocomplete = GMSAutocompleteViewController()
    autocomplete.delegate = self
    present(autocomplete, animated: true)
  }

  func viewController(_ viewController: GMSAutocompleteViewController, didAutocompleteWith place: GMSPlace) {
    dismiss(animated: true)
    let title = place.name ?? place.formattedAddress ?? "Адрес"
    guard CLLocationCoordinate2DIsValid(place.coordinate),
          place.coordinate.latitude != 0 || place.coordinate.longitude != 0 else {
      statusLabel.text = "У адреса нет координат"
      return
    }
    setDestination(coordinate: place.coordinate, title: title)
    buildRoute()
  }

  func viewController(_ viewController: GMSAutocompleteViewController, didFailAutocompleteWithError error: Error) {
    dismiss(animated: true)
    statusLabel.text = "Поиск не удался"
  }

  func wasCancelled(_ viewController: GMSAutocompleteViewController) {
    dismiss(animated: true)
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
    searchButton.configuration?.title = title
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
