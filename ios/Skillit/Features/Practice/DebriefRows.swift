import SkillitKit
import SwiftUI

/// The one number from the session, counted up as the page appears, with the coach's verdict under it.
struct ScoreHeadline: View {
    let score: Int
    let verdict: String

    @State private var shown = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .largeTitle) private var size: CGFloat = 72

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(shown, format: .number)
                    .font(.system(size: min(size, 120), weight: .bold, design: .rounded))
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

/// One line of the debrief: a small glyph, the point in plain words, and an optional example to say instead.
struct DebriefRow: View {
    let systemImage: String
    let tint: Color
    let text: String
    var example: String = ""

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Image(systemName: systemImage)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(tint)
                .frame(width: 18)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 6) {
                Text(text)
                    .font(.body)
                if !example.isEmpty {
                    Text("Try: “\(example)”")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// One question, its score and a line of feedback.
struct QuestionRow: View {
    let result: SessionDebrief.QuestionResult

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 14) {
            Text(result.score, format: .number)
                .font(.title3.weight(.bold).monospacedDigit())
                .foregroundStyle(result.score < 55 ? Theme.negative : Color.primary)
                .frame(minWidth: 40, alignment: .leading)
            VStack(alignment: .leading, spacing: 4) {
                Text(result.question)
                    .font(.subheadline.weight(.medium))
                Text(result.oneLineFeedback)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 10)
        .accessibilityElement(children: .combine)
    }
}
