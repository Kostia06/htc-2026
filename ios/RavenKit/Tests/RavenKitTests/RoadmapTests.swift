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

        @Test func `reads a page and keeps unknown kinds visible`() async throws {
            StubProtocol.routes.withLock {
                $0["GET /api/roadmap"] = (200, """
                {"goal":"Junior data analyst","summary":{"done":1,"total":4,"thisWeek":1},"nextCursor":"1",
                 "units":[{"index":0,"title":"Basics","summary":"Start small.","source":"agent","steps":[
                   {"id":"st_1","kind":"interview_practice","title":"Mock interview","why":"Practice.","label":"ready_now",
                    "estimate":"1 hour","status":"done"},
                   {"id":"st_2","kind":"podcast","title":"Start a podcast","why":"Reach.",
                    "label":"long_term","estimate":"","status":"todo"}]}]}
                """)
            }
            let page = try await client.roadmap()

            #expect(page.summary == RoadmapSummary(done: 1, total: 4, thisWeek: 1))
            #expect(page.nextCursor == "1")
            #expect(page.units[0].steps.map(\.kind) == [.interviewPractice, .project])
            #expect(page.units[0].steps.map(\.label) == [.readyNow, .longTerm])
            #expect(page.units[0].steps[0].status == .done)
        }

        @Test func `sends the cursor as a query item only when there is one`() async throws {
            #expect(try await client.roadmapRequest(cursor: nil).url?.query() == nil)
            #expect(try await client.roadmapRequest(cursor: "3").url?.query() == "cursor=3")
        }

        @Test func `posts a step status`() async throws {
            StubProtocol.routes.withLock { $0["POST /api/roadmap/steps/st_1"] = (200, #"{"id":"st_1","status":"started"}"#) }
            try await client.setStatus(.started, ofStep: "st_1")

            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/roadmap/steps/st_1"] })
            #expect(try JSONSerialization.jsonObject(with: body) as? [String: String] == ["status": "started"])
        }
    }
}
