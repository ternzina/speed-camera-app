import Foundation

enum CamAlertGeo {
  static let earthRadius = 6_371_000.0
  static let idleWarningDistance = 150.0
  static let idleCone = 30.0
  static let idleCrossTrack = 25.0
  static let idleCourseDrift = 40.0
  static let forwardAngle = 45.0

  static func toRad(_ value: Double) -> Double { value * .pi / 180 }
  static func norm(_ value: Double) -> Double {
    let signed = value.truncatingRemainder(dividingBy: 360)
    return (signed + 360).truncatingRemainder(dividingBy: 360)
  }

  static func distanceMeters(_ lat1: Double, _ lon1: Double, _ lat2: Double, _ lon2: Double) -> Double {
    let dLat = toRad(lat2 - lat1)
    let dLon = toRad(lon2 - lon1)
    let a = pow(sin(dLat / 2), 2) + cos(toRad(lat1)) * cos(toRad(lat2)) * pow(sin(dLon / 2), 2)
    return 2 * earthRadius * atan2(sqrt(a), sqrt(1 - a))
  }

  static func bearingDegrees(_ lat1: Double, _ lon1: Double, _ lat2: Double, _ lon2: Double) -> Double {
    let y = sin(toRad(lon2 - lon1)) * cos(toRad(lat2))
    let x = cos(toRad(lat1)) * sin(toRad(lat2)) - sin(toRad(lat1)) * cos(toRad(lat2)) * cos(toRad(lon2 - lon1))
    return norm(atan2(y, x) * 180 / .pi)
  }

  static func angleDiff(_ a: Double, _ b: Double) -> Double {
    let delta = abs(norm(a) - norm(b))
    return delta > 180 ? 360 - delta : delta
  }

  static func numericDirection(_ value: String?) -> Double? {
    guard let value, value.range(of: #"^\d+(\.\d+)?$"#, options: .regularExpression) != nil else { return nil }
    return Double(value)
  }
}

struct MapPoint: Equatable {
  var latitude: Double
  var longitude: Double
}

struct CameraRecord: Equatable {
  var id: String
  var latitude: Double
  var longitude: Double
  var speedLimit: Double?
  var direction: String?
  var type: String?
  var name: String?
  var location: String?
  var start: MapPoint?
  var end: MapPoint?
  var lengthKm: Double?
}

struct AheadCamera: Equatable {
  var camera: CameraRecord
  var distance: Int
  var angle: Int
}

struct CourseMemory: Equatable {
  var heading: Double
  var latitude: Double
  var longitude: Double
}

struct WarningDecision: Equatable {
  var speak: Bool
  var reason: String
  var distance: Int?
  var limit: Double?
  var cameraId: String?
  var angle: Int?
}

enum CamAlertWarnings {
  static func nearestAhead(
    _ cameras: [CameraRecord],
    latitude: Double,
    longitude: Double,
    movementHeading: Double?,
    maxDistance: Double = 5000,
    forwardAngle: Double = CamAlertGeo.forwardAngle,
    crossTrackMax: Double = .infinity
  ) -> AheadCamera? {
    guard let movementHeading else { return nil }
    var best: CameraRecord?
    var bestDistance = Double.infinity
    var bestAngle = 0
    for camera in cameras {
      let distance = CamAlertGeo.distanceMeters(latitude, longitude, camera.latitude, camera.longitude)
      if distance > maxDistance { continue }
      if let facing = CamAlertGeo.numericDirection(camera.direction),
         CamAlertGeo.angleDiff(movementHeading, facing) > 60 { continue }
      let bearing = CamAlertGeo.bearingDegrees(latitude, longitude, camera.latitude, camera.longitude)
      let angle = CamAlertGeo.angleDiff(movementHeading, bearing)
      let lateral = distance * sin(CamAlertGeo.toRad(angle))
      if lateral > crossTrackMax { continue }
      if angle <= forwardAngle && distance < bestDistance {
        bestDistance = distance
        bestAngle = Int(angle.rounded())
        best = camera
      }
    }
    guard let best else { return nil }
    return AheadCamera(camera: best, distance: Int(bestDistance.rounded()), angle: bestAngle)
  }

  static func warningDistance(speedKmh: Double, settings: AlertSettings) -> Double {
    guard settings.smartDistance else { return settings.roadDistance }
    if speedKmh < 60 { return settings.cityDistance }
    if speedKmh < 90 { return settings.roadDistance }
    if speedKmh < 120 { return settings.highwayDistance }
    return settings.fastDistance
  }

  static func rememberReliableCourse(_ previous: CourseMemory?, speedKmh: Double, heading: Double?, latitude: Double, longitude: Double, minSpeed: Double = 8) -> CourseMemory? {
    guard speedKmh >= minSpeed, let heading, heading.isFinite, latitude.isFinite, longitude.isFinite else { return previous }
    return CourseMemory(heading: CamAlertGeo.norm(heading), latitude: latitude, longitude: longitude)
  }

  static func idleDecision(
    speedKmh: Double,
    latitude: Double,
    longitude: Double,
    reliable: CourseMemory?,
    cameras: [CameraRecord],
    idleSpokenId: String? = nil
  ) -> WarningDecision {
    if speedKmh >= 8 {
      return WarningDecision(speak: false, reason: "moving", distance: nil, limit: nil, cameraId: nil, angle: nil)
    }
    guard let reliable, latitude.isFinite, longitude.isFinite else {
      return WarningDecision(speak: false, reason: "no-course", distance: nil, limit: nil, cameraId: nil, angle: nil)
    }
    if CamAlertGeo.distanceMeters(latitude, longitude, reliable.latitude, reliable.longitude) > CamAlertGeo.idleCourseDrift {
      return WarningDecision(speak: false, reason: "course-stale", distance: nil, limit: nil, cameraId: nil, angle: nil)
    }
    guard let camera = nearestAhead(cameras, latitude: latitude, longitude: longitude, movementHeading: reliable.heading, maxDistance: CamAlertGeo.idleWarningDistance, forwardAngle: CamAlertGeo.idleCone, crossTrackMax: CamAlertGeo.idleCrossTrack) else {
      return WarningDecision(speak: false, reason: "none-ahead", distance: nil, limit: nil, cameraId: nil, angle: nil)
    }
    let same = idleSpokenId != nil && idleSpokenId == camera.camera.id
    return WarningDecision(speak: !same, reason: same ? "idle-repeat" : "idle-warn", distance: camera.distance, limit: camera.camera.speedLimit, cameraId: camera.camera.id, angle: camera.angle)
  }

  static func settleIdleLatch(_ latchId: String?, moving: Bool, aheadId: String?, aheadDistance: Int?, threshold: Double) -> String? {
    guard let latchId else { return nil }
    if !moving { return latchId }
    let same = aheadId != nil && aheadId == latchId
    if same, let aheadDistance, Double(aheadDistance) <= threshold { return latchId }
    return nil
  }

  static func holdMovingSpeech(_ decision: WarningDecision, latchId: String?) -> WarningDecision {
    guard decision.speak, let latchId, decision.cameraId == latchId else { return decision }
    var held = decision
    held.speak = false
    held.reason = "idle-already"
    return held
  }

  static func ukraineFix(speedKmh: Double, heading: Double?, ahead: AheadCamera?, threshold: Double, last: (id: String, distance: Int)?, minSpeed: Double = 8) -> WarningDecision {
    let fields = WarningDecision(
      speak: false,
      reason: "",
      distance: ahead?.distance,
      limit: ahead?.camera.speedLimit,
      cameraId: ahead?.camera.id,
      angle: ahead?.angle
    )
    guard speedKmh >= minSpeed, let heading, heading.isFinite else {
      var decision = fields
      decision.reason = "below-speed"
      return decision
    }
    guard let ahead else {
      return WarningDecision(speak: false, reason: "none-ahead", distance: nil, limit: nil, cameraId: nil, angle: nil)
    }
    if Double(ahead.distance) > threshold {
      var decision = fields
      decision.reason = "distance"
      return decision
    }
    if let last, last.id == ahead.camera.id, last.distance - ahead.distance < 250 {
      var decision = fields
      decision.reason = "repeat"
      return decision
    }
    var decision = fields
    decision.speak = true
    decision.reason = "warn"
    return decision
  }

  static func settleUkraineLast(_ last: (id: String?, distance: Int), decision: WarningDecision) -> (id: String?, distance: Int) {
    let current = last.id == nil ? (id: String?.none, distance: Int.max) : last
    if decision.speak { return (decision.cameraId, decision.distance ?? Int.max) }
    if decision.reason == "none-ahead" { return (nil, Int.max) }
    if decision.reason == "distance", let id = current.id, id == decision.cameraId { return (nil, Int.max) }
    return current
  }
}

struct AlertSettings: Equatable {
  var language = "ru"
  var country = "UA"
  var voice = true
  var vibration = true
  var cameraWarnings = true
  var smartDistance = true
  var cityDistance = 600.0
  var roadDistance = 900.0
  var highwayDistance = 1200.0
  var fastDistance = 1500.0
  var nightDrive = false
  var driveTheme = "day"
}

enum CameraSurfaces {
  static func enabled(_ settings: AlertSettings) -> Bool { settings.cameraWarnings }
  static func voice(_ settings: AlertSettings) -> Bool { enabled(settings) && settings.voice }
}

enum GoogleVoiceMode {
  static func audioMode(cameraSpeaking: Bool, guiding: Bool, voiceEnabled: Bool) -> String {
    if cameraSpeaking || !guiding || !voiceEnabled { return "silent" }
    return "alerts-and-guidance"
  }
}

enum CameraCopy {
  static func alert(language: String, distance: Int, limit: Double?, speedKmh: Double, speedAvailable: Bool) -> (title: String, speech: String, locale: String) {
    let meters = max(1, distance)
    let hasLimit = limit.map { $0 > 0 } ?? false
    let over = speedAvailable && hasLimit && speedKmh > (limit ?? 0)
    switch language {
    case "uk":
      let title = "Камера через \(meters) м"
      let speech = ukrainian(distance: meters, limit: limit, hasLimit: hasLimit, over: over)
      return (title, speech, "uk-UA")
    case "pl":
      let title = "Kamera za \(meters) m"
      let body = hasLimit ? (over ? "Zwolnij do \(Int(limit ?? 0)) km/h." : "Ograniczenie \(Int(limit ?? 0)) km/h.") : "Kamera przed Tobą."
      return (title, "\(title). \(body)", "pl-PL")
    case "en":
      let title = "Camera in \(meters) m"
      let body = hasLimit ? (over ? "Slow down to \(Int(limit ?? 0)) km/h." : "Speed limit \(Int(limit ?? 0)) km/h.") : "Camera ahead."
      return (title, "\(title). \(body)", "en-US")
    default:
      let title = "Камера через \(meters) м"
      let body = hasLimit ? (over ? "Снизьте скорость до \(Int(limit ?? 0)) км/ч." : "Ограничение \(Int(limit ?? 0)) км/ч.") : "Камера впереди."
      return (title, "\(title). \(body)", "ru-RU")
    }
  }

  private static func ukrainianPlural(_ value: Int, _ one: String, _ few: String, _ many: String) -> String {
    let n = abs(value)
    let mod100 = n % 100
    let mod10 = n % 10
    if mod100 >= 11 && mod100 <= 14 { return many }
    if mod10 == 1 { return one }
    if mod10 >= 2 && mod10 <= 4 { return few }
    return many
  }

  private static func ukrainian(distance: Int, limit: Double?, hasLimit: Bool, over: Bool) -> String {
    let meters = ukrainianPlural(distance, "метр", "метри", "метрів")
    let lead = "Камера через \(distance) \(meters)."
    guard hasLimit, let limit else { return "\(lead) Камера попереду." }
    let unit = ukrainianPlural(Int(limit), "кілометра", "кілометрів", "кілометрів")
    let speed = "\(Int(limit)) \(unit) на годину"
    let detail = over ? "Знизьте швидкість до \(speed)." : "Обмеження \(speed)."
    return "\(lead) \(detail)"
  }
}

enum PolandEngine {
  static func nearest(cameras: [CameraRecord], latitude: Double, longitude: Double, heading: Double?, maxDistance: Double = 5000) -> AheadCamera? {
    guard let heading else { return nil }
    var best: CameraRecord?
    var bestDistance = Double.infinity
    for camera in cameras where camera.type != "average_speed_section" {
      let distance = CamAlertGeo.distanceMeters(latitude, longitude, camera.latitude, camera.longitude)
      if distance > maxDistance { continue }
      let bearing = CamAlertGeo.bearingDegrees(latitude, longitude, camera.latitude, camera.longitude)
      if CamAlertGeo.angleDiff(heading, bearing) > 50 { continue }
      if let facing = CamAlertGeo.numericDirection(camera.direction), CamAlertGeo.angleDiff(heading, facing) > 60 { continue }
      if distance < bestDistance {
        bestDistance = distance
        best = camera
      }
    }
    guard let best else { return nil }
    return AheadCamera(camera: best, distance: Int(bestDistance.rounded()), angle: 0)
  }

  static func detectSection(_ sections: [CameraRecord], latitude: Double, longitude: Double, heading: Double?, activeId: String?) -> (state: String, section: CameraRecord, distance: Int)? {
    if let activeId, let active = sections.first(where: { $0.id == activeId }), let end = active.end {
      let distance = CamAlertGeo.distanceMeters(latitude, longitude, end.latitude, end.longitude)
      return (distance <= 180 ? "ending" : "inside", active, Int(distance.rounded()))
    }
    guard let heading else { return nil }
    var best: CameraRecord?
    var bestDistance = Double.infinity
    for section in sections {
      guard let start = section.start else { continue }
      let distance = CamAlertGeo.distanceMeters(latitude, longitude, start.latitude, start.longitude)
      if distance > 2500 { continue }
      if let facing = CamAlertGeo.numericDirection(section.direction), CamAlertGeo.angleDiff(heading, facing) > 60 { continue }
      let bearing = CamAlertGeo.bearingDegrees(latitude, longitude, start.latitude, start.longitude)
      if CamAlertGeo.angleDiff(heading, bearing) > 55 { continue }
      if distance < bestDistance {
        bestDistance = distance
        best = section
      }
    }
    guard let best else { return nil }
    return (bestDistance <= 180 ? "entering" : "approaching", best, Int(bestDistance.rounded()))
  }

  static func sectionSpeech(state: String, limit: Double?, distance: Int, averageKmh: Int?, language: String) -> String {
    let rounded = max(100, Int((Double(distance) / 100).rounded()) * 100)
    let limitText: String = {
      guard let limit else { return "" }
      switch language {
      case "pl": return " Ograniczenie \(Int(limit))."
      case "uk": return " Обмеження \(Int(limit))."
      case "en": return " Speed limit \(Int(limit))."
      default: return " Ограничение \(Int(limit))."
      }
    }()
    if state == "over" {
      guard let averageKmh, let limit else { return "" }
      switch language {
      case "pl": return "Średnia prędkość \(averageKmh) kilometrów na godzinę. Ograniczenie \(Int(limit))."
      case "uk": return "Середня швидкість \(averageKmh) кілометрів на годину. Обмеження \(Int(limit))."
      case "en": return "Average speed \(averageKmh) kilometers per hour. Limit \(Int(limit))."
      default: return "Средняя скорость \(averageKmh) километров в час. Ограничение \(Int(limit))."
      }
    }
    switch language {
    case "pl":
      if state == "approaching" { return "Odcinkowy pomiar prędkości za \(rounded) metrów.\(limitText)" }
      if state == "entering" { return "Rozpoczyna się odcinkowy pomiar prędkości.\(limitText)" }
      if state == "ending" { return "Koniec odcinkowego pomiaru prędkości." }
    case "uk":
      if state == "approaching" { return "Ділянка контролю середньої швидкості через \(rounded) метрів.\(limitText)" }
      if state == "entering" { return "Починається ділянка контролю середньої швидкості.\(limitText)" }
      if state == "ending" { return "Ділянка контролю середньої швидкості завершена." }
    case "en":
      if state == "approaching" { return "Average speed control in \(rounded) meters.\(limitText)" }
      if state == "entering" { return "Average speed control starts now.\(limitText)" }
      if state == "ending" { return "Average speed control ended." }
    default:
      if state == "approaching" { return "Участок контроля средней скорости через \(rounded) метров.\(limitText)" }
      if state == "entering" { return "Начинается участок контроля средней скорости.\(limitText)" }
      if state == "ending" { return "Участок контроля средней скорости завершён." }
    }
    return ""
  }
}

enum PremiumAccess {
  static let enforcement = true
  static let introductoryMs = 72 * 60 * 60 * 1000
  static let plans = [
    "camalert_premium_weekly",
    "camalert_premium_monthly",
    "camalert_premium_yearly",
    "camalert_premium_lifetime",
  ]

  static func allows(productId: String?, revoked: Bool, period: String?, expiresAt: Double?, now: Double) -> Bool {
    if enforcement != true { return true }
    guard let productId, plans.contains(productId), !revoked else { return false }
    if period == "lifetime" { return true }
    if let expiresAt, expiresAt > now { return true }
    return false
  }

  /// Paid features stay open during the 72-hour trial, with a real subscription,
  /// and until the trip that already started has finished.
  static func featuresOpen(productId: String?, revoked: Bool, period: String?, expiresAt: Double?, firstLaunchAt: Double, now: Double, tripCarried: Bool) -> Bool {
    if tripCarried { return true }
    if allows(productId: productId, revoked: revoked, period: period, expiresAt: expiresAt, now: now) { return true }
    return now - firstLaunchAt < Double(introductoryMs)
  }

  static func planTitle(_ productId: String?) -> String {
    switch productId {
    case "camalert_premium_weekly": return "Недельный"
    case "camalert_premium_monthly": return "Месячный"
    case "camalert_premium_yearly": return "Годовой"
    case "camalert_premium_lifetime": return "Навсегда"
    default: return ""
    }
  }

  static func trialLine(firstLaunchAt: Double, now: Double) -> String {
    let left = Double(introductoryMs) - (now - firstLaunchAt)
    if left <= 0 { return "Бесплатные 3 дня закончились." }
    let hoursLeft = left / 3_600_000
    if hoursLeft >= 24 {
      let days = max(1, Int((hoursLeft / 24).rounded(.up)))
      return "Бесплатно ещё \(days) \(count(days, one: "день", few: "дня", many: "дней")). Все функции открыты без подписки."
    }
    let hours = max(1, Int(hoursLeft.rounded(.up)))
    return "Бесплатно ещё \(hours) \(count(hours, one: "час", few: "часа", many: "часов")). Все функции открыты без подписки."
  }

  static func count(_ value: Int, one: String, few: String, many: String) -> String {
    let n = abs(value) % 100
    let digit = n % 10
    if n >= 11 && n <= 14 { return many }
    if digit == 1 { return one }
    if digit >= 2 && digit <= 4 { return few }
    return many
  }
}

/// Places API (New), the same calls as google-places.js. The legacy Places SDK
/// is not used: the app key answers the new autocomplete and nearby endpoints.
struct PlacesError: Error { var code: String }

enum PlacesClient {
  struct Suggestion {
    var placeId: String
    var title: String
    var address: String
    var latitude: Double?
    var longitude: Double?
  }

  struct NearbyPlace {
    var id: String
    var name: String
    var address: String
    var latitude: Double
    var longitude: Double
    var distance: Int
  }

  static func coordinate(in query: String) -> (latitude: Double, longitude: Double)? {
    let parts = query.split { $0 == "," || $0 == ";" }.map { $0.trimmingCharacters(in: .whitespaces) }
    guard parts.count == 2, let latitude = Double(parts[0].replacingOccurrences(of: ",", with: ".")), let longitude = Double(parts[1].replacingOccurrences(of: ",", with: ".")) else { return nil }
    guard abs(latitude) <= 90, abs(longitude) <= 180 else { return nil }
    return (latitude, longitude)
  }

  static func autocomplete(input: String, token: String, language: String, done: @escaping (Result<[Suggestion], PlacesError>) -> Void) {
    send(
      url: URL(string: "https://places.googleapis.com/v1/places:autocomplete")!,
      method: "POST",
      mask: "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text",
      body: ["input": input, "sessionToken": token, "languageCode": languageCode(language)],
      done: { result in
        switch result {
        case .failure(let code): done(.failure(code))
        case .success(let json):
          let suggestions = (json["suggestions"] as? [[String: Any]] ?? []).compactMap { item -> Suggestion? in
            guard let place = item["placePrediction"] as? [String: Any] else { return nil }
            let placeId = place["placeId"] as? String ?? ""
            let format = place["structuredFormat"] as? [String: Any]
            let main = (format?["mainText"] as? [String: Any])?["text"] as? String
            let secondary = (format?["secondaryText"] as? [String: Any])?["text"] as? String
            let full = (place["text"] as? [String: Any])?["text"] as? String
            let title = (main?.isEmpty == false ? main : full) ?? ""
            guard !placeId.isEmpty, !title.isEmpty else { return nil }
            return Suggestion(placeId: placeId, title: title, address: secondary ?? "")
          }
          done(.success(Array(suggestions.prefix(5))))
        }
      }
    )
  }

  static func location(placeId: String, token: String, done: @escaping (Result<(Double, Double), PlacesError>) -> Void) {
    var parts = URLComponents(string: "https://places.googleapis.com/v1/places/\(placeId)")!
    parts.queryItems = [URLQueryItem(name: "sessionToken", value: token)]
    guard let url = parts.url else { done(.failure(PlacesError(code: "places-failed"))); return }
    send(url: url, method: "GET", mask: "location", body: nil) { result in
      switch result {
      case .failure(let code): done(.failure(code))
      case .success(let json):
        let location = json["location"] as? [String: Any]
        guard let latitude = number(location?["latitude"]), let longitude = number(location?["longitude"]), abs(latitude) <= 90, abs(longitude) <= 180 else {
          done(.failure(PlacesError(code: "places-failed")))
          return
        }
        done(.success((latitude, longitude)))
      }
    }
  }

  static func nearby(types: [String], latitude: Double, longitude: Double, language: String, done: @escaping (Result<[NearbyPlace], PlacesError>) -> Void) {
    let body: [String: Any] = [
      "includedTypes": types,
      "maxResultCount": 10,
      "rankPreference": "DISTANCE",
      "languageCode": languageCode(language),
      "locationRestriction": [
        "circle": [
          "center": ["latitude": latitude, "longitude": longitude],
          "radius": 5000,
        ],
      ],
    ]
    send(
      url: URL(string: "https://places.googleapis.com/v1/places:searchNearby")!,
      method: "POST",
      mask: "places.id,places.displayName,places.formattedAddress,places.location",
      body: body
    ) { result in
      switch result {
      case .failure(let code): done(.failure(code))
      case .success(let json):
        let places = (json["places"] as? [[String: Any]] ?? []).compactMap { place -> NearbyPlace? in
          let name = (place["displayName"] as? [String: Any])?["text"] as? String ?? ""
          let id = place["id"] as? String ?? ""
          let point = place["location"] as? [String: Any]
          guard let placeLatitude = number(point?["latitude"]), let placeLongitude = number(point?["longitude"]), !id.isEmpty, !name.isEmpty else { return nil }
          let distance = Int(CamAlertGeo.distanceMeters(latitude, longitude, placeLatitude, placeLongitude).rounded())
          return NearbyPlace(
            id: id,
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            address: place["formattedAddress"] as? String ?? "",
            latitude: placeLatitude,
            longitude: placeLongitude,
            distance: distance
          )
        }
        done(.success(places))
      }
    }
  }

  private static func number(_ value: Any?) -> Double? {
    if let value = value as? Double { return value }
    if let value = value as? NSNumber { return value.doubleValue }
    return nil
  }

  private static func languageCode(_ language: String) -> String {
    ["uk", "en", "pl", "ru"].contains(language) ? language : "ru"
  }

  private static func send(url: URL, method: String, mask: String, body: [String: Any]?, done: @escaping (Result<[String: Any], PlacesError>) -> Void) {
    guard let key = Bundle.main.object(forInfoDictionaryKey: "CamAlertNativeAPIKey") as? String, !key.isEmpty, !key.contains("$(") else {
      done(.failure(PlacesError(code: "missing-key")))
      return
    }
    var request = URLRequest(url: url, timeoutInterval: 12)
    request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue(key, forHTTPHeaderField: "X-Goog-Api-Key")
    request.setValue(mask, forHTTPHeaderField: "X-Goog-FieldMask")
    request.setValue(Bundle.main.bundleIdentifier ?? "com.21wek.camera.native", forHTTPHeaderField: "X-Ios-Bundle-Identifier")
    if let body {
      request.httpBody = try? JSONSerialization.data(withJSONObject: body)
    }
    URLSession.shared.dataTask(with: request) { data, response, _ in
      let status = (response as? HTTPURLResponse)?.statusCode ?? 0
      guard (200..<300).contains(status), let data, let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        DispatchQueue.main.async { done(.failure(PlacesError(code: "places-failed"))) }
        return
      }
      DispatchQueue.main.async { done(.success(json)) }
    }.resume()
  }
}
