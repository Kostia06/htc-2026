import SkillitKit
import SwiftUI

/// The small receipt under Skillit's reply: one line per change it made.
struct AppliedCard: View {
    let changes: [AppliedChange]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Applied", systemImage: "checkmark.circle.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.agent)
            ForEach(changes) { change in
                Text(change.summary)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.raised, in: .rect(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.hairline))
        .padding(.trailing, 48)
        .accessibilityElement(children: .combine)
    }
}
