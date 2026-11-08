import Foundation
@testable import RavenKit
import Testing

extension StubbedNetworkTests {
    struct MemoriesClientTests {
        let client = RavenClientTests.client(accessToken: { "t0k" })

        @Test func `lists memories`() async throws {
            StubProtocol.routes.withLock {
                $0["GET /api/me/memories"] = (
                    200,
                    #"""
                    {"memories":[{"id":"m1","kind":"goal","text":"Backend internship","createdAt":"2026-11-07T08:00:00.000Z",
                                  "lastUsedAt":"2026-11-07T08:00:00.000Z","uses":2}]}
                    """#,
                )
            }
            let memories = try await client.memories()
            #expect(memories.map(\.kind) == [.goal])
            #expect(memories.first?.uses == 2)
        }

        @Test func `treats a bodiless 204 on delete as success`() async throws {
            StubProtocol.routes.withLock { $0["DELETE /api/me/memories/m1"] = (204, "") }
            try await client.forgetMemory(id: "m1")
        }

        @Test func `a delete refusal still surfaces`() async {
            StubProtocol.routes.withLock { $0["DELETE /api/me/memories/m2"] = (404, #"{"error":"memory not found"}"#) }
            await #expect(throws: RavenError.rejected(status: 404, message: "memory not found")) { try await client.forgetMemory(id: "m2") }
        }

        @Test func `shares a note with the company and role`() async throws {
            StubProtocol.routes.withLock { $0["POST /api/me/memories/m1/share"] = (201, #"{"ok":true}"#) }
            try await client.shareMemory(id: "m1", companySlug: "atb", role: "Analyst")
            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/me/memories/m1/share"] })
            let sent = try #require(JSONSerialization.jsonObject(with: body) as? [String: String])
            #expect(sent == ["companySlug": "atb", "role": "Analyst"])
        }
    }
}
