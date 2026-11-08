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

    private static func comparable(_ text: String) -> String {
        text.withoutAudioTags
            .lowercased()
            .trimmingCharacters(in: .punctuationCharacters.union(.whitespacesAndNewlines))
    }
}
