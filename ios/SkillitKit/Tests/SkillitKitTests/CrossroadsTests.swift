import Foundation
@testable import SkillitKit
import Testing

extension StubbedNetworkTests {
    struct CrossroadsClientTests {
        let client = SkillitClientTests.client(accessToken: { "t0k" })

        @Test func `decodes the screen, keeping examples uncounted`() async throws {
            StubProtocol.routes.withLock {
                $0["GET /api/crossroads"] = (
                    200,
                    #"""
                    {"road":{"goal":"Junior data analyst","lane":"data","laneName":"data"},
                     "you":[{"id":"m1","kind":"weakness","text":"Froze on SQL joins","source":"memory"},
                            {"id":"profile_skill_0","kind":"skill","text":"Excel","source":"profile"}],
                     "everyone":[{"id":"ex_data_struggle_1","kind":"struggle","text":"Froze on joins","people":null,
                                  "example":true,"meToo":false},
                                 {"id":"r1","kind":"tip","text":"Open data dashboards","people":4,"example":false,"meToo":true},
                                 {"id":"r2","kind":"brand_new_kind","text":"?","people":3,"example":false,"meToo":false}],
                     "research":[{"id":"f1","company":"Arcurve","slug":"arcurve","kind":"hiring","text":"Hires juniors",
                                  "sourceUrl":"https://www.arcurve.com/careers",
                                  "sourceHost":"arcurve.com","fetchedAt":"2026-11-05T00:00:00Z","ageDays":3}],
                     "links":[{"you":"m1","everyone":"ex_data_struggle_1","score":0.81}],
                     "trails":[{"id":"t1","role":"Junior Data Analyst","people":null,"example":true,
                                "steps":["course","teleport","project"],"skills":["sql"]}],
                     "badges":[],"minPeople":3}
                    """#
                )
            }
            let view = try await client.crossroads()
            #expect(view.road.lane == "data")
            #expect(view.you.map(\.source) == [.memory, .profile])
            #expect(view.everyone.first?.people == nil)
            #expect(view.everyone.first?.example == true)
            #expect(view.everyone.last?.kind == .tip)
            #expect(view.links.first?.score == 0.81)
            #expect(view.trails.first?.steps == [.course, .project])
            #expect(view.research.first?.ageDays == 3)
        }

        @Test func `asks with the conversation and decodes cites`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/crossroads/ask"] = (
                    200,
                    #"{"reply":"For example, many froze on joins.","needsAnswer":false,"cites":[{"type":"you","id":"m1"}]}"#,
                )
            }
            let request = QuickUpdateRequest(message: "Is this common?", conversation: [QuickUpdateLine(speaker: .skillit, text: "Ask me")])
            let answer = try await client.askCrossroads(request)
            #expect(answer.cites == [CrossroadsCite(type: .you, id: "m1")])
            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/crossroads/ask"] })
            let sent = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
            #expect(sent["message"] as? String == "Is this common?")
        }

        @Test func `adds a line to the road`() async throws {
            StubProtocol.routes.withLock { $0["POST /api/crossroads/lines/ex_tip/add-to-road"] = (201, #"{"added":true}"#) }
            try await client.addToRoad(lineID: "ex_tip")
        }

        @Test func `me too returns nil while the line is still hidden`() async throws {
            StubProtocol.routes.withLock { $0["POST /api/crossroads/lines/r9/me-too"] = (200, #"{"meToo":true,"line":null}"#) }
            #expect(try await client.standBehind(lineID: "r9", true) == nil)
        }

        @Test func `reads the crossroads step and its travelled badge`() throws {
            let json = #"""
            {"id":"st_1","kind":"explore_memory","title":"See what others learned","action":{"type":"crossroads"},
             "travelled":{"people":5,"reached":"Junior Data Analyst"}}
            """#
            let step = try JSONDecoder().decode(RoadmapStep.self, from: Data(json.utf8))
            #expect(step.kind == .exploreMemory)
            #expect(step.action?.type == .crossroads)
            #expect(step.travelled == RoadmapStep.Travelled(people: 5, reached: "Junior Data Analyst"))
        }
    }
}
