import Foundation
@testable import SkillitKit
import Testing

extension StubbedNetworkTests {
    struct ConnectionsTests {
        let client = SkillitClientTests.client(accessToken: { "t0k" })

        private static let listJSON = #"""
        {"connections":[
          {"id":"github","name":"GitHub","category":"code","reads":"Reads your public repos. Never posts.","configured":true,
           "status":"connected","importing":false,"suggestions":["Add a README to dotfiles."],
           "projects":[{"name":"budget-bot","summary":"A bot","language":"Python"},{"name":"dotfiles"}]},
          {"id":"dribbble","name":"Dribbble","category":"design","reads":"Reads your published shots.","configured":false,
           "status":"not_connected","importing":false,"projects":[],"suggestions":[]},
          {"id":"myspace","name":"Myspace","category":"music","reads":"x","configured":true,"status":"brand_new"}
        ]}
        """#

        @Test func `reads every provider with its imported projects`() async throws {
            StubProtocol.routes.withLock { $0["GET /api/connections"] = (200, Self.listJSON) }
            let connections = try await client.workConnections()
            #expect(connections.map(\.id) == ["github", "dribbble", "myspace"])
            let github = try #require(connections.first)
            #expect(github.status == .connected)
            #expect(github.projects.map(\.name) == ["budget-bot", "dotfiles"])
            #expect(github.projects[0].detail == "Python")
            #expect(github.projects[1].summary == nil)
            #expect(github.suggestions == ["Add a README to dotfiles."])
            #expect(!connections[1].configured)
        }

        @Test func `treats an unknown status or category leniently`() async throws {
            StubProtocol.routes.withLock { $0["GET /api/connections"] = (200, Self.listJSON) }
            let unknown = try await client.workConnections()[2]
            #expect(unknown.status == .notConnected)
            #expect(unknown.category == .other)
        }

        @Test func `filters by name or by the kind of work`() {
            let all = [
                WorkConnection.preview(id: "github", name: "GitHub", category: .code),
                WorkConnection.preview(id: "dribbble", name: "Dribbble", category: .design),
                WorkConnection.preview(id: "notion", name: "Notion", category: .writing),
                WorkConnection.preview(id: "youtube", name: "YouTube", category: .video),
            ]
            #expect(all.matching("").count == 4)
            #expect(all.matching("  ").count == 4)
            #expect(all.matching("design").map(\.id) == ["dribbble"])
            #expect(all.matching("Code").map(\.id) == ["github"])
            #expect(all.matching("writ").map(\.id) == ["notion"])
            #expect(all.matching("video").map(\.id) == ["youtube"])
            #expect(all.matching("git").map(\.id) == ["github"])
            #expect(all.matching("zzz").isEmpty)
        }

        @Test func `asks for a sign-in link that returns to the app`() async throws {
            let json = #"{"url":"https://connect.composio.dev/link/ln_1"}"#
            StubProtocol.routes.withLock { $0["POST /api/connections/notion"] = (200, json) }
            let url = try await client.connect("notion", returnTo: URL(string: "skillit://connections/notion"))
            #expect(url.absoluteString == "https://connect.composio.dev/link/ln_1")
            let sent = StubProtocol.bodies.withLock { $0["POST /api/connections/notion"] } ?? Data()
            #expect(String(data: sent, encoding: .utf8)?.contains(#"skillit:\/\/connections\/notion"#) == true)
        }

        @Test func `refuses a sign-in link that isn't https`() async {
            StubProtocol.routes.withLock { $0["POST /api/connections/github"] = (200, #"{"url":"javascript:alert(1)"}"#) }
            await #expect(throws: SkillitError.unreadableResponse) { try await client.connect("github", returnTo: nil) }
        }

        @Test func `refuses a provider id that could change the path`() async {
            await #expect(throws: SkillitError.unreadableResponse) { try await client.connect("../me", returnTo: nil) }
        }

        @Test func `says when a provider isn't set up on the server`() async {
            let json = #"{"error":"GitHub isn't set up on this server yet","configured":false}"#
            StubProtocol.routes.withLock { $0["POST /api/connections/github"] = (503, json) }
            await #expect(throws: SkillitError.rejected(status: 503, message: "GitHub isn't set up on this server yet")) {
                try await client.connect("github", returnTo: nil)
            }
        }

        @Test func `disconnects one provider`() async throws {
            let json = #"{"connection":{"id":"notion","name":"Notion","category":"writing","configured":true,"status":"not_connected"}}"#
            StubProtocol.routes.withLock { $0["DELETE /api/connections/notion"] = (200, json) }
            let notion = try await client.disconnect("notion")
            #expect(notion.status == .notConnected)
            #expect(notion.id == "notion")
        }

        @Test func `uploads the LinkedIn PDF and keeps suggestions it understands`() async throws {
            let suggestions = #"[{"area":"headline","quote":"Student","suggestion":"Say the role","why":"Clearer"},"#
                + #"{"area":"photo","quote":"x","suggestion":"y","why":"z"}]"#
            let json = #"{"targetRole":"Data analyst","droppedClaims":0,"suggestions":"# + suggestions + "}"
            StubProtocol.routes.withLock { $0["POST /api/resume/linkedin"] = (200, json) }
            let review = try await client.reviewLinkedin(ResumeFile(name: "Profile.pdf", data: Data("%PDF-1.7".utf8)))
            #expect(review.targetRole == "Data analyst")
            #expect(review.suggestions.map(\.area) == [.headline])
            let sent = StubProtocol.bodies.withLock { $0["POST /api/resume/linkedin"] } ?? Data()
            #expect(String(data: sent, encoding: .utf8)?.contains(#"filename="Profile.pdf""#) == true)
        }
    }
}
