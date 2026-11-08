import RavenKit
import SwiftUI

/// The one number from the session, counted up as the page appears, with the coach's verdict under it.
struct ScoreHeadline: View {
    let score: Int
    let verdict: String

    @State private var shown = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(shown, format: .number)
                    .font(.system(size: 76, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .contentTransition(.numericText())
                Text("/100")
                    .font(.title3.weight(.medium))
                    .foregroundStyle(.secondary)
            }
            .accessibilityElement()
            .accessibilityLabel("Score \(score) out of 100")
            Text(verdict)
                .font(.title3.weight(.medium))
        }
        .padding(.top, 8)
        .onAppear {
            withAnimation(reduceMotion ? nil : .spring(duration: 1.1, bounce: 0.15)) {
                shown = score
            }
        }
    }
}

/// One fix, said plainly. A short example sits right under it; a long one waits behind a tap.
struct ImprovementRow: View {
    let number: Int
    let improvement: SessionDebrief.Improvement

    @State private var isExpanded = false

    /// Past this the example becomes a paragraph, and the page stops feeling calm.
    private static let shortExample = 90

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(number, format: .number)
                .font(.subheadline.weight(.bold).monospacedDigit())
                .foregroundStyle(Theme.action)
            VStack(alignment: .leading, spacing: 6) {
                Text(improvement.better)
                    .font(.body)
                if !improvement.example.isEmpty {
                    example
                }
            }
        }
    }

    @ViewBuilder private var example: some View {
        if improvement.example.count <= Self.shortExample || isExpanded {
            Text("Try: “\(improvement.example)”")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .transition(.opacity.combined(with: .move(edge: .top)))
        } else {
            Button("Show an example") {
                withAnimation(.spring(duration: 0.35, bounce: 0.2)) { isExpanded = true }
            }
            .font(.subheadline.weight(.medium))
            .foregroundStyle(.secondary)
        }
    }
}

/// One question, its score and a line of feedback.
struct QuestionRow: View {
    let result: SessionDebrief.QuestionResult

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Text(result.score, format: .number)
                .font(.title3.weight(.bold).monospacedDigit())
                .foregroundStyle(result.score < 55 ? Theme.action : .primary)
                .frame(width: 40, alignment: .leading)
            VStack(alignment: .leading, spacing: 4) {
                Text(result.question)
                    .font(.subheadline.weight(.medium))
                Text(result.oneLineFeedback)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 10)
    }
}
