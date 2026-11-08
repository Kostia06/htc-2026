public extension RoadmapPage {
    /// The first step not yet done or skipped: where the person is on the path.
    var currentStepID: String? {
        steps.first { $0.status == .todo || $0.status == .started }?.id
    }

    var steps: [RoadmapStep] {
        units.flatMap(\.steps)
    }

    /// Adds the units this page doesn't have yet; the newer page's summary and cursor win.
    mutating func append(_ next: RoadmapPage) {
        let known = Set(units.map(\.index))
        units += next.units.filter { !known.contains($0.index) }
        summary = next.summary
        nextCursor = next.nextCursor
    }

    /// Changes one step and keeps the counts in step with it. Returns the old status, or nil when nothing changed.
    @discardableResult
    mutating func setStatus(_ status: RoadmapStep.Status, of stepID: String) -> RoadmapStep.Status? {
        for unitIndex in units.indices {
            guard let stepIndex = units[unitIndex].steps.firstIndex(where: { $0.id == stepID }) else { continue }
            let previous = units[unitIndex].steps[stepIndex].status
            guard previous != status else { return nil }
            units[unitIndex].steps[stepIndex].status = status
            let change = (status == .done ? 1 : 0) - (previous == .done ? 1 : 0)
            summary.done += change
            summary.thisWeek = max(0, summary.thisWeek + change)
            return previous
        }
        return nil
    }
}
