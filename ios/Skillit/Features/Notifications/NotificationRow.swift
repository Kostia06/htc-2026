import SkillitKit
import SwiftUI

/// One notification: the kind's icon, a one-line title, one line of why, and when. Unread ones carry a dot.
struct NotificationRow: View {
    let item: SkillitNotification

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: item.kind.symbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(item.kind.tint)
                .frame(width: 40, height: 40)
                .background(Theme.chip, in: .circle)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(item.title)
                        .font(.subheadline.weight(item.isRead ? .regular : .semibold))
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    if let time {
                        Text(time)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Text(item.body)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Circle()
                .fill(Theme.action)
                .frame(width: 8, height: 8)
                .padding(.top, 6)
                .opacity(item.isRead ? 0 : 1)
                .accessibilityHidden(true)
        }
        .padding(.vertical, 6)
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
        .accessibilityAddTraits(.isButton)
    }

    private var time: String? {
        RelativeTime.phrase(for: item.createdAt)
    }

    private var accessibilityText: String {
        [item.isRead ? nil : "Unread", item.title, item.body, time].compactMap(\.self).joined(separator: ", ")
    }
}

#if DEBUG
    #Preview {
        List {
            ForEach(SkillitNotification.samples) { NotificationRow(item: $0) }
                .listRowBackground(Theme.raised)
        }
        .scrollContentBackground(.hidden)
        .background(Theme.ground)
        .preferredColorScheme(.dark)
    }
#endif
