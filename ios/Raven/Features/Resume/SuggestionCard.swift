import RavenKit
import SwiftUI

/// The coach's suggestions, one at a time: accept slides the card away and the next one in.
struct SuggestionDeck: View {
    let suggestions: [ResumeSuggestion]
    let resume: Resume
    let onAccept: (ResumeSuggestion) -> Void
    let onSkip: (ResumeSuggestion) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Raven suggests", systemImage: "pencil.line")
                    .font(.headline)
                    .foregroundStyle(Theme.agent)
                Spacer()
                Text("\(suggestions.count) left")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .contentTransition(.numericText(countsDown: true))
            }
            if let current = suggestions.first {
                SuggestionCard(suggestion: current, label: resume.label(for: current.path)) {
                    onAccept(current)
                } onSkip: {
                    onSkip(current)
                }
                .id(current.id)
                .transition(.asymmetric(
                    insertion: .move(edge: .trailing).combined(with: .opacity),
                    removal: .move(edge: .leading).combined(with: .opacity)
                ))
            }
        }
        .animation(.spring(duration: 0.45, bounce: 0.15), value: suggestions)
    }
}

struct SuggestionCard: View {
    let suggestion: ResumeSuggestion
    let label: String
    let onAccept: () -> Void
    let onSkip: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            VStack(alignment: .leading, spacing: 8) {
                Text(suggestion.before)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .strikethrough(color: .secondary)
                Text(highlighted(suggestion.after))
                    .font(.body.weight(.medium))
            }
            .fixedSize(horizontal: false, vertical: true)
            if !suggestion.why.isEmpty {
                Text(suggestion.why)
                    .font(.footnote)
                    .foregroundStyle(Theme.agent)
            }
            HStack(spacing: 12) {
                Button("Skip", action: onSkip)
                    .buttonStyle(.raised(Color(white: 0.22)))
                Button("Accept", action: onAccept)
                    .buttonStyle(.raised(Theme.agent, foreground: Theme.onAction))
            }
        }
        .ravenCard()
        .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(Theme.agent.opacity(0.35)))
    }

    /// "[add number]" is the one thing the person must fill in, so it is the one thing in orange.
    private func highlighted(_ text: String) -> AttributedString {
        var attributed = AttributedString(text)
        var searchRange = attributed.startIndex ..< attributed.endIndex
        while let range = attributed[searchRange].range(of: "[add number]") {
            attributed[range].foregroundColor = Theme.action
            searchRange = range.upperBound ..< attributed.endIndex
        }
        return attributed
    }
}
