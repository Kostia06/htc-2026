import RavenKit
import SwiftUI

/// One feed item: what it is, who runs it, and the one reason it's here. Tapping opens the listing.
struct FeedCardView: View {
    let card: FeedCard
    @Environment(\.openURL) private var openURL

    var body: some View {
        Button {
            openURL(card.url)
        } label: {
            HStack(alignment: .top, spacing: 14) {
                KindBadge(kind: card.kind)
                details
            }
            .ravenCard()
            .contentShape(.rect(cornerRadius: 20))
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens the listing")
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(card.title)
                .font(.headline)
                .lineLimit(2)
            Text(card.org)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Label(card.why, systemImage: "sparkle")
                .font(.footnote)
                .foregroundStyle(Theme.agent)
                .lineLimit(1)
                .padding(.top, 2)
            chips
            if let attribution = card.attribution {
                AttributionLink(attribution: attribution)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private var chips: some View {
        let date = dateText
        if date != nil || card.where != nil {
            HStack(spacing: 6) {
                if let date {
                    FeedChip(text: date, systemImage: "calendar")
                }
                if let place = card.where {
                    FeedChip(text: place, systemImage: "mappin")
                }
            }
            .padding(.top, 4)
        }
    }

    private var dateText: String? {
        guard let date = card.date else { return nil }
        let day = date.formatted(.dateTime.month(.abbreviated).day())
        return card.kind == .job ? "Posted \(day)" : day
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
