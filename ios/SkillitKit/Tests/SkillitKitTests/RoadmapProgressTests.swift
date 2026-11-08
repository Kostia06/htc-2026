import Foundation
@testable import SkillitKit
import Testing

struct RoadmapProgressTests {
    private let utc = TimeZone(identifier: "UTC")!
    private let noon = Date(timeIntervalSince1970: 1_793_880_000) // 2026-11-05T12:00:00Z

    private func step(_ id: String, _ status: RoadmapStep.Status = .todo) -> RoadmapStep {
        RoadmapStep(id: id, kind: .project, title: id, why: "", detail: "", label: .readyNow, estimate: "", status: status)
    }

    private func page(_ next: [RoadmapStep], completed: [CompletedDay] = [], done: Int = 0, cursor: String? = "6") -> RoadmapPage {
        let total = next.count + completed.reduce(0) { $0 + $1.steps.count }
        return RoadmapPage(
            goal: "Nurse", progress: .init(done: done, total: total, streakDays: completed.isEmpty ? 0 : 1),
            next: next, nextCursor: cursor, completed: completed,
        )
    }

    @Test func `the day key matches the server's yyyy-MM-dd in the given zone`() throws {
        #expect(RoadmapPage.dayKey(noon, timeZone: utc) == "2026-11-05")
        let edmonton = try #require(TimeZone(identifier: "America/Edmonton"))
        let lateEvening = Date(timeIntervalSince1970: 1_793_937_600) // 2026-11-06T04:00:00Z
        #expect(RoadmapPage.dayKey(lateEvening, timeZone: utc) == "2026-11-06")
        #expect(RoadmapPage.dayKey(lateEvening, timeZone: edmonton) == "2026-11-05")
    }

    @Test func `completing a step moves it into a new day at the top and counts it`() {
        var path = page([step("a"), step("b")])
        let previous = path.complete("a", note: "Shipped it", at: noon, timeZone: utc)

        #expect(previous?.status == .todo)
        #expect(path.next.map(\.id) == ["b"])
        #expect(path.completed.map(\.day) == ["2026-11-05"])
        #expect(path.completed[0].steps[0].status == .done)
        #expect(path.completed[0].steps[0].note == "Shipped it")
        #expect(path.progress == RoadmapProgress(done: 1, total: 2, streakDays: 1))
    }

    @Test func `a second step the same day joins the existing group first, with an empty note dropped`() {
        var path = page([step("b")], completed: [CompletedDay(day: "2026-11-05", steps: [step("a", .done)])], done: 1)
        path.complete("b", note: "", at: noon, timeZone: utc)
        #expect(path.completed.count == 1)
        #expect(path.completed[0].steps.map(\.id) == ["b", "a"])
        #expect(path.completed[0].steps[0].note == nil)
        #expect(path.progress.streakDays == 1)
    }

    @Test func `restoring puts the step back at the front and removes an emptied day`() throws {
        var path = page([step("a"), step("b")])
        let completed = path.complete("a", note: nil, at: noon, timeZone: utc)
        let previous = try #require(completed)
        path.restore(previous)
        #expect(path.next.map(\.id) == ["a", "b"])
        #expect(path.completed.isEmpty)
        #expect(path.progress == RoadmapProgress(done: 0, total: 2, streakDays: 0))
    }

    @Test func `an unknown step changes nothing`() {
        var path = page([step("a")])
        #expect(path.complete("zzz", note: nil, at: noon, timeZone: utc) == nil)
        #expect(path.progress.done == 0)
    }

    @Test func `appending a page adds only new open steps and takes its progress, cursor and days`() {
        var path = page([step("a")])
        let days = [CompletedDay(day: "2026-11-04", steps: [step("z", .done)])]
        let more = page([step("a"), step("b")], completed: days, done: 1, cursor: nil)
        path.append(more)
        #expect(path.next.map(\.id) == ["a", "b"])
        #expect(path.progress.done == 1)
        #expect(path.nextCursor == nil)
        #expect(path.completed.map(\.day) == ["2026-11-04"])
    }

    @Test func `replacing swaps in the server's copy wherever the step sits`() {
        var path = page([step("a")], completed: [CompletedDay(day: "2026-11-04", steps: [step("z", .done)])], done: 1)
        var fromServer = step("z", .done)
        fromServer.note = "from server"
        path.replace(fromServer)
        #expect(path.completed[0].steps[0].note == "from server")
    }
}
