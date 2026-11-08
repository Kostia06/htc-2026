import SkillitKit
import SwiftUI

/// One colour and glyph per kind, shared by the dots, the feed and the card so they read as the same thing.
extension ReplayMoment.Kind {
    var tint: Color {
        switch self {
        case .mistake: Theme.negative
        case .better: Theme.agent
        case .strength: Theme.positive
        case .filler: .secondary
        }
    }

    var systemImage: String {
        switch self {
        case .mistake: "exclamationmark"
        case .better: "quote.bubble"
        case .strength: "checkmark"
        case .filler: "waveform"
        }
    }
}

/// A notification-style row in the moments feed: glyph, title, one line, and when it happened.
struct MomentRow: View {
    let moment: ReplayMoment
    let when: String
    let isSelected: Bool
    let spokenLabel: String
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 12) {
                MomentGlyph(kind: moment.kind)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(moment.title).font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
                        Spacer(minLength: 8)
                        Text(when).font(.caption).monospacedDigit().foregroundStyle(.secondary)
                    }
                    Text(moment.detail).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isSelected ? Theme.inset : .clear, in: .rect(cornerRadius: 14))
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(spokenLabel)
        .accessibilityHint("Plays from this moment")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

struct MomentGlyph: View {
    let kind: ReplayMoment.Kind
    @ScaledMetric(relativeTo: .subheadline) private var size: CGFloat = 30

    var body: some View {
        Image(systemName: kind.systemImage)
            .font(.caption.weight(.bold))
            .foregroundStyle(kind.tint)
            .frame(width: size, height: size)
            .background(kind.tint.opacity(0.16), in: .circle)
            .accessibilityHidden(true)
    }
}

/// The open moment under the bar: what happened, what they said, and the line to say instead.
struct MomentCard: View {
    let moment: ReplayMoment
    let when: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                MomentGlyph(kind: moment.kind)
                Text(moment.title).font(.headline)
                Spacer(minLength: 8)
                Text(when).font(.caption).monospacedDigit().foregroundStyle(.secondary)
            }
            Text(moment.detail).font(.body)
            if let said = moment.said, !said.isEmpty {
                Text("You said “\(said)”").font(.subheadline).foregroundStyle(.secondary)
            }
            if let better = moment.better, !better.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Try saying").font(.caption.weight(.semibold)).foregroundStyle(Theme.agent)
                    Text(better).font(.subheadline)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.agent.opacity(0.12), in: .rect(cornerRadius: 12))
            }
            Text(moment.question).font(.caption).foregroundStyle(.tertiary)
        }
        .skillitCard()
        .accessibilityElement(children: .combine)
    }
}
