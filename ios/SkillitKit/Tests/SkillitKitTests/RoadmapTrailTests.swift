import Foundation
@testable import SkillitKit
import Testing

struct RoadmapTrailTests {
    private func step(_ id: String, why: String = "", status: RoadmapStep.Status = .done) -> RoadmapStep {
        RoadmapStep(id: id, kind: .project, title: id, why: why, detail: "", label: .readyNow, estimate: "", status: status)
    }

    @Test func `the trail count leaves resume steps out of both sides`() {
        let page = RoadmapPage(
            goal: "Analyst", progress: .init(done: 9, total: 48, streakDays: 2), next: [step("n", status: .todo)], nextCursor: nil,
            completed: [
                .init(day: "2026-11-07", steps: [step("a"), step("b")]),
                .init(day: "2026-11-01", steps: (1 ... 7).map { step("r\($0)", why: "From your resume") }),
            ],
        )
        #expect(page.resumeSteps.count == 7)
        #expect(page.trailProgress == .init(done: 2, total: 41, streakDays: 2))
    }

    @Test func `without resume steps the trail is the whole road`() {
        let page = RoadmapPage(goal: "Analyst", progress: .init(done: 1, total: 5, streakDays: 0), next: [], nextCursor: nil)
        #expect(page.trailProgress == page.progress)
    }
}
