import Foundation
@testable import SkillitKit
import Testing

extension StubbedNetworkTests {
    struct ConnectionsTests {
        let client = SkillitClientTests.client(accessToken: { "t0k" })

        @Test func `reads the GitHub state with its imported projects`() async throws {
            let projects = #"[{"name":"budget-bot","summary":"A bot","language":"Python"},{"name":"dotfiles"}]"#
            let json = #"{"github":{"configured":true,"status":"connected","importing":false,"projects":"#
                + projects + #","suggestions":["Add a README to dotfiles."]}}"#
            StubProtocol.routes.withLock { $0["GET /api/connections"] = (200, json) }
            let github = try await client.githubConnection()
            #expect(github.status == .connected)
            #expect(github.projects.map(\.name) == ["budget-bot", "dotfiles"])
            #expect(github.projects[1].summary == nil)
            #expect(github.suggestions == ["Add a README to dotfiles."])
        }

        @Test func `treats an unknown status as not connected`() async throws {
            let json = #"{"github":{"configured":false,"status":"brand_new"}}"#
            StubProtocol.routes.withLock { $0["GET /api/connections"] = (200, json) }
            let github = try await client.githubConnection()
            #expect(github.status == .notConnected)
            #expect(!github.configured)
        }

        @Test func `asks for a sign-in link that returns to the app`() async throws {
            let json = #"{"url":"https://connect.composio.dev/link/ln_1"}"#
            StubProtocol.routes.withLock { $0["POST /api/connections/github"] = (200, json) }
            let url = try await client.connectGithub(returnTo: URL(string: "skillit://connections/github"))
            #expect(url.absoluteString == "https://connect.composio.dev/link/ln_1")
            let sent = StubProtocol.bodies.withLock { $0["POST /api/connections/github"] } ?? Data()
            #expect(String(data: sent, encoding: .utf8)?.contains(#"skillit:\/\/connections\/github"#) == true)
        }

        @Test func `refuses a sign-in link that isn't https`() async {
            StubProtocol.routes.withLock { $0["POST /api/connections/github"] = (200, #"{"url":"javascript:alert(1)"}"#) }
            await #expect(throws: SkillitError.unreadableResponse) { try await client.connectGithub(returnTo: nil) }
        }

        @Test func `says when GitHub isn't set up on the server`() async {
            let json = #"{"error":"GitHub isn't set up on this server yet","configured":false}"#
            StubProtocol.routes.withLock { $0["POST /api/connections/github"] = (503, json) }
            await #expect(throws: SkillitError.rejected(status: 503, message: "GitHub isn't set up on this server yet")) {
                try await client.connectGithub(returnTo: nil)
            }
        }

        @Test func `disconnects`() async throws {
            let json = #"{"github":{"configured":true,"status":"not_connected","projects":[],"suggestions":[]}}"#
            StubProtocol.routes.withLock { $0["DELETE /api/connections/github"] = (200, json) }
            #expect(try await client.disconnectGithub().status == .notConnected)
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
