import RavenKit
import SwiftUI

/// One open step. `.full` shows what to do and its button; `.compact` is the row further down the list, tapped to act on it.
struct StepCard: View {
    enum Style {
        case full, compact
    }

    let step: RoadmapStep
    let style: Style
    let onAction: () -> Void

    var body: some View {
        switch style {
        case .full: full
        case .compact: compact
        }
    }

    private var full: some View {
        VStack(alignment: .leading, spacing: 14) {
            header
            if !step.detail.isEmpty {
                Text(step.detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Button(step.actionTitle, action: onAction)
                .buttonStyle(step.isPractice ? .raised : .raised(Color(white: 0.22)))
        }
        .ravenCard()
    }

    private var compact: some View {
        Button(action: onAction) {
            HStack(spacing: 12) {
                header
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .ravenCard()
        }
        .buttonStyle(.plain)
        .accessibilityHint(step.actionTitle)
    }

    private var header: some View {
        HStack(spacing: 12) {
            KindIcon(kind: step.kind, highlighted: step.isPractice)
            VStack(alignment: .leading, spacing: 4) {
                Text(step.title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
                HStack(spacing: 8) {
                    if !step.estimate.isEmpty {
                        Label(step.estimate, systemImage: "clock")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    LabelChip(label: step.label)
                }
            }
            Spacer(minLength: 0)
        }
    }
}

struct KindIcon: View {
    let kind: RoadmapStep.Kind
    var highlighted = false
    var size: CGFloat = 40

    var body: some View {
        Image(systemName: kind.symbol)
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundStyle(highlighted ? Theme.action : .secondary)
            .frame(width: size, height: size)
            .background(highlighted ? Theme.action.opacity(0.15) : Color(white: 0.14), in: .rect(cornerRadius: size * 0.3))
            .accessibilityLabel(kind.name)
    }
}

struct LabelChip: View {
    let label: RoadmapStep.Label

    var body: some View {
        Text(label.text)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(label == .readyNow ? Theme.action : .secondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(label == .readyNow ? Theme.action.opacity(0.15) : Color(white: 0.16), in: .capsule)
    }
}
