import Foundation
@testable import SkillitKit
import Testing

struct SessionReplayTests {
    static let json = #"""
    {"audioUrl":"/api/voice/sessions/s1/replay/audio","recording":"ready","timing":"seconds","durationSec":120,
     "moments":[{"t":102,"kind":"mistake","title":"Stayed too general","detail":"Name one number.","question":"Q2","turn":1},
                {"t":12,"kind":"better","title":"A stronger way to say it","detail":"Lead with the result.",
                 "better":"We cut it to forty minutes.","said":"it went fine","question":"Q1","turn":0}],
     "transcript":[{"t":0,"speaker":"agent","text":"Tell me about a project."},
                   {"t":8,"speaker":"person","text":"I rebuilt the pipeline."},
                   {"t":40,"speaker":"agent","text":"Why us?"}]}
    """#

    let replay: SessionReplay

    init() throws {
        replay = try JSONDecoder().decode(SessionReplay.self, from: Data(Self.json.utf8))
    }

    @Test func `decodes moments with and without a rewrite`() {
        #expect(replay.canPlay)
        #expect(replay.moments[1].better == "We cut it to forty minutes.")
        #expect(replay.moments[0].better == nil)
    }

    @Test func `the current line is the last one that started`() {
        #expect(replay.lineIndex(at: 0) == 0)
        #expect(replay.lineIndex(at: 39.9) == 1)
        #expect(replay.lineIndex(at: 300) == 2)
    }

    @Test func `dots sit along the bar by time and stay on it`() {
        #expect(replay.fraction(of: 60) == 0.5)
        #expect(replay.fraction(of: 500) == 1)
    }

    @Test func `voiceOver hears the kind, the time and the title`() {
        #expect(replay.spokenLabel(for: replay.moments[0]) == "Mistake at 1:42: Stayed too general")
        #expect(replay.when(replay.moments[1]) == "0:12")
    }

    @Test func `without a recording moments are placed by question`() {
        let ordered = SessionReplay(
            audioUrl: nil, recording: .notRecorded, timing: .order, durationSec: nil, moments: replay.moments, transcript: [],
        )
        #expect(!ordered.canPlay)
        #expect(ordered.when(ordered.moments[0]) == "Question 2")
        #expect(ordered.spokenLabel(for: ordered.moments[0]) == "Mistake on question 2: Stayed too general")
    }

    @Test func `clock labels pad seconds`() {
        #expect(ReplayClock.label(7) == "0:07")
        #expect(ReplayClock.label(750.9) == "12:30")
    }
}

extension StubbedNetworkTests {
    struct SessionReplayClientTests {
        let client = SkillitClientTests.client(accessToken: { "t0k" })

        @Test func `fetches the replay for a session`() async throws {
            StubProtocol.routes.withLock { $0["GET /api/voice/sessions/s1/replay"] = (200, SessionReplayTests.json) }
            let replay = try await client.sessionReplay(id: "s1")
            #expect(replay.moments.count == 2)
            #expect(replay.durationSec == 120)
        }
    }
}
