import Foundation

/// A past interview laid out for review, as `GET /api/voice/sessions/:id/replay` returns it.
public struct SessionReplay: Decodable, Equatable, Sendable {
    public enum Recording: String, Decodable, Sendable {
        case ready, processing
        case notRecorded = "none"
    }

    /// How to read every `t`: seconds into the call, or just the answer's position when nothing was recorded.
    public enum Timing: String, Decodable, Sendable {
        case seconds, order
    }

    /// Server path of the recording, fetched with the same sign-in. Nil when there is nothing to play.
    public let audioUrl: String?
    public let recording: Recording
    public let timing: Timing
    public let durationSec: Double?
    public let moments: [ReplayMoment]
    public let transcript: [ReplayLine]

    public init(
        audioUrl: String?, recording: Recording, timing: Timing, durationSec: Double?,
        moments: [ReplayMoment], transcript: [ReplayLine],
    ) {
        self.audioUrl = audioUrl
        self.recording = recording
        self.timing = timing
        self.durationSec = durationSec
        self.moments = moments
        self.transcript = transcript
    }

    public var canPlay: Bool {
        audioUrl != nil && timing == .seconds
    }

    /// The line being spoken at `time`: the last one that started at or before it.
    public func lineIndex(at time: Double) -> Int? {
        transcript.lastIndex { $0.seconds <= time }
    }

    /// Where `seconds` sits along the bar, 0 to 1.
    public func fraction(of seconds: Double) -> Double {
        guard let durationSec, durationSec > 0 else { return 0 }
        return min(1, max(0, seconds / durationSec))
    }

    /// "1:42" for a recording, "Question 2" when there is only the order of answers.
    public func when(_ moment: ReplayMoment) -> String {
        timing == .seconds ? ReplayClock.label(moment.seconds) : "Question \(moment.turn + 1)"
    }

    /// What VoiceOver says for a dot, e.g. "Mistake at 1:42: Stayed too general".
    public func spokenLabel(for moment: ReplayMoment) -> String {
        let place = timing == .seconds ? "at \(ReplayClock.label(moment.seconds))" : "on question \(moment.turn + 1)"
        return "\(moment.kind.spokenName) \(place): \(moment.title)"
    }
}

public struct ReplayMoment: Decodable, Equatable, Sendable, Identifiable {
    public enum Kind: String, Decodable, Sendable {
        case mistake, better, strength, filler

        public var spokenName: String {
            switch self {
            case .mistake: "Mistake"
            case .better: "Better phrasing"
            case .strength: "Strength"
            case .filler: "Filler words"
            }
        }
    }

    /// Seconds into the call, or the answer's position when the replay is timed by order.
    public let seconds: Double
    public let kind: Kind
    public let title: String
    public let detail: String
    /// A rewrite in the person's own voice.
    public let better: String?
    /// What they actually said.
    public let said: String?
    public let question: String
    public let turn: Int

    public var id: String {
        "\(kind.rawValue)-\(turn)-\(seconds)"
    }

    public init(
        seconds: Double, kind: Kind, title: String, detail: String, better: String? = nil, said: String? = nil,
        question: String, turn: Int,
    ) {
        self.seconds = seconds
        self.kind = kind
        self.title = title
        self.detail = detail
        self.better = better
        self.said = said
        self.question = question
        self.turn = turn
    }

    private enum CodingKeys: String, CodingKey {
        case seconds = "t"
        case kind, title, detail, better, said, question, turn
    }
}

public struct ReplayLine: Decodable, Equatable, Sendable {
    public enum Speaker: String, Decodable, Sendable {
        case agent, person
    }

    public let seconds: Double
    public let speaker: Speaker
    public let text: String

    public init(seconds: Double, speaker: Speaker, text: String) {
        self.seconds = seconds
        self.speaker = speaker
        self.text = text
    }

    private enum CodingKeys: String, CodingKey {
        case seconds = "t"
        case speaker, text
    }
}

public enum ReplayClock {
    /// Minutes and seconds, "0:07" or "12:30".
    public static func label(_ seconds: Double) -> String {
        let whole = max(0, Int(seconds.rounded(.down)))
        return "\(whole / 60):" + String(format: "%02d", whole % 60)
    }
}

public extension SkillitClient {
    func sessionReplay(id: String) async throws(SkillitError) -> SessionReplay {
        try await send(authorized("GET", "api/voice/sessions/\(id)/replay"))
    }

    /// The recording's bytes. Downloaded whole: a practice call is a few minutes, and a file plays and seeks offline.
    func replayAudio(id: String) async throws(SkillitError) -> Data {
        try await responseData(for: authorized("GET", "api/voice/sessions/\(id)/replay/audio"))
    }

    func attachConversation(_ conversationId: String, to sessionId: String) async throws(SkillitError) {
        _ = try await responseData(for: authorized(
            "POST", "api/voice/sessions/\(sessionId)/conversation", json: ["conversationId": conversationId],
        ))
    }
}
