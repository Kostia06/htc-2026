import Foundation
@testable import SkillitKit
import Testing

extension StubbedNetworkTests {
    struct FeedSavedTests {
        let client = SkillitClientTests.client(accessToken: { "t0k" })

        @Test func `posts an unsave for one card`() async throws {
            let route = "POST /api/feed/items/course:cs50x"
            StubProtocol.routes.withLock { $0[route] = (200, #"{"id":"course:cs50x","action":"unsave"}"#) }
            try await client.unsave(cardId: "course:cs50x")
            let body = try #require(StubProtocol.bodies.withLock { $0[route] })
            #expect(String(bytes: body, encoding: .utf8) == #"{"action":"unsave"}"#)
        }

        @Test func `a refused unsave throws so the bookmark can fill again`() async {
            StubProtocol.routes.withLock { $0["POST /api/feed/items/course:odin"] = (500, #"{"error":"boom"}"#) }
            await #expect(throws: SkillitError.self) { try await client.unsave(cardId: "course:odin") }
        }
    }
}
