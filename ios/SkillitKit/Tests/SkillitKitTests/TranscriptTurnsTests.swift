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

    @Test func `stamps each turn with seconds into the call, starting when the agent handed over`() {
        var turns = TranscriptTurns()
        turns.callStarted(at: start)
        _ = turns.add(.agent, "Tell me about a project.", at: start.addingTimeInterval(1))
        turns.floorOpened(at: start.addingTimeInterval(6))
        _ = turns.add(.person, "I built an API.", at: start.addingTimeInterval(11))
        let turn = turns.add(.agent, "What was your part?", at: start.addingTimeInterval(14))
        #expect(turn?.answerStartSec == 6)
        #expect(turn?.atSec == 14)
    }

    @Test func `keeps the first connect as the clock and leaves turns unstamped without one`() {
        var unstamped = TranscriptTurns()
        _ = unstamped.add(.agent, "Why us?", at: start)
        _ = unstamped.add(.person, "Because of the team.", at: start.addingTimeInterval(3))
        #expect(unstamped.flush(at: start.addingTimeInterval(4))?.answerStartSec == nil)

        var turns = TranscriptTurns()
        turns.callStarted(at: start)
        turns.callStarted(at: start.addingTimeInterval(30))
        _ = turns.add(.agent, "Why us?", at: start)
        _ = turns.add(.person, "Because of the team.", at: start.addingTimeInterval(3))
        #expect(turns.flush(at: start.addingTimeInterval(4))?.answerStartSec == 3)
    }
}
