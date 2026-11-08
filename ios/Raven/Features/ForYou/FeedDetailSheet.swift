import RavenKit
import SwiftUI

/// What a feed card is about, shown in the app first; the website is one tap away at the bottom.
struct FeedDetailSheet: View {
    let card: FeedCard
    let onSave: () -> Void
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header
                    facts
                    block("Why it's for you", text: card.why, systemImage: "target", tint: Theme.agent)
                    if let summary = card.summary {
                        block("About", text: summary, systemImage: "text.alignleft", tint: .secondary)
                    }
                    if let tags = card.tags, !tags.isEmpty, card.kind != .job {
                        topics(tags)
                    }
                    if let attribution = card.attribution {
                        Link(attribution.label, destination: attribution.url)
                            .font(.caption)
                            .tint(.secondary)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 28)
                .padding(.bottom, 16)
            }
            buttons
                .padding(.horizontal, 24)
                .padding(.bottom, 12)
        }
        .presentationDetents([.fraction(0.75), .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(Theme.ground)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            KindBadge(kind: card.kind, size: 60)
            Text(card.kind.name.uppercased())
                .font(.caption.weight(.bold))
                .tracking(1.2)
                .foregroundStyle(card.kind.tint)
            Text(card.title)
                .font(.title.bold())
                .fixedSize(horizontal: false, vertical: true)
            Text(card.org)
                .font(.title3)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder private var facts: some View {
        let items = [
            card.where.map { ($0, $0 == "Online" ? "wifi" : "mappin.and.ellipse") },
            card.when.map { (whenText($0), "calendar") },
            card.salary.map { ($0, "dollarsign.circle") },
        ].compactMap(\.self)
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(items, id: \.0) { text, symbol in
                    Label(text, systemImage: symbol)
                        .font(.body.weight(.medium))
                }
            }
        }
    }

    private func block(_ title: String, text: String, systemImage: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(title, systemImage: systemImage)
                .font(.headline)
                .foregroundStyle(tint)
            Text(text)
                .font(.body)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .ravenCard()
    }

    private func topics(_ tags: [String]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Topics")
                .font(.headline)
            FlowLayout(spacing: 8) {
                ForEach(tags, id: \.self) { tag in
                    Text(tag.capitalized)
                        .font(.subheadline)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(card.kind.tint.opacity(0.14), in: .capsule)
                }
            }
        }
    }

    private var buttons: some View {
        HStack(spacing: 12) {
            Button(action: onSave) {
                Image(systemName: card.isSaved ? "bookmark.fill" : "bookmark")
                    .frame(width: 24)
            }
            .buttonStyle(.raised(Color(white: 0.22)))
            .frame(width: 72)
            .accessibilityLabel(card.isSaved ? "Saved" : "Save")
            Button(websiteTitle) { openURL(card.url) }
                .buttonStyle(.raised(card.kind.tint, foreground: .black))
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
        let dayOnly = raw.count == 10
        let day = date.formatted(Date.FormatStyle(timeZone: dayOnly ? .gmt : .current).weekday(.wide).month(.wide).day())
        return card.kind == .job ? "Posted \(day)" : day
    }
}
