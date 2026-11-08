import SkillitKit
import SwiftUI

/// One feed item in four lines: what, who and where, the one reason it's here, and when. Tapping opens its details.
struct FeedCardView: View {
    let card: FeedCard
    var onSave: () -> Void = {}
    var onDismiss: () -> Void = {}
    var onOpen: () -> Void = {}

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            KindBadge(kind: card.kind)
            details
        }
        .skillitCard()
        .contentShape(.rect(cornerRadius: 20))
        .onTapGesture(perform: onOpen)
        .contextMenu {
            Button(card.isSaved ? "Unsave" : "Save", systemImage: card.isSaved ? "bookmark.slash" : "bookmark", action: onSave)
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
                        .lineLimit(2)
                    Text(orgLine)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 4)
                bookmark
            }
            Text(card.why)
                .font(.footnote)
                .foregroundStyle(Theme.agent)
                .lineLimit(1)
            HStack(spacing: 6) {
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
        if card.level == "beginner" {
            FeedChip(text: "Beginner friendly", systemImage: "leaf")
        }
        if let when = whenText {
            FeedChip(text: when, systemImage: card.date == nil ? "clock" : "calendar")
        }
        if let salary = card.salary {
            FeedChip(text: salary, systemImage: "dollarsign")
        }
    }

    /// Just the bookmark on the card; dismissing lives in the swipe and the long-press menu.
    private var bookmark: some View {
        Button(action: onSave) {
            Image(systemName: card.isSaved ? "bookmark.fill" : "bookmark")
                .font(.body.weight(.medium))
                .foregroundStyle(card.isSaved ? Theme.action : .secondary)
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

    /// A real date reads as a day; a label such as "ongoing" is shown as the source gave it.
    private var whenText: String? {
        if let date = card.date {
            // a day-only date ("2027-01-26") is parsed as UTC midnight; showing it in local time would say the day before
            let isDayOnly = card.when?.count == 10
            let day = date.formatted(Date.FormatStyle(timeZone: isDayOnly ? .gmt : .current).month(.abbreviated).day())
            return card.kind == .job ? "Posted \(day)" : day
        }
        return card.when?.capitalized
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
