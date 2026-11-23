import Foundation
import StoreKit

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
    if !defaults.bool(forKey: "camalert.theme.dayDefault") {
      if settings.driveTheme == "auto" { settings.driveTheme = "day" }
      defaults.set(true, forKey: "camalert.theme.dayDefault")
      defaults.set(settings.driveTheme, forKey: "camalert.theme")
    }
    if defaults.object(forKey: "camalert.city") != nil { settings.cityDistance = defaults.double(forKey: "camalert.city") }
    if defaults.object(forKey: "camalert.road") != nil { settings.roadDistance = defaults.double(forKey: "camalert.road") }
    if defaults.object(forKey: "camalert.highway") != nil { settings.highwayDistance = defaults.double(forKey: "camalert.highway") }
    if defaults.object(forKey: "camalert.fast") != nil { settings.fastDistance = defaults.double(forKey: "camalert.fast") }
    catalog.loadBundled()
    PremiumStore.shared.prepare()
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

extension Notification.Name {
  static let camalertPremium = Notification.Name("camalert.premium")
}

/// Apple entitlements are the source of truth. The saved record only bridges
/// the gap until StoreKit answers again after a restart.
final class PremiumStore {
  static let shared = PremiumStore()
  private let defaults = UserDefaults.standard
  private let firstKey = "camalert.firstLaunchAt"
  private let productKey = "camalert.premium.product"
  private let revokedKey = "camalert.premium.revoked"
  private let expiresKey = "camalert.premium.expires"
  private(set) var tripCarried = false
  private var updates: Task<Void, Never>?

  private init() {}

  var firstLaunchAt: Double {
    if defaults.object(forKey: firstKey) == nil {
      defaults.set(Date().timeIntervalSince1970 * 1000, forKey: firstKey)
    }
    return defaults.double(forKey: firstKey)
  }

  var productId: String? { defaults.string(forKey: productKey) }
  var revoked: Bool { defaults.bool(forKey: revokedKey) }
  var expiresAt: Double? {
    guard defaults.object(forKey: expiresKey) != nil else { return nil }
    return defaults.double(forKey: expiresKey)
  }

  var period: String? {
    guard let productId else { return nil }
    if productId.hasSuffix("lifetime") { return "lifetime" }
    if productId.hasSuffix("weekly") { return "weekly" }
    if productId.hasSuffix("monthly") { return "monthly" }
    if productId.hasSuffix("yearly") { return "yearly" }
    return nil
  }

  var subscribed: Bool {
    PremiumAccess.allows(productId: productId, revoked: revoked, period: period, expiresAt: expiresAt, now: now)
  }

  var featuresOpen: Bool {
    PremiumAccess.featuresOpen(
      productId: productId,
      revoked: revoked,
      period: period,
      expiresAt: expiresAt,
      firstLaunchAt: firstLaunchAt,
      now: now,
      tripCarried: tripCarried
    )
  }

  func beginTripIfOpen() {
    let open = PremiumAccess.featuresOpen(
      productId: productId, revoked: revoked, period: period, expiresAt: expiresAt,
      firstLaunchAt: firstLaunchAt, now: now, tripCarried: false
    )
    if open { tripCarried = true }
  }

  func endTrip() { tripCarried = false }

  func prepare() {
    _ = firstLaunchAt
    guard updates == nil else { return }
    updates = Task { [weak self] in
      await self?.refresh()
      guard let self else { return }
      for await update in Transaction.updates {
        if case .verified = update { await self.refresh() }
      }
    }
    if ProcessInfo.processInfo.arguments.contains("--premium-check") { writeCheck() }
  }

  func refresh() async {
    var chosen: (id: String, revoked: Bool, expires: Double?)?
    for await result in Transaction.currentEntitlements {
      guard case .verified(let transaction) = result else { continue }
      guard PremiumAccess.plans.contains(transaction.productID) else { continue }
      let candidate = (
        id: transaction.productID,
        revoked: transaction.revocationDate != nil,
        expires: transaction.expirationDate.map { $0.timeIntervalSince1970 * 1000 }
      )
      if chosen == nil || prefers(candidate, over: chosen!) { chosen = candidate }
    }
    let saved = chosen
    await MainActor.run {
      if let saved {
        self.defaults.set(saved.id, forKey: self.productKey)
        self.defaults.set(saved.revoked, forKey: self.revokedKey)
        if let expires = saved.expires { self.defaults.set(expires, forKey: self.expiresKey) }
        else { self.defaults.removeObject(forKey: self.expiresKey) }
      } else {
        self.defaults.removeObject(forKey: self.productKey)
        self.defaults.set(false, forKey: self.revokedKey)
        self.defaults.removeObject(forKey: self.expiresKey)
      }
      NotificationCenter.default.post(name: .camalertPremium, object: nil)
    }
  }

  private var now: Double { Date().timeIntervalSince1970 * 1000 }

  private func prefers(_ candidate: (id: String, revoked: Bool, expires: Double?), over current: (id: String, revoked: Bool, expires: Double?)) -> Bool {
    if candidate.id.hasSuffix("lifetime") { return true }
    if current.id.hasSuffix("lifetime") { return false }
    return (candidate.expires ?? 0) > (current.expires ?? 0)
  }

  private func writeCheck() {
    let start = 1_700_000_000_000.0
    let trial = Double(PremiumAccess.introductoryMs)
    let hour = 60.0 * 60 * 1000
    func line(_ name: String, _ value: Bool) -> String { "PREMIUMCHECK \(name)=\(value)" }
    let rows = [
      line("allows-nil", PremiumAccess.allows(productId: nil, revoked: false, period: nil, expiresAt: nil, now: start)),
      line("trial-open", PremiumAccess.featuresOpen(productId: nil, revoked: false, period: nil, expiresAt: nil, firstLaunchAt: start, now: start + hour, tripCarried: false)),
      line("trial-closed", PremiumAccess.featuresOpen(productId: nil, revoked: false, period: nil, expiresAt: nil, firstLaunchAt: start, now: start + trial + hour, tripCarried: false)),
      line("sub-open", PremiumAccess.featuresOpen(productId: "camalert_premium_monthly", revoked: false, period: "monthly", expiresAt: start + 10 * hour, firstLaunchAt: start - trial, now: start, tripCarried: false)),
      line("sub-expired", PremiumAccess.featuresOpen(productId: "camalert_premium_monthly", revoked: false, period: "monthly", expiresAt: start - hour, firstLaunchAt: start - trial, now: start, tripCarried: false)),
      line("lifetime", PremiumAccess.featuresOpen(productId: "camalert_premium_lifetime", revoked: false, period: "lifetime", expiresAt: nil, firstLaunchAt: start - trial, now: start, tripCarried: false)),
      line("trip-carried", PremiumAccess.featuresOpen(productId: nil, revoked: false, period: nil, expiresAt: nil, firstLaunchAt: start - trial, now: start, tripCarried: true)),
      line("revoked", PremiumAccess.allows(productId: "camalert_premium_lifetime", revoked: true, period: "lifetime", expiresAt: nil, now: start)),
    ]
    NSLog("%@", rows.joined(separator: "\n"))
    guard let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?.appendingPathComponent("premium-check.txt") else { return }
    try? rows.joined(separator: "\n").write(to: url, atomically: true, encoding: String.Encoding.utf8)
  }
}
