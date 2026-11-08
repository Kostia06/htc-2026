import RavenKit
import SwiftUI

/// What a feed card is about, shown in the app first; the website is one tap away at the bottom.
struct FeedDetailSheet: View {
    let card: FeedCard
    let onSave: () -> Void
    @Environment(\.openURL) private var openURL

    var body: some View {
        DetailSheet {
            header
            Label(card.why, systemImage: "target")
                .font(.subheadline)
                .foregroundStyle(Theme.agent)
                .lineLimit(2)
            FactGrid(facts: facts)
            if let summary = card.summary {
                ExpandableText(text: summary)
            }
            if let tags = card.tags, !tags.isEmpty, card.kind != .job {
                topics(tags)
            }
            if let attribution = card.attribution {
                Link(attribution.label, destination: attribution.url)
                    .font(.caption)
                    .tint(.secondary)
            }
        } footer: {
            buttons
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            KindBadge(kind: card.kind)
            VStack(alignment: .leading, spacing: 4) {
                Text(card.title)
                    .font(.title2.bold())
                    .fixedSize(horizontal: false, vertical: true)
                Text(card.org)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var facts: [FactGrid.Fact] {
        var facts = [FactGrid.Fact(label: "Kind", value: card.kind.name)]
        if let place = card.where {
            facts.append(.init(label: "Where", value: place))
        }
        if let when = card.when {
            facts.append(.init(label: card.kind == .job ? "Posted" : "When", value: whenText(when)))
        }
        if let salary = card.salary {
            facts.append(.init(label: "Salary", value: salary))
        }
        return facts
    }

    private func topics(_ tags: [String]) -> some View {
        FlowLayout(spacing: 8) {
            ForEach(tags, id: \.self) { tag in
                Text(tag.capitalized)
                    .font(.subheadline)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Theme.chip, in: .capsule)
            }
        }
    }

    private var buttons: some View {
        HStack(spacing: 12) {
            Button(action: onSave) {
                Image(systemName: card.isSaved ? "bookmark.fill" : "bookmark")
                    .frame(width: 24)
            }
            .buttonStyle(.raisedSecondary)
            .frame(width: 72)
            .accessibilityLabel(card.isSaved ? "Saved" : "Save")
            Button(websiteTitle) { openURL(card.url) }
                .buttonStyle(.raised)
        }
    }

    private var websiteTitle: String {
        switch card.kind {
        case .job: "Apply on website"
        case .event, .hackathon: "Register on website"
        case .course: "Open course"
        }
    }

    private func whenText(_ raw: String) -> String {
        guard let date = card.date else { return raw.capitalized }
        // a day-only date ("2027-01-26") is parsed as UTC midnight; showing it in local time would say the day before
        let dayOnly = raw.count == 10
        return date.formatted(Date.FormatStyle(timeZone: dayOnly ? .gmt : .current).month(.abbreviated).day())
    }
}
