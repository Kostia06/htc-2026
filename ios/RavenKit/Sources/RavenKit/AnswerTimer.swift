import Foundation

/// Decides when a spoken answer is over from microphone levels alone: a pause after the person has spoken, or a time limit.
public struct AnswerTimer: Sendable {
    public var pauseToFinish: Duration
    public var longest: Duration
    /// Levels at or above this count as speech, on the 0–1 scale of `AudioLevel.normalized`.
    public var speechLevel: Float

    private var lastSpeech: Duration?

    public init(pauseToFinish: Duration = .seconds(2.5), longest: Duration = .seconds(45), speechLevel: Float = 0.35) {
        self.pauseToFinish = pauseToFinish
        self.longest = longest
        self.speechLevel = speechLevel
    }

    /// Feed every level reading with how long the answer has been going; returns true once the answer is over.
    public mutating func isFinished(hearing level: Float, after elapsed: Duration) -> Bool {
        if level >= speechLevel {
            lastSpeech = elapsed
        }
        if elapsed >= longest {
            return true
        }
        guard let lastSpeech else { return false }
        return elapsed - lastSpeech >= pauseToFinish
    }
}

public enum AudioLevel {
    /// Maps a buffer's RMS amplitude to 0–1 on a decibel scale, so quiet speech still moves the bars.
    public static func normalized(rms: Float) -> Float {
        let decibels = 20 * log10(max(rms, 1e-7))
        return min(max((decibels - silence) / -silence, 0), 1)
    }

    private static let silence: Float = -50
}
