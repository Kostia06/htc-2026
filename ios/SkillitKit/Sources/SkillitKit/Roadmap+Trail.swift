import Foundation

/// The finished part of the road as one trail. Steps copied from the resume are ordinary done steps on it, not a
/// separate group. Mirrors `doneSteps` in web/src/features/roadmap/page.js.
public extension RoadmapPage {
    /// Every finished step, oldest first, so the trail reads top to bottom as the journey so far.
    var doneSteps: [RoadmapStep] {
        completed.reversed().flatMap { $0.steps.reversed() }
    }
}
