import Foundation

/// Decides when the person has finished their turn, from what the recognizer hears and how loud the microphone is.
/// The turn ends after a short silence once they've said something, so the reply comes as fast as a person's would.
public struct TurnDetector: Sendable {
    public var silenceToFinish: Duration
    public var longest: Duration
    /// With nothing said at all, the turn still ends eventually so the conversation can't hang.
    public var giveUpWithoutWords: Duration
    /// Levels at or above this count as speech, on the 0–1 scale of `AudioLevel.normalized`.
    public var speechLevel: Float

    private var lastActivity: Duration?
    private var heardWords = false

    public init(
        silenceToFinish: Duration = .milliseconds(700),
        longest: Duration = .seconds(60),
        giveUpWithoutWords: Duration = .seconds(15),
        speechLevel: Float = 0.35,
    ) {
        self.silenceToFinish = silenceToFinish
        self.longest = longest
        self.giveUpWithoutWords = giveUpWithoutWords
        self.speechLevel = speechLevel
    }

    public var hasHeardWords: Bool {
        heardWords
    }

    public mutating func hear(level: Float, at elapsed: Duration) {
        if level >= speechLevel, heardWords {
            lastActivity = elapsed
        }
    }

    /// Call whenever the recognized text grows or changes.
    public mutating func hearWords(at elapsed: Duration) {
        heardWords = true
        lastActivity = elapsed
    }

    public func isFinished(at elapsed: Duration) -> Bool {
        if elapsed >= longest {
            return true
        }
        guard let lastActivity else { return elapsed >= giveUpWithoutWords }
        return elapsed - lastActivity >= silenceToFinish
    }

    /// Whether what was heard while the interviewer talks is the person cutting in, not a cough or a stray word.
    public static func isInterruption(_ heard: String) -> Bool {
        heard.split(whereSeparator: \.isWhitespace).count >= 2
    }
}
