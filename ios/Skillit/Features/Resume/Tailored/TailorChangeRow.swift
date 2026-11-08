import SkillitKit
import SwiftUI

/// One change as before → after, with why it was made and the requirement it serves; revert puts the line back.
struct TailorChangeRow: View {
    let change: TailorChange
    let isBusy: Bool
    let isLocked: Bool
    let onToggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("\(change.sectionTitle) · \(kindLabel)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                if !isLocked {
                    toggle
                }
            }
            Text(change.before)
                .font(.subheadline)
                .strikethrough(change.accepted)
                .foregroundStyle(.secondary)
            if change.kind != .trim {
                Image(systemName: "arrow.down")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
                Text(change.after)
                    .font(.subheadline)
                    .foregroundStyle(change.accepted ? .primary : .tertiary)
            }
            Text(change.why)
                .font(.footnote)
                .foregroundStyle(.secondary)
            if let requirement = change.requirement {
                Text("For “\(requirement)”")
                    .font(.caption)
                    .foregroundStyle(Theme.agent)
            }
        }
        .skillitCard()
        .opacity(change.accepted ? 1 : 0.7)
        .accessibilityElement(children: .combine)
        .accessibilityAction(named: change.accepted ? "Revert" : "Use this change", onToggle)
    }

    private var toggle: some View {
        Button(action: onToggle) {
            if isBusy {
                ProgressView().controlSize(.small)
            } else {
                Text(change.accepted ? "Revert" : "Use this")
                    .font(.subheadline.weight(.semibold))
            }
        }
        .buttonStyle(.borderless)
        .tint(Theme.action)
        .disabled(isBusy)
        .frame(minHeight: 32)
    }

    private var kindLabel: String {
        switch change.kind {
        case .reword: "Reworded"
        case .trim: "Removed"
        case .reorder: "Reordered"
        }
    }
}

#if DEBUG
#Preview {
    VStack(spacing: 12) {
        TailorChangeRow(change: SampleTailoredResumes.changes[0], isBusy: false, isLocked: false) {}
        TailorChangeRow(change: SampleTailoredResumes.changes[1], isBusy: false, isLocked: false) {}
    }
    .padding()
    .background(Theme.ground)
}
#endif
