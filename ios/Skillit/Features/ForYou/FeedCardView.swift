import SkillitKit
import SwiftUI

/// One feed item in four lines: what, who and where, the one reason it's here, and the facts that decide a click.
/// Tapping opens its details.
struct FeedCardView: View {
    let card: FeedCard
    var onSave: () -> Void = {}
    var onDismiss: () -> Void = {}
    var onOpen: () -> Void = {}
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        // at accessibility sizes the badge sits above the text so the title keeps the full width
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 10))
            : AnyLayout(HStackLayout(alignment: .top, spacing: 14))
        layout {
            KindBadge(kind: card.kind)
            details
        }
        .skillitCard()
        .contentShape(.rect(cornerRadius: 20))
        .onTapGesture(perform: onOpen)
        .contextMenu {
            // there is no unsave on the server, so a saved card only offers what it can actually do
            if !card.isSaved {
                Button("Save", systemImage: "bookmark", action: onSave)
            }
            Button("Not for me", systemImage: "hand.thumbsdown", role: .destructive, action: onDismiss)
        }
        .accessibilityElement(children: .contain)
        .accessibilityAction(named: "Details", onOpen)
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(card.title)
                        .font(.headline)
                        .lineLimit(3)
                    Text(orgLine)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Spacer(minLength: 4)
                bookmark
            }
            Text(card.why)
                .font(.footnote)
                .foregroundStyle(Theme.agent)
                .lineLimit(2)
            // wraps instead of truncating, so every chip stays readable at large text sizes
            FlowLayout(spacing: 6) {
                chips
            }
            .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var orgLine: String {
        [card.org, card.where].compactMap(\.self).joined(separator: " · ")
    }

    @ViewBuilder private var chips: some View {
        if let when = card.cardWhenText {
            FeedChip(text: when, systemImage: card.date == nil ? "clock" : "calendar")
        }
        if let salary = card.salary {
            FeedChip(text: salary, systemImage: "dollarsign")
        }
        if let format = shownFormat {
            FeedChip(text: format, systemImage: "laptopcomputer")
        }
        if card.level == "beginner" {
            FeedChip(text: "Beginner friendly", systemImage: "leaf")
        }
    }

    /// "Remote" or "Hybrid" changes whether someone can go at all; skipped when the place line already says it.
    private var shownFormat: String? {
        guard let format = card.format, !format.isEmpty else { return nil }
        let place = card.where?.lowercased() ?? ""
        return place.contains(format.lowercased()) ? nil : format.capitalized
    }

    /// Just the bookmark on the card; dismissing lives in the swipe and the long-press menu.
    private var bookmark: some View {
        Button(action: onSave) {
            Image(systemName: card.isSaved ? "bookmark.fill" : "bookmark")
                .font(.body.weight(.medium))
                .foregroundStyle(card.isSaved ? Theme.action : Color.secondary)
                .frame(width: 44, height: 44)
                .contentShape(.rect)
                .contentTransition(.symbolEffect(.replace))
        }
        // borderless keeps the bookmark its own tap target inside a List row
        .buttonStyle(.borderless)
        // the 44pt target overhangs the text so the card's own padding doesn't grow around it
        .padding(.vertical, -8)
        .padding(.trailing, -8)
        .symbolEffect(.bounce, value: card.isSaved)
        .sensoryFeedback(.success, trigger: card.isSaved) { _, saved in saved }
        .accessibilityLabel(card.isSaved ? "Saved" : "Save")
    }
}

private struct FeedChip: View {
    let text: String
    let systemImage: String

    var body: some View {
        Label(text, systemImage: systemImage)
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Theme.chip, in: .capsule)
    }
}
