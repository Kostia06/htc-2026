import Foundation
@testable import SkillitKit
import Testing

extension StubbedNetworkTests {
    @Suite struct OutcomeTests {
        let client = SkillitClientTests.client(accessToken: { "t0k" })

        @Test func `sends the role, company and share choice, and reads back what was shared`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/me/outcome"] = (201, #"{"shared":true,"steps":["course","project"],"skills":["sql"]}"#)
            }
            let result = try await client.recordOutcome(GotTheJob(role: "Data analyst", companySlug: "atb-financial", share: true))
            #expect(result.shared)
            #expect(result.steps == ["course", "project"])

            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/me/outcome"] } ?? nil)
            let sent = try JSONSerialization.jsonObject(with: body) as? [String: Any]
            #expect(sent?["role"] as? String == "Data analyst")
            #expect(sent?["company"] as? String == "atb-financial")
            #expect(sent?["share"] as? Bool == true)
        }

        @Test func `leaves the company out when none was picked`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/me/outcome"] = (201, #"{"shared":false,"steps":[],"skills":[]}"#)
            }
            _ = try await client.recordOutcome(GotTheJob(role: "Designer", companySlug: nil, share: false))
            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/me/outcome"] } ?? nil)
            let sent = try JSONSerialization.jsonObject(with: body) as? [String: Any]
            #expect(sent?["company"] == nil)
        }
    }
}
