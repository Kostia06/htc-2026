import RavenKit
import SwiftUI

/// One feed item: what it is, who runs it, and the one reason it's here. Tapping opens its details.
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
        .ravenCard()
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
                    Text(card.org)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 4)
                actions
            }
            Text(card.why)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .padding(.top, 2)
            HStack(spacing: 6) {
                chips
            }
            .padding(.top, 4)
            if let attribution = card.attribution {
                AttributionLink(attribution: attribution)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private var chips: some View {
        if let when = whenText {
            FeedChip(text: when, systemImage: card.date == nil ? "clock" : "calendar")
        }
        if let place = card.where {
            FeedChip(text: place, systemImage: place == "Online" ? "wifi" : "mappin")
        }
    }

    // just the bookmark on the card; dismissing lives in the swipe and the long-press menu
    private var actions: some View {
        Button(action: onSave) {
            Image(systemName: card.isSaved ? "bookmark.fill" : "bookmark")
                .font(.body.weight(.medium))
                .foregroundStyle(card.isSaved ? Theme.action : Color(white: 0.5))
                .frame(width: 32, height: 32)
                .contentShape(.rect)
                .contentTransition(.symbolEffect(.replace))
        }
        // borderless keeps the bookmark its own tap target inside a List row
        .buttonStyle(.borderless)
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
            .background(Color(white: 0.14), in: .capsule)
    }
}

/// Adzuna's terms ask for this credit, linked to their site, on every listing we show.
private struct AttributionLink: View {
    let attribution: FeedCard.Attribution

    var body: some View {
        Link(destination: attribution.url) {
            Text(attribution.label)
                .font(.caption)
                .underline()
        }
        .tint(.secondary)
        .foregroundStyle(.secondary)
        .padding(.top, 4)
    }
}
