import Foundation
@testable import SkillitKit
import Testing

struct CrossroadsInsightTests {
    private func view(trails: [Trail], done: [RoadmapStep.Kind]?) -> Crossroads {
        Crossroads(
            road: .init(goal: "Junior data analyst", lane: "data", laneName: "data"), you: [], everyone: [],
            trails: trails, yourRoad: done.map { YourRoad(done: $0) },
        )
    }

    @Test func `counts what the person did of the first path, each kind once`() throws {
        let trail = Trail(id: "t1", role: "Junior Data Analyst", people: 5, steps: [.course, .project, .course, .application])
        let insight = try #require(view(trails: [trail], done: [.course, .volunteering]).pathInsight)
        #expect(insight.steps == [.course, .project, .application])
        #expect(insight.doneCount == 1)
        #expect(insight.next == .project)
        #expect(insight.people == 5)
        #expect(!insight.isExample)
    }

    @Test func `an example path has no people, and an old server means nothing done`() throws {
        let trail = Trail(id: "t2", role: "BI Analyst", people: 9, example: true, steps: [.course, .exploreMemory])
        let insight = try #require(view(trails: [trail], done: nil).pathInsight)
        #expect(insight.isExample)
        #expect(insight.steps == [.course])
        #expect(insight.doneCount == 0)
    }

    @Test func `no trails, no insight`() {
        #expect(view(trails: [], done: []).pathInsight == nil)
    }

    @Test func `decodes the person's road`() throws {
        let json = #"{"done":["course","teleport"],"added":["ex_tip"]}"#
        let road = try JSONDecoder().decode(YourRoad.self, from: Data(json.utf8))
        #expect(road == YourRoad(done: [.course], added: ["ex_tip"]))
    }
}
