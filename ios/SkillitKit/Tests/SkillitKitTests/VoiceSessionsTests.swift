import Foundation
@testable import SkillitKit
import Testing

extension StubbedNetworkTests {
    struct VoiceSessionsTests {
        let client: SkillitClient

        init() {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.protocolClasses = [StubProtocol.self]
            client = SkillitClient(
                baseURL: URL(string: "https://api.test")!,
                accessToken: { "t0k" },
                session: URLSession(configuration: configuration),
            )
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
            #expect(session.credentials == .object(["kind": .string("gemini-live"), "token": .string("abc"), "model": .string("live-2")]))
            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/voice/sessions"] })
            let sent = try JSONSerialization.jsonObject(with: body) as? [String: String]
            #expect(sent == ["mode": "interview", "role": "Data analyst"])
        }

        @Test func `sends the difficulty only when one was picked`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/voice/sessions"] = (201, #"{"sessionId":"vs_3","mode":"interview","opening":"Hi."}"#)
            }
            _ = try await client.startVoiceSession(.init(mode: .interview, difficulty: .hard))

            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/voice/sessions"] })
            let sent = try JSONSerialization.jsonObject(with: body) as? [String: String]
            #expect(sent == ["mode": "interview", "difficulty": "hard"])
        }

        @Test func `asks for a quick interview by length`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/voice/sessions"] = (201, #"{"sessionId":"vs_4","mode":"interview","opening":"Hi."}"#)
            }
            _ = try await client.startVoiceSession(.quick(target: .role("Barista"), difficulty: .easy))

            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/voice/sessions"] })
            let sent = try JSONSerialization.jsonObject(with: body) as? [String: String]
            #expect(sent == ["mode": "interview", "role": "Barista", "difficulty": "easy", "length": "quick"])
        }

        @Test func `a quick interview with nothing picked lets the server choose the role`() {
            let request = VoiceSessionRequest.quick(target: nil, difficulty: .standard)
            #expect(request == VoiceSessionRequest(mode: .interview, difficulty: .standard, length: .quick))
            let posting = InterviewTarget.posting(id: "p1", title: "Analyst", company: "Acme")
            #expect(VoiceSessionRequest.quick(target: posting, difficulty: .hard).postingId == "p1")
        }

        @Test func `the headset gets the same interview the phone would start`() {
            let posting = InterviewTarget.posting(id: "p1", title: "Analyst", company: "ATB")
            #expect(posting.headsetLaunch(at: "atb") == HeadsetLaunch(mode: .interview, companySlug: "atb", role: "Analyst"))
            #expect(InterviewTarget.role("Designer").headsetLaunch(at: nil) == HeadsetLaunch(mode: .interview, role: "Designer"))
            // a company target keeps its own slug, whatever the picker had chosen
            let company = InterviewTarget.company(slug: "helcim", name: "Helcim")
            #expect(company.headsetLaunch(at: "atb") == HeadsetLaunch(mode: .interview, companySlug: "helcim"))
        }

        @Test func `reads a session saved under the retired networking mode as an interview`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/voice/sessions"] = (201, """
                {"sessionId":"vs_2","mode":"networking","provider":"elevenlabs","credentials":{"kind":"elevenlabs"},"expiresAt":null,
                 "opening":"Hey, I'm Sam."}
                """)
            }
            let session = try await client.startVoiceSession(.init(mode: .interview))

            #expect(session.mode == .interview)
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
            await #expect(throws: SkillitError.rejected(status: 409, message: "this session has ended")) {
                try await client.submitTurn(.init(question: "q", answer: "a", durationMs: 1), in: "vs_9")
            }
        }

        @Test func `finishes with a debrief and ignores extra fields`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/voice/sessions/vs_1/finish"] = (200, """
                {"overall":72,"verdict":"Clear, short on numbers.",
                 "strengths":[{"quote":"2,000 users","why":"Scale made it real."}],
                 "improvements":[{"moment":"the project question","said":"it went well","better":"Say what changed.",
                                  "example":"Reports took an afternoon instead of a day."}],
                 "perQuestion":[{"question":"Why us?","score":72,"oneLineFeedback":"Add the result."}],
                 "nextSteps":["Write one result sentence."],"savedToMemory":true}
                """)
            }
            let debrief = try await client.finishVoiceSession("vs_1")

            #expect(debrief.overall == 72)
            #expect(debrief.strengths == [.init(quote: "2,000 users", why: "Scale made it real.")])
            #expect(debrief.improvements.first?.example == "Reports took an afternoon instead of a day.")
            #expect(debrief.perQuestion.map(\.score) == [72])
            #expect(debrief.nextSteps == ["Write one result sentence."])
        }
    }
}

struct ElevenLabsCredentialsTests {
    @Test func `reads the token and the prompt overrides the server sends`() throws {
        let json = """
        {"kind":"elevenlabs","signedUrl":"wss://x","conversationToken":"tok_1",
         "overrides":{"agent":{"prompt":{"prompt":"Be Eric."}}},"dynamicVariables":{"opening":"Hi, ready?"}}
        """
        let value = try JSONDecoder().decode(JSONValue.self, from: Data(json.utf8))
        let credentials = try #require(ElevenLabsCredentials(value))
        #expect(credentials == .init(conversationToken: "tok_1", prompt: "Be Eric.", opening: "Hi, ready?"))
    }

    @Test func `refuses another provider or a missing token`() {
        #expect(ElevenLabsCredentials(.object(["kind": .string("gemini-live"), "token": .string("t")])) == nil)
        #expect(ElevenLabsCredentials(.object(["kind": .string("elevenlabs"), "signedUrl": .string("wss://x")])) == nil)
        #expect(ElevenLabsCredentials(.null) == nil)
    }
}
