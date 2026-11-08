import Foundation
@testable import SkillitKit
import Testing

struct RoadmapTrailTests {
    private func step(_ id: String, why: String = "") -> RoadmapStep {
        RoadmapStep(id: id, kind: .project, title: id, why: why, detail: "", label: .readyNow, estimate: "", status: .done)
    }

    @Test func `resume steps sit on the trail with the rest, oldest first`() {
        let page = RoadmapPage(
            goal: "Analyst", progress: .init(done: 4, total: 10, streakDays: 1), next: [], nextCursor: nil,
            completed: [
                .init(day: "2026-11-07", steps: [step("b"), step("a")]),
                .init(day: "2026-11-01", steps: [step("r2", why: "From your resume"), step("r1", why: "From your resume")]),
            ],
        )
        #expect(page.doneSteps.map(\.id) == ["r1", "r2", "a", "b"])
    }

    @Test func `a road with nothing done has an empty trail`() {
        let page = RoadmapPage(goal: "Analyst", progress: .init(done: 0, total: 5, streakDays: 0), next: [], nextCursor: nil)
        #expect(page.doneSteps.isEmpty)
    }
}
