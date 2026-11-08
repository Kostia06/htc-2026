import Foundation
@testable import RavenKit
import Testing

extension StubbedNetworkTests {
    struct RoadmapTests {
        let client: RavenClient

        init() {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.protocolClasses = [StubProtocol.self]
            client = RavenClient(
                baseURL: URL(string: "https://api.test")!,
                accessToken: { "t0k" },
                session: URLSession(configuration: configuration),
            )
        }

        @Test func `reads a page with its completed days and keeps unknown kinds visible`() async throws {
            StubProtocol.routes.withLock {
                $0["GET /api/roadmap"] = (200, """
                {"goal":"Junior data analyst","progress":{"done":1,"total":8,"streakDays":1},"nextCursor":"6",
                 "next":[
                   {"id":"st_1","kind":"interview_practice","title":"Mock interview","why":"Practice.","detail":"Say it out loud.",
                    "label":"ready_now","estimate":"15 min","status":"todo","completedAt":null,"note":null,
                    "action":{"type":"interview","role":"Junior data analyst"}},
                   {"id":"st_2","kind":"podcast","title":"Start a podcast","why":"Reach.","detail":"",
                    "label":"long_term","estimate":"","status":"todo"}],
                 "completed":[{"day":"2026-11-07","steps":[
                   {"id":"st_0","kind":"project","title":"Ship it","why":"","detail":"","label":"ready_now","estimate":"2 h",
                    "status":"done","completedAt":"2026-11-07T18:00:00Z","note":"github.com/me/dash"}]}]}
                """)
            }
            let page = try await client.roadmap()

            #expect(page.progress == RoadmapProgress(done: 1, total: 8, streakDays: 1))
            #expect(page.nextCursor == "6")
            #expect(page.next.map(\.kind) == [.interviewPractice, .project])
            #expect(page.next[0].action == RoadmapAction(type: .interview, role: "Junior data analyst"))
            #expect(page.next[1].action == nil)
            #expect(page.completed.map(\.day) == ["2026-11-07"])
            #expect(page.completed[0].steps[0].note == "github.com/me/dash")
            #expect(page.completed[0].steps[0].status == .done)
        }

        @Test func `sends the time zone always and the cursor only when there is one`() async throws {
            let zone = try #require(TimeZone(identifier: "America/Edmonton"))
            #expect(try await client.roadmapRequest(cursor: nil, timeZone: zone).url?.query() == "tz=America/Edmonton")
            #expect(try await client.roadmapRequest(cursor: "3", timeZone: zone).url?.query() == "cursor=3&tz=America/Edmonton")
        }

        @Test func `posts a status with a note and reads the step back`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/roadmap/steps/st_1"] = (200, """
                {"id":"st_1","kind":"project","title":"Ship it","why":"","detail":"","label":"ready_now","estimate":"2 h",
                 "status":"done","completedAt":"2026-11-07T18:00:00Z","note":"Built the dashboard"}
                """)
            }
            let step = try await client.update(step: "st_1", status: .done, note: "Built the dashboard")
            #expect(step.status == .done)
            #expect(step.note == "Built the dashboard")

            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/roadmap/steps/st_1"] })
            #expect(try JSONSerialization.jsonObject(with: body) as? [String: String] == ["status": "done", "note": "Built the dashboard"])
        }
    }
}
