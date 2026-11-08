import Foundation
@testable import RavenKit
import Testing

extension StubbedNetworkTests {
    struct QuickUpdateTests {
        let client: RavenClient

        init() {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.protocolClasses = [StubProtocol.self]
            client = RavenClient(
                baseURL: URL(string: "https://api.test")!,
                accessToken: { "t0k" },
                session: URLSession(configuration: configuration)
            )
        }

        @Test func `sends the update with the conversation so far and reads what was applied`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/updates"] = (200, """
                {"reply":"Nice, the Flask dashboard is done.","needsAnswer":false,
                 "applied":[{"type":"complete_step","summary":"Marked \\"Build a Flask dashboard\\" done"},
                            {"type":"add_skill","summary":"Added skill Flask"}]}
                """)
            }
            let conversation = [
                QuickUpdateLine(speaker: .user, text: "finished my project"),
                QuickUpdateLine(speaker: .raven, text: "Which one?"),
            ]
            let reply = try await client.quickUpdate(.init(message: "the Flask one", conversation: conversation))

            #expect(reply.reply == "Nice, the Flask dashboard is done.")
            #expect(!reply.needsAnswer)
            #expect(reply.applied.map(\.summary) == ["Marked \"Build a Flask dashboard\" done", "Added skill Flask"])
            #expect(reply.applied.map(\.touchesProfile) == [false, true])

            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/updates"] })
            let sent = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
            #expect(sent["message"] as? String == "the Flask one")
            let lines = [["speaker": "user", "text": "finished my project"], ["speaker": "raven", "text": "Which one?"]]
            #expect(sent["conversation"] as? [[String: String]] == lines)
        }

        @Test func `reads a clarifying question with nothing applied`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/updates"] =
                    (200, #"{"reply":"Which one: the Flask dashboard or the portfolio site?","needsAnswer":true,"applied":[]}"#)
            }
            let reply = try await client.quickUpdate(.init(message: "finished my project"))
            #expect(reply == QuickUpdateReply(reply: "Which one: the Flask dashboard or the portfolio site?", needsAnswer: true))
        }

        @Test func `surfaces the server's line when it could not follow`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/updates"] = (502, #"{"error":"Raven couldn't follow that one. Try saying it another way."}"#)
            }
            await #expect(throws: RavenError.rejected(status: 502, message: "Raven couldn't follow that one. Try saying it another way.")) {
                try await client.quickUpdate(.init(message: "???"))
            }
        }
    }
}
