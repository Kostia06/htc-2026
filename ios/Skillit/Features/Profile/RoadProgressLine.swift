import SkillitKit
import SwiftUI

/// "7 of 20 steps on your road · 3-day streak" over a thin teal bar: progress toward the goal in one glance.
struct RoadProgressLine: View {
    let progress: RoadmapProgress
    var fromResume = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(summary)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            ThinProgressBar(fraction: fraction, tint: Theme.positive)
                .accessibilityHidden(true)
        }
        .accessibilityElement(children: .combine)
    }

    private var fraction: Double {
        progress.total == 0 ? 0 : Double(progress.done) / Double(progress.total)
    }

    private var summary: String {
        // the Road's numbers and wording: the trail count, resume steps apart
        let parts = [
            "\(progress.done) of \(progress.total) steps on your road",
            fromResume > 0 ? "+\(fromResume) from your resume" : nil,
            progress.streakDays > 1 ? "\(progress.streakDays)-day streak" : nil,
        ]
        return parts.compactMap(\.self).joined(separator: " · ")
    }
}
