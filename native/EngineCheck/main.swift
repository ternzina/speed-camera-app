import Foundation

let cameras = [
  CameraRecord(id: "a", latitude: 50.45, longitude: 30.52, speedLimit: 50, direction: "0", type: nil, name: nil, location: nil, start: nil, end: nil, lengthKm: nil),
  CameraRecord(id: "b", latitude: 50.47, longitude: 30.52, speedLimit: 80, direction: nil, type: nil, name: nil, location: nil, start: nil, end: nil, lengthKm: nil),
  CameraRecord(id: "side", latitude: 50.45, longitude: 30.55, speedLimit: 50, direction: "90", type: nil, name: nil, location: nil, start: nil, end: nil, lengthKm: nil),
]
let ahead = CamAlertWarnings.nearestAhead(cameras, latitude: 50.45, longitude: 30.52, movementHeading: 0)
let repeatDecision = CamAlertWarnings.ukraineFix(speedKmh: 70, heading: 0, ahead: AheadCamera(camera: cameras[1], distance: 700, angle: 2), threshold: 900, last: ("b", 800))
let fresh = CamAlertWarnings.ukraineFix(speedKmh: 70, heading: 0, ahead: AheadCamera(camera: cameras[1], distance: 500, angle: 2), threshold: 900, last: ("b", 800))
let settled = CamAlertWarnings.settleUkraineLast(("b", 800), decision: WarningDecision(speak: false, reason: "none-ahead", distance: nil, limit: nil, cameraId: nil, angle: nil))
let idle = CamAlertWarnings.idleDecision(speedKmh: 0, latitude: 50.4501, longitude: 30.52, reliable: CourseMemory(heading: 0, latitude: 50.45, longitude: 30.52), cameras: cameras)
let settings = AlertSettings()
let bands = [20.0, 70, 100, 130].map { CamAlertWarnings.warningDistance(speedKmh: $0, settings: settings) }
let section = CameraRecord(id: "s1", latitude: 0, longitude: 0, speedLimit: 80, direction: "0", type: "average_speed_section", name: nil, location: nil, start: MapPoint(latitude: 52.24, longitude: 21.01), end: MapPoint(latitude: 52.26, longitude: 21.01), lengthKm: 2)
let polandCamera = CameraRecord(id: "p1", latitude: 52.23, longitude: 21.01, speedLimit: 50, direction: "0", type: "speed_camera", name: nil, location: nil, start: nil, end: nil, lengthKm: nil)
let poland = PolandEngine.nearest(cameras: [polandCamera], latitude: 52.22, longitude: 21.01, heading: 0)
let detected = PolandEngine.detectSection([section], latitude: 52.23, longitude: 21.01, heading: 0, activeId: nil)
let copy = CameraCopy.alert(language: "ru", distance: 420, limit: 50, speedKmh: 70, speedAvailable: true)
print("distance", Int(CamAlertGeo.distanceMeters(50.45, 30.52, 50.47, 30.52).rounded()))
print("ahead", ahead?.camera.id ?? "nil", ahead?.distance ?? -1, ahead?.angle ?? -1)
print("repeat", repeatDecision.reason)
print("fresh", fresh.reason)
print("settled", settled.id ?? "nil", settled.distance)
print("bands", bands)
print("idle", idle.reason)
print("poland", poland?.camera.id ?? "nil")
print("section", detected?.state ?? "nil", detected?.distance ?? -1)
print("speech", detected.map { PolandEngine.sectionSpeech(state: $0.state, limit: $0.section.speedLimit, distance: $0.distance, averageKmh: nil, language: "ru") } ?? "")
print("copy", copy.speech)
print("audio", GoogleVoiceMode.audioMode(cameraSpeaking: true, guiding: true, voiceEnabled: true))
print("audioAfter", GoogleVoiceMode.audioMode(cameraSpeaking: false, guiding: true, voiceEnabled: true))
print("premium", PremiumAccess.allows(productId: nil, revoked: false, period: nil, expiresAt: nil, now: Date().timeIntervalSince1970 * 1000))
