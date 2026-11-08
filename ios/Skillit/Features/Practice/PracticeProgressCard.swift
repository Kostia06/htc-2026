import SkillitKit
import SwiftUI

/// The top of the Practice tab: the last score, how it moved since the session before, and the trend.
/// Before any finished session it says where the first score will appear instead.
struct PracticeProgressCard: View {
    let model: PracticeHistoryModel
    let onOpenHistory: () -> Void

    var body: some View {
        Button(action: onOpenHistory) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Your progress")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.tertiary)
                }
                if let last = scores.last {
                    lastScore(last)
                    if scores.count > 1 {
                        ScoreSparkline(scores: Array(scores.suffix(10)))
                            .frame(height: 44)
                    }
                } else if !model.hasLoaded {
                    SkeletonLines(widths: [0.3, 0.8], highlighted: -1)
                } else {
                    Text("Finish an interview and your score shows up here.")
                        .font(.body)
                }
            }
            .skillitCard()
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens past sessions")
    }

    private var scores: [Double] {
        model.scoreTrend
    }

    private func lastScore(_ score: Double) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: 12) { scoreText(score); changeText }
            VStack(alignment: .leading, spacing: 4) { scoreText(score); changeText }
        }
    }

    private func scoreText(_ score: Double) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(score, format: .number.precision(.fractionLength(1)))
                .font(.system(.largeTitle, design: .rounded).bold())
                .monospacedDigit()
            Text("/ 5 last session")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private var changeText: some View {
        if scores.count > 1, let last = scores.last {
            let change = last - scores[scores.count - 2]
            Label(
                change.formatted(.number.sign(strategy: .always()).precision(.fractionLength(1))),
                systemImage: change >= 0 ? "arrow.up.right" : "arrow.down.right",
            )
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(change >= 0 ? Theme.positive : Theme.negative)
            .accessibilityLabel("Change since the session before: \(change.formatted(.number.precision(.fractionLength(1))))")
        }
    }
}
