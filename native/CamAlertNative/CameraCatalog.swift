import CryptoKit
import Foundation

struct CountryListing: Equatable {
  var code: String
  var name: String
  var recordCount: Int
  var version: String?
  var path: String?
  var sizeBytes: Int?
  var checksum: String?
}

final class CameraCatalog {
  static let deliveryURL = URL(string: "https://speed-camera-data.ternzina.workers.dev")!
  private(set) var feeds: [String: [CameraRecord]] = [:]
  private(set) var sections: [String: [CameraRecord]] = [:]
  private(set) var countries: [CountryListing] = []
  private(set) var totalRecords = 0
  private(set) var publishedAt: Date?
  private(set) var checkedAt: Date?
  private var names: [String: String] = [:]
  private let queue = DispatchQueue(label: "camalert.cameras", qos: .userInitiated)
  private var grids: [String: [String: [CameraRecord]]] = [:]

  func loadBundled() {
    if let data = data(named: "country-names") {
      names = (try? JSONDecoder().decode([String: String].self, from: data)) ?? [:]
    }
    if let feed = parse(data(named: "cameras-ua"), country: "UA") {
      store(feed, code: "UA")
    }
    if let feed = parse(data(named: "cameras-pl"), country: "PL") {
      store(feed, code: "PL")
    }
    if let cached = try? Data(contentsOf: cacheURL("manifest.json")),
       let parsed = parseManifest(cached) {
      countries = parsed.listings
      totalRecords = parsed.total
      publishedAt = parsed.publishedAt
      checkedAt = (try? FileManager.default.attributesOfItem(atPath: cacheURL("manifest.json").path))?[.modificationDate] as? Date
    }
  }

  func cameras(for code: String) -> [CameraRecord] { feeds[code] ?? [] }
  func sections(for code: String) -> [CameraRecord] { sections[code] ?? [] }
  func isStored(_ code: String) -> Bool { feeds[code] != nil }
  var storedCodes: [String] { Array(feeds.keys) }

  /// Ukraine and Poland first, then every country from the delivery manifest,
  /// then any remaining name from the original country list.
  func directory() -> [CountryListing] {
    var rows: [CountryListing] = []
    var seen = Set<String>()
    func add(_ code: String, listing: CountryListing?) {
      let upper = code.uppercased()
      guard !seen.contains(upper) else { return }
      seen.insert(upper)
      if let listing {
        rows.append(listing)
        return
      }
      rows.append(CountryListing(
        code: upper,
        name: names[upper] ?? upper,
        recordCount: feeds[upper]?.count ?? 0,
        version: nil,
        path: nil,
        sizeBytes: nil,
        checksum: nil
      ))
    }
    for code in ["UA", "PL"] {
      add(code, listing: countries.first { $0.code == code })
    }
    for listing in countries { add(listing.code, listing: listing) }
    if countries.isEmpty {
      for code in names.keys.sorted() { add(code, listing: nil) }
    }
    return rows
  }

  func removeStored(_ code: String) {
    let upper = code.uppercased()
    feeds[upper] = nil
    sections[upper] = nil
    grids[upper] = nil
    UserDefaults.standard.removeObject(forKey: "camalert.feed.\(upper)")
    let root = cacheURL("manifest.json").deletingLastPathComponent()
    guard let files = try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil) else { return }
    for file in files where file.lastPathComponent.hasPrefix("\(upper)-") {
      try? FileManager.default.removeItem(at: file)
    }
  }

  func nearby(_ code: String, latitude: Double, longitude: Double, radius: Double) -> [CameraRecord] {
    let cell = 0.05
    let span = radius / 111_320
    let lat0 = Int(floor(latitude / cell))
    let lon0 = Int(floor(longitude / cell))
    let reach = Int(ceil(span / cell)) + 1
    var found: [CameraRecord] = []
    let grid = grids[code] ?? [:]
    for lat in (lat0 - reach)...(lat0 + reach) {
      for lon in (lon0 - reach)...(lon0 + reach) {
        found.append(contentsOf: grid["\(lat):\(lon)"] ?? [])
      }
    }
    return found.filter { CamAlertGeo.distanceMeters(latitude, longitude, $0.latitude, $0.longitude) <= radius }
  }

  func refreshManifest() async -> String? {
    do {
      let (data, response) = try await URLSession.shared.data(from: Self.deliveryURL.appendingPathComponent("production/v1/manifest.json"))
      guard (response as? HTTPURLResponse)?.statusCode == 200 else { return "База недоступна" }
      guard let parsed = parseManifest(data) else { return "База недоступна" }
      await MainActor.run {
        countries = parsed.listings
        totalRecords = parsed.total
        publishedAt = parsed.publishedAt
        checkedAt = Date()
      }
      try? data.write(to: cacheURL("manifest.json"), options: .atomic)
      return nil
    } catch {
      return "База недоступна"
    }
  }

  private func parseManifest(_ data: Data) -> (listings: [CountryListing], total: Int, publishedAt: Date?)? {
    guard let manifest = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let rows = manifest["countries"] as? [[String: Any]] else { return nil }
    let listings: [CountryListing] = rows.compactMap { row in
      guard let code = (row["country_code"] as? String)?.uppercased() else { return nil }
      func whole(_ key: String) -> Int {
        if let value = row[key] as? Int { return value }
        if let value = row[key] as? NSNumber { return value.intValue }
        return 0
      }
      return CountryListing(
        code: code,
        name: names[code] ?? code,
        recordCount: whole("record_count"),
        version: row["checksum"] as? String,
        path: row["path"] as? String,
        sizeBytes: whole("size_bytes"),
        checksum: row["checksum"] as? String
      )
    }
    guard !listings.isEmpty else { return nil }
    let published = Self.catalogDate(manifest["generated_at"] as? String)
    return (listings, listings.reduce(0) { $0 + $1.recordCount }, published)
  }

  func updateStored(_ code: String) async -> String? {
    let upper = code.uppercased()
    guard let listing = countries.first(where: { $0.code == upper }), let checksum = listing.checksum else {
      return await ensureCountry(upper)
    }
    let saved = UserDefaults.standard.string(forKey: "camalert.feed.\(upper)")
    if feeds[upper] != nil, saved == checksum { return "current" }
    return await ensureCountry(upper, force: true)
  }

  func ensureCountry(_ code: String, force: Bool = false) async -> String? {
    let upper = code.uppercased()
    if !force, feeds[upper] != nil { return nil }
    let listing = countries.first { $0.code == upper }
    guard let listing, let path = listing.path, let checksum = listing.checksum else {
      if let bundled = bundledFeed(upper) {
        await MainActor.run { store(bundled, code: upper) }
        return nil
      }
      return "Страна ещё не загружена"
    }
    if !force, let cached = cachedFeed(upper, checksum: checksum) {
      await MainActor.run { store(cached, code: upper) }
      return nil
    }
    do {
      let (data, response) = try await URLSession.shared.data(from: Self.deliveryURL.appendingPathComponent(path))
      guard (response as? HTTPURLResponse)?.statusCode == 200 else { return "Не удалось загрузить \(upper)" }
      let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
      guard digest == checksum, let feed = parse(data, country: upper) else { return "Файл \(upper) не прошёл проверку" }
      try data.write(to: cacheURL("\(upper)-\(checksum).json"), options: .atomic)
      UserDefaults.standard.set(checksum, forKey: "camalert.feed.\(upper)")
      await MainActor.run { store(feed, code: upper) }
      return nil
    } catch {
      if let bundled = bundledFeed(upper) {
        await MainActor.run { store(bundled, code: upper) }
        return nil
      }
      return feeds[upper] == nil ? "Нет сети, осталась сохранённая база" : nil
    }
  }

  private static func catalogDate(_ value: String?) -> Date? {
    guard let value else { return nil }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: value) { return date }
    formatter.formatOptions = [.withInternetDateTime]
    let trimmed = value.replacingOccurrences(of: #"\.\d+"#, with: "", options: .regularExpression)
    return formatter.date(from: trimmed)
  }

  private func bundledFeed(_ code: String) -> (cameras: [CameraRecord], sections: [CameraRecord])? {
    let file = code == "UA" ? "cameras-ua" : code == "PL" ? "cameras-pl" : nil
    guard let file else { return nil }
    return parse(data(named: file), country: code)
  }

  private func cachedFeed(_ code: String, checksum: String) -> (cameras: [CameraRecord], sections: [CameraRecord])? {
    let url = cacheURL("\(code)-\(checksum).json")
    guard let data = try? Data(contentsOf: url) else { return nil }
    return parse(data, country: code)
  }

  private func store(_ feed: (cameras: [CameraRecord], sections: [CameraRecord]), code: String) {
    feeds[code] = feed.cameras
    sections[code] = feed.sections
    var grid: [String: [CameraRecord]] = [:]
    for camera in feed.cameras {
      let key = "\(Int(floor(camera.latitude / 0.05))):\(Int(floor(camera.longitude / 0.05)))"
      grid[key, default: []].append(camera)
    }
    grids[code] = grid
  }

  private func parse(_ data: Data?, country: String) -> (cameras: [CameraRecord], sections: [CameraRecord])? {
    guard let data, let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
    func points(_ key: String, type: String) -> [CameraRecord] {
      guard let rows = json[key] as? [[String: Any]] else { return [] }
      return rows.compactMap { row -> CameraRecord? in
        if row["_example_only"] as? Bool == true { return nil }
        func number(_ key: String) -> Double? {
          if let value = row[key] as? Double { return value }
          if let value = row[key] as? NSNumber { return value.doubleValue }
          return nil
        }
        guard let latitude = number("latitude"), let longitude = number("longitude") else { return nil }
        let id = String(describing: row["id"] ?? UUID().uuidString)
        let limit = number("speed_limit")
        return CameraRecord(id: id, latitude: latitude, longitude: longitude, speedLimit: limit, direction: row["direction"].map { String(describing: $0) }, type: (row["camera_type"] as? String) ?? (row["type"] as? String) ?? type, name: row["name"] as? String, location: row["location"] as? String, start: nil, end: nil, lengthKm: nil)
      }
    }
    var cameras = points("cameras", type: "speed_camera")
    cameras += points("speed_cameras", type: "speed_camera")
    cameras += points("red_light_cameras", type: "red_light")
    cameras += points("checkpoints", type: "checkpoint")
    let sectionRows = (json["average_speed_sections"] as? [[String: Any]]) ?? []
    let sections: [CameraRecord] = sectionRows.compactMap { row in
      if row["_example_only"] as? Bool == true { return nil }
      func point(_ key: String) -> MapPoint? {
        guard let box = row[key] as? [String: Any],
              let latitude = (box["latitude"] as? NSNumber)?.doubleValue,
              let longitude = (box["longitude"] as? NSNumber)?.doubleValue else { return nil }
        return MapPoint(latitude: latitude, longitude: longitude)
      }
      guard let start = point("start"), let end = point("end") else { return nil }
      let limit = (row["speed_limit"] as? NSNumber)?.doubleValue ?? (row["speed_limit"] as? Double)
      let length = (row["length_km"] as? NSNumber)?.doubleValue ?? (row["length_km"] as? Double)
      return CameraRecord(id: String(describing: row["id"] ?? UUID().uuidString), latitude: start.latitude, longitude: start.longitude, speedLimit: limit, direction: row["direction"].map { String(describing: $0) }, type: "average_speed_section", name: row["name"] as? String, location: nil, start: start, end: end, lengthKm: length)
    }
    if cameras.isEmpty && sections.isEmpty && country.isEmpty { return nil }
    return (cameras, sections)
  }

  private func data(named name: String) -> Data? {
    let url = Bundle.main.url(forResource: name, withExtension: "json", subdirectory: nil)
      ?? Bundle.main.url(forResource: name, withExtension: "json", subdirectory: "Resources")
    return url.flatMap { try? Data(contentsOf: $0) }
  }

  private func cacheURL(_ name: String) -> URL {
    let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("CamAlert", isDirectory: true)
    try? FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    return root.appendingPathComponent(name)
  }
}
