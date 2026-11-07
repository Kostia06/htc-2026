import Foundation
@testable import RavenKit
import Testing

@Suite(.serialized)
struct VoiceSessionsTests {
    let client: RavenClient

    init() {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubProtocol.self]
        client = RavenClient(baseURL: URL(string: "https://api.test")!, token: "t0k", session: URLSession(configuration: configuration))
    }

    @Test func `starts an interview and keeps the provider credentials as they came`() async throws {
        StubProtocol.routes.withLock {
            $0["POST /api/voice/sessions"] = (201, """
            {"sessionId":"vs_1","mode":"interview","provider":"gemini",
             "credentials":{"kind":"gemini-live","token":"abc","model":"live-2"},"expiresAt":"2026-11-07T23:00:00Z",
             "opening":"Hi, thanks for coming in.",
             "questions":[{"text":"Why us?","source":"reported"},{"text":"Tell me about a project.","source":"resume"}]}
            """)
        }
        let session = try await client.startVoiceSession(.init(mode: .interview, role: "Data analyst"))

        #expect(session.id == "vs_1")
        #expect(session.questions.map(\.isReported) == [true, false])
        #expect(session.goals.isEmpty)
        #expect(session.credentials == .object(["kind": .string("gemini-live"), "token": .string("abc"), "model": .string("live-2")]))
        let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/voice/sessions"] })
        let sent = try JSONSerialization.jsonObject(with: body) as? [String: String]
        #expect(sent == ["mode": "interview", "role": "Data analyst"])
    }

    @Test func `starts a networking chat with a persona and no expiry`() async throws {
        StubProtocol.routes.withLock {
            $0["POST /api/voice/sessions"] = (201, """
            {"sessionId":"vs_2","mode":"networking","provider":"elevenlabs","credentials":{"kind":"elevenlabs"},"expiresAt":null,
             "opening":"Hey, I'm Sam.","persona":{"name":"Sam","role":"works in tech","company":null},"goals":["Ask a real question"]}
            """)
        }
        let session = try await client.startVoiceSession(.init(mode: .networking))

        #expect(session.persona == Persona(name: "Sam", role: "works in tech"))
        #expect(session.expiresAt == nil)
        #expect(session.questions.isEmpty)
    }

    @Test func `scores a turn and tolerates a missing words-per-minute`() async throws {
        StubProtocol.routes.withLock {
            $0["POST /api/voice/sessions/vs_1/turns"] = (200, """
            {"scores":{"clarity":0.8,"structure":0.4},"delivery":{"words":0,"fillerWords":0,"wordsPerMinute":null},
             "tip":"Lead with the result."}
            """)
        }
        let feedback = try await client.submitTurn(.init(question: "Why us?", answer: "Because", durationMs: 4200), in: "vs_1")

        #expect(feedback.scores["clarity"] == 0.8)
        #expect(feedback.delivery?.wordsPerMinute == nil)
        #expect(feedback.tip == "Lead with the result.")
        let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/voice/sessions/vs_1/turns"] })
        let sent = try JSONDecoder().decode([String: JSONValue].self, from: body)
        #expect(sent["durationMs"] == .number(4200))
    }

    @Test func `reports a turn on an ended session as rejected`() async {
        StubProtocol.routes.withLock { $0["POST /api/voice/sessions/vs_9/turns"] = (409, #"{"error":"this session has ended"}"#) }
        await #expect(throws: RavenError.rejected(status: 409, message: "this session has ended")) {
            try await client.submitTurn(.init(question: "q", answer: "a", durationMs: 1), in: "vs_9")
        }
    }

    @Test func `finishes with a prep list and ignores extra fields`() async throws {
        StubProtocol.routes.withLock {
            $0["POST /api/voice/sessions/vs_1/finish"] = (200, """
            {"summary":"Clear answers, short on numbers.","prepList":[{"step":"Count your impact","why":"Numbers stick"}],
             "savedToMemory":true}
            """)
        }
        let summary = try await client.finishVoiceSession("vs_1")

        #expect(summary.prepList == [.init(step: "Count your impact", why: "Numbers stick")])
    }
}

struct AnswerTimerTests {
    @Test func `ends the answer after a pause once the person has spoken`() {
        let readings = finishedAfter([(0.8, 1), (0.1, 2.5), (0.1, 3)])
        #expect(readings == [false, false, true])
    }

    @Test func `waits through silence before the person starts`() {
        #expect(finishedAfter([(0, 10)]) == [false])
    }

    @Test func `stops at the time limit even mid-sentence`() {
        #expect(finishedAfter([(0.9, 30)]) == [true])
    }

    private func finishedAfter(_ readings: [(level: Float, seconds: Double)]) -> [Bool] {
        var timer = AnswerTimer(pauseToFinish: .seconds(2), longest: .seconds(30))
        return readings.map { timer.isFinished(hearing: $0.level, after: .seconds($0.seconds)) }
    }

    @Test func `maps loudness onto zero to one`() {
        #expect(AudioLevel.normalized(rms: 0) == 0)
        #expect(AudioLevel.normalized(rms: 1) == 1)
        #expect(AudioLevel.normalized(rms: 0.01) < AudioLevel.normalized(rms: 0.1))
    }
}
