import RavenKit
import SwiftUI

/// One feed item: what it is, who runs it, and the one reason it's here. Tapping opens the listing.
struct FeedCardView: View {
    let card: FeedCard
    var onSave: () -> Void = {}
    var onDismiss: () -> Void = {}
    @Environment(\.openURL) private var openURL

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            KindBadge(kind: card.kind)
            details
        }
        .ravenCard()
        .contentShape(.rect(cornerRadius: 20))
        .onTapGesture { openURL(card.url) }
        .accessibilityElement(children: .contain)
        .accessibilityAction(named: "Open") { openURL(card.url) }
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
            Label(card.why, systemImage: "sparkle")
                .font(.footnote)
                .foregroundStyle(Theme.agent)
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

    private var actions: some View {
        HStack(spacing: 2) {
            CardActionButton(
                symbol: card.isSaved ? "bookmark.fill" : "bookmark",
                label: card.isSaved ? "Saved" : "Save",
                tint: card.isSaved ? Theme.action : .secondary,
                action: onSave,
            )
            .symbolEffect(.bounce, value: card.isSaved)
            .sensoryFeedback(.success, trigger: card.isSaved) { _, saved in saved }
            CardActionButton(symbol: "xmark", label: "Dismiss", tint: .secondary, action: onDismiss)
        }
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

private struct CardActionButton: View {
    let symbol: String
    let label: String
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(tint)
                .frame(width: 30, height: 30)
                .background(Color(white: 0.14), in: .circle)
                .contentTransition(.symbolEffect(.replace))
        }
        // borderless keeps each button its own tap target inside a List row
        .buttonStyle(.borderless)
        .accessibilityLabel(label)
    }
}

private struct KindBadge: View {
    let kind: FeedCard.Kind

    var body: some View {
        Image(systemName: symbol)
            .font(.body.weight(.semibold))
            .foregroundStyle(.white)
            .frame(width: 40, height: 40)
            .background(Color(white: 0.16), in: .rect(cornerRadius: 12))
            .accessibilityLabel(name)
    }

    private var symbol: String {
        switch kind {
        case .job: "briefcase.fill"
        case .hackathon: "trophy.fill"
        case .course: "book.closed.fill"
        case .event: "calendar"
        }
    }

    private var name: String {
        switch kind {
        case .job: "Job"
        case .hackathon: "Hackathon"
        case .course: "Course"
        case .event: "Event"
        }
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
