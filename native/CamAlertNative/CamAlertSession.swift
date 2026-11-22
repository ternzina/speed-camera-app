import Foundation

final class CamAlertSession {
  static let shared = CamAlertSession()
  let catalog = CameraCatalog()
  var settings = AlertSettings()
  var reliableCourse: CourseMemory?
  var ukraineLast: (id: String?, distance: Int) = (nil, Int.max)
  var idleSpokenId: String?
  var idleLatch: String?
  var activeSectionId: String?
  private var sectionPace: SectionPace?
  private var lastSectionKey: String?
  private var saidSectionOver = false

  private let defaults = UserDefaults.standard

  private init() {
    if let language = defaults.string(forKey: "camalert.language") { settings.language = language }
    if let country = defaults.string(forKey: "camalert.country") { settings.country = country }
    if defaults.object(forKey: "camalert.voice") != nil { settings.voice = defaults.bool(forKey: "camalert.voice") }
    if defaults.object(forKey: "camalert.vibration") != nil { settings.vibration = defaults.bool(forKey: "camalert.vibration") }
    if defaults.object(forKey: "camalert.warnings") != nil { settings.cameraWarnings = defaults.bool(forKey: "camalert.warnings") }
    if defaults.object(forKey: "camalert.smart") != nil { settings.smartDistance = defaults.bool(forKey: "camalert.smart") }
    if let theme = defaults.string(forKey: "camalert.theme") { settings.driveTheme = theme }
    if defaults.object(forKey: "camalert.city") != nil { settings.cityDistance = defaults.double(forKey: "camalert.city") }
    if defaults.object(forKey: "camalert.road") != nil { settings.roadDistance = defaults.double(forKey: "camalert.road") }
    if defaults.object(forKey: "camalert.highway") != nil { settings.highwayDistance = defaults.double(forKey: "camalert.highway") }
    if defaults.object(forKey: "camalert.fast") != nil { settings.fastDistance = defaults.double(forKey: "camalert.fast") }
    catalog.loadBundled()
  }

  func save() {
    defaults.set(settings.language, forKey: "camalert.language")
    defaults.set(settings.country, forKey: "camalert.country")
    defaults.set(settings.voice, forKey: "camalert.voice")
    defaults.set(settings.vibration, forKey: "camalert.vibration")
    defaults.set(settings.cameraWarnings, forKey: "camalert.warnings")
    defaults.set(settings.smartDistance, forKey: "camalert.smart")
    defaults.set(settings.driveTheme, forKey: "camalert.theme")
    defaults.set(settings.cityDistance, forKey: "camalert.city")
    defaults.set(settings.roadDistance, forKey: "camalert.road")
    defaults.set(settings.highwayDistance, forKey: "camalert.highway")
    defaults.set(settings.fastDistance, forKey: "camalert.fast")
  }

  func evaluate(latitude: Double, longitude: Double, speedKmh: Double, heading: Double?) -> WarningDecision? {
    guard CameraSurfaces.enabled(settings) else { return nil }
    let code = settings.country.uppercased()
    let cameras = catalog.nearby(code, latitude: latitude, longitude: longitude, radius: 5000)
    reliableCourse = CamAlertWarnings.rememberReliableCourse(reliableCourse, speedKmh: speedKmh, heading: heading, latitude: latitude, longitude: longitude)
    if speedKmh < 8 {
      let idle = CamAlertWarnings.idleDecision(speedKmh: speedKmh, latitude: latitude, longitude: longitude, reliable: reliableCourse, cameras: cameras, idleSpokenId: idleSpokenId)
      if idle.speak { idleSpokenId = idle.cameraId; idleLatch = idle.cameraId }
      return idle
    }
    let ahead: AheadCamera?
    if code == "PL" {
      ahead = PolandEngine.nearest(cameras: cameras, latitude: latitude, longitude: longitude, heading: heading)
    } else {
      let threshold = CamAlertWarnings.warningDistance(speedKmh: speedKmh, settings: settings)
      ahead = CamAlertWarnings.nearestAhead(cameras, latitude: latitude, longitude: longitude, movementHeading: heading, maxDistance: threshold)
    }
    let threshold = CamAlertWarnings.warningDistance(speedKmh: speedKmh, settings: settings)
    var decision = CamAlertWarnings.ukraineFix(
      speedKmh: speedKmh,
      heading: heading,
      ahead: ahead,
      threshold: threshold,
      last: ukraineLast.id.map { ($0, ukraineLast.distance) }
    )
    idleLatch = CamAlertWarnings.settleIdleLatch(idleLatch, moving: true, aheadId: ahead?.camera.id, aheadDistance: ahead?.distance, threshold: threshold)
    decision = CamAlertWarnings.holdMovingSpeech(decision, latchId: idleLatch)
    ukraineLast = CamAlertWarnings.settleUkraineLast(ukraineLast, decision: decision)
    return decision
  }

  func sectionNotice(latitude: Double, longitude: Double, heading: Double?, now: Date = Date()) -> SectionNotice? {
    let sections = catalog.sections(for: settings.country.uppercased())
    guard let heading, let event = PolandEngine.detectSection(sections, latitude: latitude, longitude: longitude, heading: heading, activeId: activeSectionId) else {
      if activeSectionId == nil { lastSectionKey = nil }
      return nil
    }
    let point = MapPoint(latitude: latitude, longitude: longitude)
    let same = activeSectionId == event.section.id
    if event.state == "entering" || event.state == "inside" {
      if !same {
        activeSectionId = event.section.id
        sectionPace = nil
        saidSectionOver = false
      }
    }
    if event.state == "entering" || event.state == "inside" || event.state == "ending" {
      sectionPace = SectionPace.advance(sectionPace, point: point, now: now)
    } else {
      sectionPace = nil
    }
    if event.state == "ending" { activeSectionId = nil }
    var phrases: [String] = []
    let key = "\(event.section.id):\(event.state)"
    if lastSectionKey != key {
      lastSectionKey = key
      let phrase = PolandEngine.sectionSpeech(state: event.state, limit: event.section.speedLimit, distance: event.distance, averageKmh: nil, language: settings.language)
      if !phrase.isEmpty { phrases.append(phrase) }
    }
    if event.state == "inside" || event.state == "entering" {
      if let average = sectionPace?.averageKmh, let limit = event.section.speedLimit, average > Int(limit) {
        if !saidSectionOver {
          saidSectionOver = true
          let over = PolandEngine.sectionSpeech(state: "over", limit: limit, distance: event.distance, averageKmh: average, language: settings.language)
          if !over.isEmpty { phrases.append(over) }
        }
      } else if sectionPace?.averageKmh != nil {
        saidSectionOver = false
      }
    }
    guard let speech = phrases.first else { return nil }
    let locale: String
    switch settings.language {
    case "pl": locale = "pl-PL"
    case "uk": locale = "uk-UA"
    case "en": locale = "en-US"
    default: locale = "ru-RU"
    }
    return SectionNotice(speech: phrases.joined(separator: " "), title: speech, locale: locale)
  }
}

struct SectionNotice: Equatable {
  var speech: String
  var title: String
  var locale: String
}

struct SectionPace: Equatable {
  var distance: Double
  var startedAt: Date
  var last: MapPoint
  var averageKmh: Int?

  static func advance(_ pace: SectionPace?, point: MapPoint, now: Date) -> SectionPace {
    guard let pace else { return SectionPace(distance: 0, startedAt: now, last: point, averageKmh: nil) }
    let step = CamAlertGeo.distanceMeters(pace.last.latitude, pace.last.longitude, point.latitude, point.longitude)
    let distance = pace.distance + (step >= 0 && step <= 300 ? step : 0)
    let elapsed = now.timeIntervalSince(pace.startedAt)
    let average = elapsed >= 5 && distance >= 20 ? Int((distance / elapsed * 3.6).rounded()) : nil
    return SectionPace(distance: distance, startedAt: pace.startedAt, last: point, averageKmh: average)
  }
}
