import Foundation
@testable import SkillitKit
import Testing

extension StubbedNetworkTests {
    struct RecapTests {
        let client: SkillitClient

        init() {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.protocolClasses = [StubProtocol.self]
            client = SkillitClient(
                baseURL: URL(string: "https://api.test")!,
                accessToken: { "t0k" },
                session: URLSession(configuration: configuration)
            )
        }

        @Test func `sends the message with the whole history and reads a clarifying question`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/recap"] = (200, #"{"reply":"Which company was it?","done":false}"#)
            }
            let history = [RecapMessage(role: .skillit, text: "How did your interview go?")]
            let reply = try await client.recapTurn(.init(companySlug: "atb", message: "It went okay", history: history))

            #expect(reply == RecapReply(reply: "Which company was it?", done: false))
            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/recap"] })
            let sent = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
            #expect(sent["companySlug"] as? String == "atb")
            #expect(sent["message"] as? String == "It went okay")
            #expect((sent["history"] as? [[String: String]])?.first?["role"] == "raven")
        }

        @Test func `reads a finished recap with what was shared`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/recap"] = (200, """
                {"reply":"Got it: 2 questions from ATB's technical round. I'll share them anonymously.","done":true,"shared":true,
                 "extracted":{"company":"ATB Financial","role":"Junior data analyst","round":"technical",
                 "questions":["Explain a left join","How would you find a slow query?"]}}
                """)
            }
            let reply = try await client.recapTurn(.init(message: "ATB technical round...", history: []))

            #expect(reply.done)
            #expect(reply.shared)
            #expect(reply.extracted?.company == "ATB Financial")
            #expect(reply.extracted?.questions.count == 2)
            #expect(reply.extracted?.tip == nil)
        }

        @Test func `starts a voice recap and hands the transcript back`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/recap/voice"] = (201, """
                {"sessionId":"rv_1","opening":"How did your interview go? Tell me like you'd tell a friend.","provider":"elevenlabs",
                 "credentials":{"kind":"elevenlabs","signedUrl":"wss://x"},"expiresAt":null}
                """)
                $0["POST /api/recap/voice/rv_1/finish"] =
                    (200, #"{"reply":"Thanks!","done":true,"shared":false,"extracted":{"questions":[]}}"#)
            }
            let start = try await client.startRecapVoice(companySlug: nil)
            #expect(start.id == "rv_1")
            #expect(start.credentials == .object(["kind": .string("elevenlabs"), "signedUrl": .string("wss://x")]))

            let transcript: [RecapTranscriptLine] = [.init(speaker: .skillit, text: "How did it go?"), .init(speaker: .user, text: "Fine")]
            let reply = try await client.finishRecapVoice("rv_1", transcript: transcript)
            #expect(reply == RecapReply(reply: "Thanks!", done: true, extracted: RecapExtracted(questions: []), shared: false))
            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/recap/voice/rv_1/finish"] })
            let sent = try #require(JSONSerialization.jsonObject(with: body) as? [String: [[String: String]]])
            #expect(sent["transcript"] == [["speaker": "raven", "text": "How did it go?"], ["speaker": "user", "text": "Fine"]])
        }
    }
}
