import Foundation
@testable import SkillitKit
import Testing

extension StubbedNetworkTests {
    struct QuickUpdateTests {
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
                QuickUpdateLine(speaker: .skillit, text: "Which one?"),
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
            #expect(sent["focusStepId"] == nil)
        }

        @Test func `uploads a document as one multipart file and reads what it changed`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/updates/file"] = (200, """
                {"reply":"Added your degree and 3 courses.",
                 "applied":[{"type":"add_education","summary":"Added BSc at University of Calgary"},
                            {"type":"add_course","summary":"Noted 3 courses you've taken"},
                            {"type":"add_certification","summary":"Added certification AWS"}]}
                """)
            }
            let reply = try await client.uploadUpdateFile(ResumeFile(name: "transcript.pdf", data: Data("%PDF-1.7".utf8)))

            #expect(reply.reply == "Added your degree and 3 courses.")
            #expect(!reply.needsAnswer)
            #expect(reply.applied.map(\.touchesProfile) == [true, false, true])
            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/updates/file"] })
            let text = try #require(String(bytes: body, encoding: .utf8))
            #expect(text.contains("name=\"file\"; filename=\"transcript.pdf\""))
            #expect(text.contains("%PDF-1.7"))
        }

        @Test func `names the step a Mark done chat is about`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/updates"] = (200, #"{"reply":"Done.","needsAnswer":false,"applied":[]}"#)
            }
            _ = try await client.quickUpdate(.init(message: "shipped it", focusStepID: "st_1"))
            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/updates"] })
            let sent = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
            #expect(sent["focusStepId"] as? String == "st_1")
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
                $0["POST /api/updates"] = (502, #"{"error":"Skillit couldn't follow that one. Try saying it another way."}"#)
            }
            let message = "Skillit couldn't follow that one. Try saying it another way."
            await #expect(throws: SkillitError.rejected(status: 502, message: message)) {
                try await client.quickUpdate(.init(message: "???"))
            }
        }
    }
}
