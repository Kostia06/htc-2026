import SkillitKit
import SwiftUI

/// The top of the screen: the goal, one big count, a thin bar, and the streak on its own line.
struct ProgressCard: View {
    let goal: String
    let progress: RoadmapProgress
    /// Bigger than largeTitle, like a balance on a finance app, but still scales with Dynamic Type.
    @ScaledMetric(relativeTo: .largeTitle) private var numberSize: CGFloat = 44

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("On the way to \(goal)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .truncationMode(.tail)
            count
            ThinProgressBar(fraction: fraction)
            if progress.streakDays > 0 {
                streak
            }
        }
        .skillitCard()
        .animation(.spring(duration: 0.45), value: progress)
    }

    private var count: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(progress.done, format: .number)
                .font(.system(size: numberSize, weight: .bold, design: .rounded))
                .monospacedDigit()
                .contentTransition(.numericText())
            Text("/ \(progress.total) steps")
                .font(.title3.weight(.medium))
                .foregroundStyle(.secondary)
        }
        .lineLimit(1)
        .minimumScaleFactor(0.6)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(progress.done) of \(progress.total) steps done")
    }

    private var streak: some View {
        Label("\(progress.streakDays)-day streak", systemImage: "flame.fill")
            .font(.footnote.weight(.semibold))
            .foregroundStyle(Theme.action)
            .lineLimit(1)
            .fixedSize()
            .contentTransition(.numericText())
            .transition(.opacity)
    }

    private var fraction: Double {
        progress.total == 0 ? 0 : Double(progress.done) / Double(progress.total)
    }
}
