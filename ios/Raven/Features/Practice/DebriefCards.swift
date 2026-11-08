import RavenKit
import SwiftUI

/// Something they said that worked, in their own words.
struct StrengthCard: View {
    let strength: SessionDebrief.Strength

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("“\(strength.quote)”")
                .font(.body.weight(.semibold))
            Text(strength.why)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .ravenCard()
    }
}

/// One moment to fix: tap to see what they said, what a stronger answer does, and an example rewrite.
struct ImprovementCard: View {
    let improvement: SessionDebrief.Improvement
    @Binding var isExpanded: Bool

    var body: some View {
        Button {
            withAnimation(.spring(duration: 0.35, bounce: 0.2)) { isExpanded.toggle() }
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(improvement.moment)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Theme.agent)
                        Text(improvement.better)
                            .font(.body.weight(.semibold))
                            .multilineTextAlignment(.leading)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.down")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.tertiary)
                        .rotationEffect(.degrees(isExpanded ? 180 : 0))
                }
                if isExpanded {
                    detail("You said", improvement.said, tint: .secondary)
                    if !improvement.example.isEmpty {
                        detail("Try", improvement.example, tint: Theme.action)
                    }
                }
            }
            .ravenCard()
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: isExpanded)
    }

    private func detail(_ label: String, _ text: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.caption2.weight(.bold))
                .foregroundStyle(tint)
            Text("“\(text)”")
                .font(.subheadline)
                .foregroundStyle(.primary)
                .multilineTextAlignment(.leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .transition(.opacity.combined(with: .move(edge: .top)))
    }
}

/// One question, its score and a line of feedback.
struct QuestionRow: View {
    let result: SessionDebrief.QuestionResult

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Text(result.score, format: .number)
                .font(.title3.weight(.bold).monospacedDigit())
                .foregroundStyle(scoreColor)
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

    private var scoreColor: Color {
        switch result.score {
        case 75...: .green
        case 55 ..< 75: .primary
        default: Theme.action
        }
    }
}
