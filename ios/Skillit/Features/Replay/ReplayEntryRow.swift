import SwiftUI

/// The way into a replay from a report or a past session.
struct ReplayEntryRow: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) { ReplayEntryLabel() }
            .buttonStyle(.plain)
    }
}

/// The row's look on its own, for places that push the replay with a NavigationLink instead.
struct ReplayEntryLabel: View {
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "play.circle.fill")
                .font(.title2)
                .foregroundStyle(Theme.action)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text("Replay the interview").font(.headline).foregroundStyle(.primary)
                Text("Hear it back with every mistake and better phrasing marked.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.leading)
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)
        }
        .skillitCard()
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }
}
