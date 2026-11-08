import Foundation
@testable import SkillitKit
import Testing

extension StubbedNetworkTests {
    struct ConnectedAppsTests {
        let client = SkillitClientTests.client(accessToken: { "t0k" })

        @Test func `reads the other connected apps next to the curated ones`() async throws {
            let json = #"""
            {"connections":[],"apps":[
              {"slug":"linear","name":"Linear","logo":"https://logos.composio.dev/api/linear","status":"connected"},
              {"slug":"odd","name":"Odd","logo":"javascript:alert(1)","status":"brand_new"}
            ]}
            """#
            StubProtocol.routes.withLock { $0["GET /api/connections"] = (200, json) }
            let apps = try await client.connectedApps()
            #expect(apps.map(\.slug) == ["linear", "odd"])
            #expect(apps[0].isLinked)
            #expect(apps[0].logo?.host() == "logos.composio.dev")
            #expect(apps[1].logo == nil)
            #expect(apps[1].status == .notConnected)
        }

        @Test func `an older server without apps reads as none`() async throws {
            StubProtocol.routes.withLock { $0["GET /api/connections"] = (200, #"{"connections":[]}"#) }
            #expect(try await client.connectedApps().isEmpty)
        }

        @Test func `searches the catalog a page at a time`() async throws {
            let json = #"""
            {"apps":[{"slug":"slack","name":"Slack","category":"team chat","connectable":true,"curated":false},
                     {"slug":"github","name":"GitHub","connectable":true,"curated":true},
                     {"slug":"gitea","name":"Gitea","connectable":false,"curated":false}],
             "next":"Y3Vyc29y","configured":true}
            """#
            StubProtocol.routes.withLock { $0["GET /api/connections/catalog"] = (200, json) }
            let page = try await client.searchApps("sla")
            #expect(page.apps.map(\.slug) == ["slack", "github", "gitea"])
            #expect(page.apps[1].isCurated)
            #expect(!page.apps[2].connectable)
            #expect(page.next == "Y3Vyc29y")
        }

        @Test func `connects an app and refuses a link that isn't https`() async throws {
            let link = #"{"url":"https://connect.composio.dev/link/ln_2"}"#
            StubProtocol.routes.withLock { $0["POST /api/connections/apps/linear"] = (200, link) }
            let url = try await client.connectApp("linear", returnTo: URL(string: "skillit://connections"))
            #expect(url.host() == "connect.composio.dev")
            StubProtocol.routes.withLock { $0["POST /api/connections/apps/linear"] = (200, #"{"url":"http://x"}"#) }
            await #expect(throws: SkillitError.unreadableResponse) { try await client.connectApp("linear", returnTo: nil) }
        }

        @Test func `refuses a slug that could change the path`() async {
            for slug in ["../me", "Linear", "", String(repeating: "a", count: 61), "a/b"] {
                await #expect(throws: SkillitError.unreadableResponse) { try await client.connectApp(slug, returnTo: nil) }
            }
        }

        @Test func `disconnecting answers with the apps left`() async throws {
            StubProtocol.routes.withLock { $0["DELETE /api/connections/apps/google_ads"] = (200, #"{"apps":[]}"#) }
            #expect(try await client.disconnectApp("google_ads").isEmpty)
        }
    }
}
