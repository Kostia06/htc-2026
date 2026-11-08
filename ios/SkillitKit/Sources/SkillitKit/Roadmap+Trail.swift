import Foundation

/// The one definition of "how far along the road" that Road and Profile both show: the steps on the path, with the
/// steps copied from the resume counted apart ("+N from your resume"). Mirrors `trailProgress` in web/src/features/roadmap/page.js.
public extension RoadmapStep {
    /// The server writes this line on steps it copied from the resume.
    var isFromResume: Bool {
        why == "From your resume"
    }
}

public extension RoadmapPage {
    /// Finished steps the resume already showed, oldest first.
    var resumeSteps: [RoadmapStep] {
        completed.reversed().flatMap { $0.steps.reversed() }.filter(\.isFromResume)
    }

    /// The count on the trail only; resume steps are left out of both sides.
    var trailProgress: RoadmapProgress {
        let fromResume = resumeSteps.count
        var progress = progress
        progress.done = max(0, progress.done - fromResume)
        progress.total = max(progress.done, progress.total - fromResume)
        return progress
    }
}
