import Foundation

public extension VoiceSession {
    /// The planned question the agent just asked, if this line is one of them.
    /// The agent rarely reads a question back verbatim: it adds expression tags, a lead-in like "Great, next:",
    /// or drops the question mark. So the match ignores tags, case, trailing punctuation and any lead-in.
    func plannedQuestionIndex(matching spokenLine: String) -> Int? {
        let spoken = Self.comparable(spokenLine)
        guard !spoken.isEmpty else { return nil }
        return questions.firstIndex { question in
            let planned = Self.comparable(question.text)
            guard !planned.isEmpty else { return false }
            return spoken == planned || spoken.hasSuffix(planned) || spoken.hasPrefix(planned)
        }
    }

    /// The interviewer's goodbye after the last planned question. Hanging up once it is said saves
    /// the paid seconds the agent would otherwise sit waiting for silence.
    /// A question is never a goodbye, so a probe like "what would your next steps be?" can't end the call.
    func isSignOff(_ spokenLine: String, afterQuestion number: Int?) -> Bool {
        let spoken = spokenLine.withoutAudioTags
        guard !questions.isEmpty, number == questions.count, !spoken.contains("?") else { return false }
        return spoken.range(of: #"\b(good\s?)?bye\b"#, options: [.regularExpression, .caseInsensitive]) != nil
    }

    private static func comparable(_ text: String) -> String {
        text.withoutAudioTags
            .lowercased()
            .trimmingCharacters(in: .punctuationCharacters.union(.whitespacesAndNewlines))
    }
}
