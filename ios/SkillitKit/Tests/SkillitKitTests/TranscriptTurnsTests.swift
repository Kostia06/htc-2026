import Foundation
@testable import SkillitKit
import Testing

struct TranscriptTurnsTests {
    let start = Date(timeIntervalSince1970: 1000)

    @Test func `closes a turn when the agent speaks again, joining what the person said`() {
        var turns = TranscriptTurns()
        #expect(turns.add(.agent, "Tell me about a project.", at: start) == nil)
        #expect(turns.add(.person, "I built an API.", at: start.addingTimeInterval(2)) == nil)
        #expect(turns.add(.person, "It served 2,000 people.", at: start.addingTimeInterval(9)) == nil)
        let turn = turns.add(.agent, "What was your part?", at: start.addingTimeInterval(10))
        let expected = VoiceTurn(question: "Tell me about a project.", answer: "I built an API. It served 2,000 people.", durationMs: 7000)
        #expect(turn == expected)
    }

    @Test func `ignores speech before the first question and empty lines`() {
        var turns = TranscriptTurns()
        #expect(turns.add(.person, "hello?", at: start) == nil)
        #expect(turns.add(.agent, "Why us?", at: start) == nil)
        #expect(turns.add(.person, "   ", at: start) == nil)
        #expect(turns.add(.agent, "Next question.", at: start) == nil)
    }

    @Test func `sends the question without the voice's expression tags`() {
        var turns = TranscriptTurns()
        _ = turns.add(.agent, "[warmly] Why us? [laughs]", at: start)
        _ = turns.add(.person, "Because of the team.", at: start.addingTimeInterval(1))
        #expect(turns.flush()?.question == "Why us?")
    }

    @Test func `flushes the answer in progress when the conversation ends`() {
        var turns = TranscriptTurns()
        _ = turns.add(.agent, "Why us?", at: start)
        _ = turns.add(.person, "Because of the team.", at: start.addingTimeInterval(1))
        let turn = turns.flush()
        #expect(turn?.question == "Why us?")
        #expect(turn?.durationMs == 2000)
        #expect(turns.flush() == nil)
    }
}
