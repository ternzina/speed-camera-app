import AVFoundation

/// Original Yevheniia clips from assets/uk-voice and uk-voice-clips.js.
/// Distances stay on 100 m steps. Under 100 m is «close», never the 100 m clip.
/// An unrecorded limit is left out. Crossfade is 25 ms, the sentence pause is 140 ms.
enum UkrainianVoice {
  struct Step {
    var id: String
    var join: String
  }

  struct Plan {
    var steps: [Step]
  }

  static let clipIDs = [
    "lead-kamera-cherez", "lead-poperedu-cherez", "lead-dilianka-cherez",
    "dist-0100", "dist-0200", "dist-0300", "dist-0400", "dist-0500",
    "dist-0600", "dist-0700", "dist-0800", "dist-0900", "dist-1000",
    "dist-1100", "dist-1200", "dist-1300", "dist-1400", "dist-1500",
    "limit-50", "limit-70", "limit-90", "limit-110",
    "slow-50", "slow-70", "slow-90", "slow-110",
    "ahead", "close", "section-start", "section-end", "average-over",
  ]
  static let crossfade: TimeInterval = 0.025
  static let sentencePause: TimeInterval = 0.140
  private static let knownLimits: Set<Int> = [50, 70, 90, 110]

  static var bundledCount: Int { clipIDs.filter { url($0) != nil }.count }

  static func url(_ id: String) -> URL? {
    Bundle.main.url(forResource: id, withExtension: "mp3", subdirectory: "uk-voice")
  }

  static func playable(_ plan: Plan) -> Bool {
    !plan.steps.isEmpty && plan.steps.allSatisfy { url($0.id) != nil }
  }

  static func cameraPlan(kind: String, distance: Double, limit: Double?, over: Bool, averageKmh: Double? = nil) -> Plan? {
    switch kind {
    case "section-ending":
      return Plan(steps: [Step(id: "section-end", join: "none")])
    case "section-entering":
      return Plan(steps: withLimit([Step(id: "section-start", join: "none")], limit: limit, over: false))
    case "section-over":
      guard let averageKmh, averageKmh.isFinite, limitState(limit).known else { return nil }
      var steps = [Step(id: "average-over", join: "none")]
      if let mapped = limitState(limit).mapped {
        steps.append(Step(id: "limit-\(mapped)", join: "pause"))
      }
      return Plan(steps: steps)
    case "section-approaching":
      return Plan(steps: withLimit(distanceSteps(distance, lead: "lead-dilianka-cherez"), limit: limit, over: false))
    case "pl-camera":
      return Plan(steps: withLimit(distanceSteps(distance, lead: "lead-poperedu-cherez"), limit: limit, over: false))
    case "ua-camera":
      return Plan(steps: withLimit(distanceSteps(distance, lead: "lead-kamera-cherez"), limit: limit, over: over, aheadWhenUnknown: true))
    default:
      return nil
    }
  }

  static func plan(from phrase: String) -> Plan? {
    let text = phrase
    let limit = firstNumber(in: text, pattern: #"Обмеження\s+(\d+)"#) ?? firstNumber(in: text, pattern: #"до\s+(\d+)"#)
    let distance = firstNumber(in: text, pattern: #"через\s+(\d+)"#)
    if text.hasPrefix("Ділянка контролю середньої швидкості через") {
      return cameraPlan(kind: "section-approaching", distance: distance ?? 0, limit: limit, over: false)
    }
    if text.hasPrefix("Починається ділянка") {
      return cameraPlan(kind: "section-entering", distance: 0, limit: limit, over: false)
    }
    if text.hasPrefix("Ділянка контролю середньої швидкості завершена") {
      return cameraPlan(kind: "section-ending", distance: 0, limit: nil, over: false)
    }
    if text.hasPrefix("Середня швидкість") {
      return cameraPlan(kind: "section-over", distance: 0, limit: limit, over: true, averageKmh: firstNumber(in: text, pattern: #"Середня швидкість\s+(\d+)"#))
    }
    if text.hasPrefix("Камера попереду через") {
      return cameraPlan(kind: "pl-camera", distance: distance ?? 0, limit: limit, over: false)
    }
    if text.hasPrefix("Камера через") {
      let over = text.contains("Знизьте") || text.contains("Зменште")
      return cameraPlan(kind: "ua-camera", distance: distance ?? 0, limit: limit, over: over)
    }
    return nil
  }

  private static func firstNumber(in text: String, pattern: String) -> Double? {
    guard let match = text.range(of: pattern, options: .regularExpression) else { return nil }
    let fragment = String(text[match])
    guard let digits = fragment.range(of: #"\d+"#, options: .regularExpression) else { return nil }
    return Double(fragment[digits])
  }

  private static func jsRound(_ value: Double) -> Int {
    if value >= 0 { return Int(floor(value + 0.5)) }
    return Int(ceil(value - 0.5))
  }

  private static func distanceSteps(_ meters: Double, lead: String) -> [Step] {
    guard meters.isFinite, meters >= 100 else { return [Step(id: "close", join: "none")] }
    let rounded = min(1500, max(100, jsRound(meters / 100) * 100))
    return [
      Step(id: lead, join: "none"),
      Step(id: String(format: "dist-%04d", rounded), join: "crossfade"),
    ]
  }

  private static func limitState(_ limit: Double?) -> (known: Bool, mapped: Int?) {
    guard let limit, limit.isFinite, limit > 0 else { return (false, nil) }
    let whole = jsRound(limit)
    guard abs(limit - Double(whole)) < 0.001 else { return (true, nil) }
    if knownLimits.contains(whole) { return (true, whole) }
    return (true, nil)
  }

  private static func withLimit(_ steps: [Step], limit: Double?, over: Bool, aheadWhenUnknown: Bool = false) -> [Step] {
    var steps = steps
    let state = limitState(limit)
    if let mapped = state.mapped {
      steps.append(Step(id: over ? "slow-\(mapped)" : "limit-\(mapped)", join: "pause"))
      return steps
    }
    if !state.known, aheadWhenUnknown {
      steps.append(Step(id: "ahead", join: "pause"))
    }
    return steps
  }
}

final class UkrainianClipPlayer {
  private(set) var isPlaying = false
  private var generation = 0
  private var held: [AVAudioPlayer] = []
  private var sessionOwned = false

  func play(_ plan: UkrainianVoice.Plan, onOpen: @escaping (String) -> Void, done: @escaping (Bool) -> Void) {
    generation += 1
    let ticket = generation
    held.forEach { $0.stop() }
    held.removeAll()
    guard UkrainianVoice.playable(plan) else {
      isPlaying = false
      done(false)
      return
    }
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playback, mode: .spokenAudio, options: [])
      try session.setActive(true)
      sessionOwned = true
    } catch {
      isPlaying = false
      done(false)
      return
    }
    isPlaying = true
    advance(0, plan: plan, ticket: ticket, onOpen: onOpen, done: done)
  }

  private func advance(_ index: Int, plan: UkrainianVoice.Plan, ticket: Int, onOpen: @escaping (String) -> Void, done: @escaping (Bool) -> Void) {
    guard ticket == generation else { return }
    guard index < plan.steps.count else {
      finish(true, ticket: ticket, done: done)
      return
    }
    let step = plan.steps[index]
    let begin = { [weak self] in
      guard let self, ticket == self.generation else { return }
      if step.join != "crossfade" {
        self.held.forEach { $0.stop() }
        self.held.removeAll()
      }
      guard let url = UkrainianVoice.url(step.id), let player = try? AVAudioPlayer(contentsOf: url) else {
        self.finish(false, ticket: ticket, done: done)
        return
      }
      player.prepareToPlay()
      self.held.append(player)
      guard player.play() else {
        self.finish(false, ticket: ticket, done: done)
        return
      }
      onOpen(step.id)
      let nextCross = index + 1 < plan.steps.count && plan.steps[index + 1].join == "crossfade"
      let lead = nextCross ? UkrainianVoice.crossfade : 0
      let wait = max(0.05, player.duration - lead)
      DispatchQueue.main.asyncAfter(deadline: .now() + wait) { [weak self] in
        self?.advance(index + 1, plan: plan, ticket: ticket, onOpen: onOpen, done: done)
      }
    }
    if step.join == "pause" {
      DispatchQueue.main.asyncAfter(deadline: .now() + UkrainianVoice.sentencePause, execute: begin)
    } else {
      begin()
    }
  }

  private func finish(_ played: Bool, ticket: Int, done: @escaping (Bool) -> Void) {
    guard ticket == generation else { return }
    generation += 1
    isPlaying = false
    held.forEach { $0.stop() }
    held.removeAll()
    releaseSession()
    done(played)
  }

  private func releaseSession() {
    guard sessionOwned else { return }
    sessionOwned = false
    let session = AVAudioSession.sharedInstance()
    try? session.setCategory(.playback, mode: .spokenAudio, options: [.mixWithOthers])
    try? session.setActive(false, options: [.notifyOthersOnDeactivation])
  }
}
