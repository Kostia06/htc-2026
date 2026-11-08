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
    /// When the agent last stopped talking with no answer yet: the person starts speaking around here.
    private var floorOpenedAt: Date?
    /// When the call connected; turns carry timestamps only once this is known.
    private var callStartedAt: Date?

    public init() {}

    /// Marks the start of the call's clock. Only the first call counts, so a late duplicate can't shift every timestamp.
    public mutating func callStarted(at time: Date = .now) {
        callStartedAt = callStartedAt ?? time
    }

    /// The agent stopped talking. A transcript line arrives only once the person finishes it, so this is the
    /// better guess at when an answer began.
    public mutating func floorOpened(at time: Date = .now) {
        guard question != nil, answer.isEmpty else { return }
        floorOpenedAt = time
    }

    /// The turn that just completed, if this line closed one.
    public mutating func add(_ speaker: Speaker, _ text: String, at time: Date = .now) -> VoiceTurn? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        switch speaker {
        case .agent:
            let finished = flush(at: time)
            floorOpenedAt = nil
            // the scorer should see the question as asked, not the voice's stage directions
            let spoken = trimmed.withoutAudioTags
            if !spoken.isEmpty { question = spoken }
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
    public mutating func flush(at time: Date = .now) -> VoiceTurn? {
        defer {
            answer = []
            answerStartedAt = nil
            lastAnswerAt = nil
            floorOpenedAt = nil
        }
        guard let question, !answer.isEmpty else { return nil }
        let seconds = (lastAnswerAt ?? .now).timeIntervalSince(answerStartedAt ?? .now)
        // a one-line answer has no span of its own; a few seconds is closer than zero
        let durationMs = max(Int(seconds * 1000), 2000)
        let began = floorOpenedAt ?? answerStartedAt
        return VoiceTurn(
            question: question, answer: answer.joined(separator: " "), durationMs: durationMs,
            answerStartSec: began.flatMap(secondsIntoCall), atSec: secondsIntoCall(time),
        )
    }

    private func secondsIntoCall(_ time: Date) -> Double? {
        callStartedAt.map { max(0, time.timeIntervalSince($0)) }
    }
}
