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

    @Test func `hears the goodbye only once the last planned question was reached`() {
        let goodbye = "Thanks for your time. Next steps come by email. Goodbye! [warmly]"
        #expect(session.isSignOff(goodbye, afterQuestion: 2))
        #expect(session.isSignOff("Great talking with you, bye.", afterQuestion: 2))
        #expect(!session.isSignOff(goodbye, afterQuestion: 1))
        #expect(!session.isSignOff(goodbye, afterQuestion: nil))
    }

    @Test func `a question or a passing word is not a goodbye`() {
        #expect(!session.isSignOff("Before we say goodbye, what questions do you have?", afterQuestion: 2))
        #expect(!session.isSignOff("What would your next steps be?", afterQuestion: 2))
        #expect(!session.isSignOff("Did you work at Byers?", afterQuestion: 2))
    }
}
