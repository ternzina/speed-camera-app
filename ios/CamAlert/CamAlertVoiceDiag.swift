import AVFoundation
import CoreLocation
import Foundation

// Documents journal for the diagnostic bundle and the separate store-interface
// preview. The store app and navtest do not write it. It records port types,
// interruption flags, and the location authorization name. It does not record
// coordinates, device names, or the API key.
@objc(CamAlertVoiceDiagLog)
public class CamAlertVoiceDiagLog: NSObject {
  private static let queue = DispatchQueue(label: "camalert.voice.diag")
  private static var interruption = "none"
  private static var interrupted = false
  private static var audioDisruption = false
  private static var screenUp = false
  private static var navigationSession = false
  // The trip whose delayed diagnostic activation is still pending. Zero means
  // none. A new trip id may try again; this does not last for the process.
  private static var diagnosticTrip = 0

  // True only while a Google navigation session object exists.
  @objc public static func noteNavigationSession() {
    navigationSession = true
    NSLog("CAMALERT_NAV_VOICE navigation session exists=1")
  }

  @objc public static func clearNavigationSession() {
    navigationSession = false
    NSLog("CAMALERT_NAV_VOICE navigation session exists=0")
  }

  @objc public static func navigationSessionExists() -> Bool {
    navigationSession
  }

  @objc public static func logSessionActivation(source: String, performed: Bool) {
    NSLog("CAMALERT_NAV_VOICE session activate source=%@ performed=%d", source, performed ? 1 : 0)
  }

  // Diagnostic only. Called when the public startGuidance call has returned.
  // The unified-log timestamp is the startGuidance time. This is not a signal
  // that a Google prompt finished.
  @objc public static func noteDiagnosticStartGuidance(_ trip: Int) {
    diagnosticTrip = trip
    NSLog("CAMALERT_NAV_VOICE diag event=startGuidance trip=%ld", CLong(trip))
  }

  @objc public static func cancelDiagnosticActivation(_ trip: Int, reason: String) {
    guard trip != 0, trip == diagnosticTrip else { return }
    diagnosticTrip = 0
    NSLog("CAMALERT_NAV_VOICE diag event=cancel trip=%ld reason=%@", CLong(trip), reason)
  }

  // One attempt for this trip id. setActive is deferred to the next main-queue
  // turn so a cancel or a newer trip already queued behind this call is applied
  // first. The NSError is logged and not discarded.
  @objc public static func activateDiagnosticSession(_ trip: Int) -> String {
    DispatchQueue.main.async {
      guard trip != 0, trip == diagnosticTrip else {
        NSLog("CAMALERT_NAV_VOICE diag event=activate trip=%ld result=skipped", CLong(trip))
        return
      }
      diagnosticTrip = 0
      do {
        try AVAudioSession.sharedInstance().setActive(true)
        NSLog("CAMALERT_NAV_VOICE diag event=activate trip=%ld result=ok", CLong(trip))
      } catch {
        let ns = error as NSError
        NSLog(
          "CAMALERT_NAV_VOICE diag event=activate trip=%ld result=error domain=%@ code=%ld description=%@",
          CLong(trip), ns.domain, CLong(ns.code), ns.localizedDescription
        )
      }
    }
    return "queued"
  }

  private static func allowed() -> Bool {
    let bundle = Bundle.main.bundleIdentifier
    return bundle == "com.21wek.camera.voicediag" || bundle == "com.21wek.camera.voicepreview"
  }

  private static func fileURL() -> URL {
    FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("camalert-voice-diag.txt")
  }

  @objc public static func noteInterruption(type: UInt, options: UInt) {
    interruption = "type=\(type) options=\(options)"
    let began = type == AVAudioSession.InterruptionType.began.rawValue
    interrupted = began
    if began { audioDisruption = true }
  }

  // Stays set until the next route start reads it. Ending the interruption
  // does not clear it: the navigator created across that break stays mute.
  @objc public static func takeAudioDisruption() -> Bool {
    let value = audioDisruption
    audioDisruption = false
    return value
  }

  @objc public static func routePorts() -> String {
    AVAudioSession.sharedInstance().currentRoute.outputs
      .map { $0.portType.rawValue }
      .joined(separator: ",")
  }

  @objc public static func locationStatus() -> String {
    switch CLLocationManager().authorizationStatus {
    case .notDetermined: return "notDetermined"
    case .restricted: return "restricted"
    case .denied: return "denied"
    case .authorizedAlways: return "authorizedAlways"
    case .authorizedWhenInUse: return "authorizedWhenInUse"
    @unknown default: return "unknown"
    }
  }

  @objc public static func append(_ line: String) {
    guard allowed() else { return }
    if line.contains("CamAlertGoogleNavKey") { return }
    if line.range(of: #"-?\d{1,3}\.\d{4,}"#, options: .regularExpression) != nil { return }
    let ms = Int(Date().timeIntervalSince1970 * 1000)
    let row = Data((line + " ms=\(ms)\n").utf8)
    queue.sync {
      let url = fileURL()
      if FileManager.default.fileExists(atPath: url.path), let handle = try? FileHandle(forWritingTo: url) {
        handle.seekToEndOfFile()
        handle.write(row)
        try? handle.close()
      } else {
        try? row.write(to: url)
      }
    }
  }

  @objc public static func voicePackNames() -> [String] {
    let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("CannedSpeechBundles", isDirectory: true)
    guard let languages = try? FileManager.default.contentsOfDirectory(
      at: root,
      includingPropertiesForKeys: [.isDirectoryKey],
      options: [.skipsHiddenFiles]
    ) else { return [] }
    var names: [String] = []
    for language in languages {
      let units = (try? FileManager.default.contentsOfDirectory(
        at: language,
        includingPropertiesForKeys: nil,
        options: [.skipsHiddenFiles]
      )) ?? []
      if units.isEmpty {
        names.append(language.lastPathComponent)
        continue
      }
      for unit in units {
        names.append("\(language.lastPathComponent)/\(unit.lastPathComponent)")
      }
    }
    return names.sorted()
  }

  // Armed only for this process, by the launch environment. A later launch
  // without the variable keeps the phone GPS.
  @objc public static func tripArmed() -> Bool {
    guard Bundle.main.bundleIdentifier == "com.21wek.camera.voicediag" else { return false }
    return ProcessInfo.processInfo.environment["CAMALERT_DIAG_TRIP"] == "1"
  }

  @objc public static func markScreen() {
    screenUp = true
  }

  @objc public static func readiness() -> NSDictionary {
    [
      "screen": screenUp,
      "ms": Int(Date().timeIntervalSince1970 * 1000),
    ]
  }

  @objc public static func audioProbe() -> NSDictionary {
    let session = AVAudioSession.sharedInstance()
    return [
      "category": session.category.rawValue,
      "route": session.currentRoute.outputs.map { $0.portType.rawValue },
      "volume": session.outputVolume,
      "otherAudio": session.isOtherAudioPlaying,
      "silenced": session.secondaryAudioShouldBeSilencedHint,
      "packs": voicePackNames(),
      "interruption": interruption,
      "interrupted": interrupted,
      "location": locationStatus(),
    ]
  }

  @objc public static func snapshot() -> NSDictionary {
    [
      "route": AVAudioSession.sharedInstance().currentRoute.outputs.map { $0.portType.rawValue },
      "interruption": interruption,
      "interrupted": interrupted,
      "location": locationStatus(),
      "category": AVAudioSession.sharedInstance().category.rawValue,
    ]
  }
}
