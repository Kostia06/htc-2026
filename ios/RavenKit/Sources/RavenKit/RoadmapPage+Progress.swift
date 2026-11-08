import Foundation

public extension RoadmapPage {
    /// Adds the open steps this page doesn't have yet; the newer page's progress, cursor and completed days win.
    mutating func append(_ page: RoadmapPage) {
        let known = Set(next.map(\.id))
        next += page.next.filter { !known.contains($0.id) }
        progress = page.progress
        nextCursor = page.nextCursor
        completed = page.completed
    }

    /// Moves an open step into today's completed group at once, before the server has answered.
    /// Returns the step as it was, so a refused change can be put back with `restore`.
    @discardableResult
    mutating func complete(_ stepID: String, note: String?, at now: Date = .now, timeZone: TimeZone = .current) -> RoadmapStep? {
        guard let index = next.firstIndex(where: { $0.id == stepID }) else { return nil }
        let previous = next.remove(at: index)
        var finished = previous
        finished.status = .done
        finished.completedAt = now.ISO8601Format()
        finished.note = note.flatMap { $0.isEmpty ? nil : $0 }

        let day = Self.dayKey(now, timeZone: timeZone)
        if completed.first?.day == day {
            completed[0].steps.insert(finished, at: 0)
        } else {
            completed.insert(CompletedDay(day: day, steps: [finished]), at: 0)
            progress.streakDays += 1
        }
        progress.done += 1
        return previous
    }

    /// Undoes `complete`: puts the step back where it was in the open list and takes it out of the completed days.
    mutating func restore(_ step: RoadmapStep) {
        for dayIndex in completed.indices {
            guard let stepIndex = completed[dayIndex].steps.firstIndex(where: { $0.id == step.id }) else { continue }
            completed[dayIndex].steps.remove(at: stepIndex)
            if completed[dayIndex].steps.isEmpty {
                completed.remove(at: dayIndex)
                progress.streakDays = max(0, progress.streakDays - 1)
            }
            progress.done = max(0, progress.done - 1)
            break
        }
        next.insert(step, at: 0)
    }

    /// Replaces a step wherever it sits with what the server returned.
    mutating func replace(_ step: RoadmapStep) {
        if let index = next.firstIndex(where: { $0.id == step.id }) {
            next[index] = step
        }
        for dayIndex in completed.indices {
            if let index = completed[dayIndex].steps.firstIndex(where: { $0.id == step.id }) {
                completed[dayIndex].steps[index] = step
            }
        }
    }

    /// The same `yyyy-MM-dd` key the server uses for `CompletedDay.day`.
    static func dayKey(_ date: Date, timeZone: TimeZone = .current) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}
