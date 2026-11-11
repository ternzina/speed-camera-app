import AVFoundation
import CoreLocation
import Foundation

// Documents journal for the diagnostic bundle only. It records port types,
// interruption flags, and the location authorization name. It does not record
// coordinates, device names, or the API key.
@objc(CamAlertVoiceDiagLog)
public class CamAlertVoiceDiagLog: NSObject {
  private static let queue = DispatchQueue(label: "camalert.voice.diag")
  private static var interruption = "none"
  private static var interrupted = false

  private static func allowed() -> Bool {
    Bundle.main.bundleIdentifier == "com.21wek.camera.voicediag"
  }

  private static func fileURL() -> URL {
    FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("camalert-voice-diag.txt")
  }

  @objc public static func noteInterruption(type: UInt, options: UInt) {
    interruption = "type=\(type) options=\(options)"
    interrupted = type == AVAudioSession.InterruptionType.began.rawValue
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
    let row = Data((line + "\n").utf8)
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
