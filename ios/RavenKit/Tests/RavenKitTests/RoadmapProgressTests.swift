@testable import RavenKit
import Testing

struct RoadmapProgressTests {
    private func step(_ id: String, _ status: RoadmapStep.Status = .todo) -> RoadmapStep {
        RoadmapStep(id: id, kind: .project, title: id, why: "", label: .readyNow, estimate: "", status: status)
    }

    private func page(_ units: [RoadmapUnit], done: Int = 0, cursor: String? = "1") -> RoadmapPage {
        let total = units.reduce(0) { $0 + $1.steps.count }
        return RoadmapPage(goal: "Nurse", summary: .init(done: done, total: total, thisWeek: done), units: units, nextCursor: cursor)
    }

    private func unit(_ index: Int, _ steps: [RoadmapStep]) -> RoadmapUnit {
        RoadmapUnit(index: index, title: "Unit \(index)", summary: "", steps: steps)
    }

    @Test func `the current step is the first one not done or skipped`() {
        let path = page([unit(0, [step("a", .done), step("b", .skipped), step("c", .started), step("d")])], done: 1)
        #expect(path.currentStepID == "c")
        #expect(page([unit(0, [step("a", .done)])], done: 1).currentStepID == nil)
    }

    @Test func `marking a step done counts it, and undoing takes it back`() {
        var path = page([unit(0, [step("a"), step("b")])])
        #expect(path.setStatus(.done, of: "a") == .todo)
        #expect(path.summary == RoadmapSummary(done: 1, total: 2, thisWeek: 1))
        #expect(path.setStatus(.todo, of: "a") == .done)
        #expect(path.summary == RoadmapSummary(done: 0, total: 2, thisWeek: 0))
    }

    @Test func `an unknown step or the same status changes nothing`() {
        var path = page([unit(0, [step("a", .started)])])
        #expect(path.setStatus(.done, of: "zzz") == nil)
        #expect(path.setStatus(.started, of: "a") == nil)
        #expect(path.summary.done == 0)
    }

    @Test func `appending a page adds only new units and takes its summary and cursor`() {
        var path = page([unit(0, [step("a")])])
        path.append(page([unit(0, [step("a")]), unit(1, [step("b"), step("c")])], cursor: nil))
        #expect(path.units.map(\.index) == [0, 1])
        #expect(path.summary.total == 3)
        #expect(path.nextCursor == nil)
    }
}
