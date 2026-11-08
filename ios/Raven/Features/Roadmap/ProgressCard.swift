import RavenKit
import SwiftUI

/// The top of the screen: the goal, one big count, a thin bar, and the streak.
struct ProgressCard: View {
    let goal: String
    let progress: RoadmapProgress
    /// Bigger than largeTitle, like a balance on a finance app, but still scales with Dynamic Type.
    @ScaledMetric(relativeTo: .largeTitle) private var numberSize: CGFloat = 40

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("On the way to \(goal)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(progress.done) of \(progress.total)")
                    .font(.system(size: numberSize, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .contentTransition(.numericText())
                Text("done")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                Spacer(minLength: 12)
                if progress.streakDays > 0 {
                    streak
                }
            }
            .accessibilityElement(children: .combine)
            ThinProgressBar(fraction: fraction)
        }
        .ravenCard()
        .animation(.spring(duration: 0.45), value: progress)
    }

    private var streak: some View {
        Label("\(progress.streakDays)-day streak", systemImage: "flame.fill")
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.action)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Theme.action.opacity(0.15), in: .capsule)
            .contentTransition(.numericText())
            .transition(.scale.combined(with: .opacity))
    }

    private var fraction: Double {
        progress.total == 0 ? 0 : Double(progress.done) / Double(progress.total)
    }
}

private struct ThinProgressBar: View {
    let fraction: Double

    var body: some View {
        Capsule()
            .fill(Color(white: 0.16))
            .frame(height: 4)
            .overlay {
                // scaled rather than measured, so the bar needs no geometry reader
                Capsule()
                    .fill(Theme.action)
                    .scaleEffect(x: max(fraction, 0.02), anchor: .leading)
            }
            .accessibilityElement()
            .accessibilityLabel("Progress")
            .accessibilityValue(Text(fraction, format: .percent.precision(.fractionLength(0))))
    }
}
