import SkillitKit
import SwiftUI

/// One colour and glyph per kind, shared by the dots, the feed and the card so they read as the same thing.
extension ReplayMoment.Kind {
    var tint: Color {
        switch self {
        case .mistake: Theme.negative
        case .better, .researched: Theme.agent
        case .strength: Theme.positive
        case .filler, .delivery: .secondary
        }
    }

    var systemImage: String {
        switch self {
        case .mistake: "exclamationmark"
        case .better: "quote.bubble"
        case .researched: "magnifyingglass"
        case .strength: "checkmark"
        case .filler: "waveform"
        case .delivery: "person.wave.2"
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
                        if moment.kind == .researched {
                            ResearchedBadge()
                        }
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
