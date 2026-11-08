import RavenKit
import SwiftUI

/// The calm top of the screen: one big number, the goal, a thin bar, and a few quiet facts.
struct RoadmapSummaryHeader: View {
    let page: RoadmapPage
    /// Bigger than largeTitle, like a balance on a finance app, but still scales with Dynamic Type.
    @ScaledMetric(relativeTo: .largeTitle) private var numberSize: CGFloat = 50

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 6) {
                Text("On the way to \(page.goal)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text("\(page.summary.done) of \(page.summary.total)")
                        .font(.system(size: numberSize, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .contentTransition(.numericText())
                    Text("steps")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)
                ProgressBar(fraction: fraction)
                    .padding(.top, 6)
            }
            VStack(spacing: 14) {
                QuietRow(title: "Done this week", value: "\(page.summary.thisWeek)")
                QuietRow(title: "Ready to start now", value: "\(readyNow)")
                if let next = page.steps.first(where: { $0.id == page.currentStepID }) {
                    QuietRow(title: "Up next", value: next.title)
                }
            }
        }
        .animation(.spring, value: page.summary)
    }

    private var fraction: Double {
        page.summary.total == 0 ? 0 : Double(page.summary.done) / Double(page.summary.total)
    }

    private var readyNow: Int {
        page.steps.count { $0.label == .readyNow && ($0.status == .todo || $0.status == .started) }
    }
}

private struct ProgressBar: View {
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

private struct QuietRow: View {
    let title: String
    let value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 16) {
            Text(title)
                .foregroundStyle(.secondary)
            Spacer(minLength: 12)
            Text(value)
                .multilineTextAlignment(.trailing)
                .lineLimit(2)
        }
        .font(.subheadline)
        .accessibilityElement(children: .combine)
    }
}
