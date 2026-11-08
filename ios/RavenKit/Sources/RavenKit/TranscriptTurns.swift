import Foundation

/// Pairs a live transcript into scorable turns: everything the person says after one agent line, until the agent speaks again.
/// A follow-up from the agent counts as a new turn, so each gets its own quick score, the same way the headset sends them.
public struct TranscriptTurns: Sendable {
    public enum Speaker: Sendable, Equatable {
        case agent, person
    }

    private var question: String?
    private var answer: [String] = []
    private var answerStartedAt: Date?
    private var lastAnswerAt: Date?

    public init() {}

    /// The turn that just completed, if this line closed one.
    public mutating func add(_ speaker: Speaker, _ text: String, at time: Date = .now) -> VoiceTurn? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        switch speaker {
        case .agent:
            let finished = flush()
            question = trimmed
            return finished
        case .person:
            guard question != nil else { return nil }
            answer.append(trimmed)
            answerStartedAt = answerStartedAt ?? time
            lastAnswerAt = time
            return nil
        }
    }

    /// The turn in progress, for when the conversation ends mid-answer.
    public mutating func flush() -> VoiceTurn? {
        defer {
            answer = []
            answerStartedAt = nil
            lastAnswerAt = nil
        }
        guard let question, !answer.isEmpty else { return nil }
        let seconds = (lastAnswerAt ?? .now).timeIntervalSince(answerStartedAt ?? .now)
        // a one-line answer has no span of its own; a few seconds is closer than zero
        let durationMs = max(Int(seconds * 1000), 2000)
        return VoiceTurn(question: question, answer: answer.joined(separator: " "), durationMs: durationMs)
    }
}
