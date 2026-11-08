@testable import SkillitKit
import Testing

struct VoiceSessionQuestionsTests {
    let session = VoiceSession(
        id: "vs", mode: .interview, provider: "test", opening: "Hi.",
        questions: [
            PracticeQuestion(text: "Why do you want to work here?"),
            PracticeQuestion(text: "Tell me about a project you're proud of."),
        ],
    )

    @Test func `matches the exact question`() {
        #expect(session.plannedQuestionIndex(matching: "Why do you want to work here?") == 0)
    }

    @Test func `ignores expression tags, case and trailing punctuation`() {
        #expect(session.plannedQuestionIndex(matching: "[warmly] why do you want to work here") == 0)
        #expect(session.plannedQuestionIndex(matching: "Tell me about a project you're proud of! [laughs]") == 1)
    }

    @Test func `matches when the agent adds a lead-in`() {
        #expect(session.plannedQuestionIndex(matching: "Great. Next: tell me about a project you're proud of.") == 1)
    }

    @Test func `returns nil for small talk and follow-ups`() {
        #expect(session.plannedQuestionIndex(matching: "Thanks for coming in.") == nil)
        #expect(session.plannedQuestionIndex(matching: "[sighs]") == nil)
        #expect(VoiceSession(id: "n", mode: .interview, provider: "test", opening: "Hey.").plannedQuestionIndex(matching: "Hey.") == nil)
    }
}
