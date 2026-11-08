import SkillitKit
import SwiftUI

/// What a feed card is about, shown in the app first; the website is one tap away at the bottom.
struct FeedDetailSheet: View {
    let card: FeedCard
    let onSave: () -> Void
    @Environment(\.openURL) private var openURL
    @Environment(AppModel.self) private var app
    @State private var company: CompanyLink?

    var body: some View {
        DetailSheet {
            header
            FitReasons(reasons: reasons)
            FactGrid(facts: facts)
            if let summary = card.summary {
                ExpandableText(text: summary)
            }
            if let highlights = card.highlights, !highlights.isEmpty {
                ListingHighlights(highlights: highlights)
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
        .sheet(item: $company) { link in
            CompanySheet(slug: link.slug)
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            KindBadge(kind: card.kind)
            VStack(alignment: .leading, spacing: 4) {
                Text(card.title)
                    .font(.title2.bold())
                    .fixedSize(horizontal: false, vertical: true)
                organisation
            }
        }
    }

    /// The employer opens its company page when Skillit has researched it; otherwise it's just a name.
    @ViewBuilder private var organisation: some View {
        if card.kind == .job, let slug = app.companies.slug(matching: card.org) {
            Button {
                company = CompanyLink(slug: slug)
            } label: {
                Label(card.org, systemImage: "building.2")
                    .font(.subheadline.weight(.semibold))
            }
            .tint(Theme.action)
        } else {
            Text(card.org)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var facts: [FactGrid.Fact] {
        var facts = [FactGrid.Fact(label: "Kind", value: card.kind.name)]
        if let place = card.where {
            facts.append(.init(label: "Where", value: place))
        }
        if let day = card.dayText {
            facts.append(.init(label: card.kind == .job ? "Posted" : "When", value: day))
        }
        if let salary = card.salary {
            facts.append(.init(label: "Salary", value: salary))
        }
        if let level = card.level {
            facts.append(.init(label: "Level", value: level.capitalized))
        }
        if let format = card.format {
            facts.append(.init(label: "Format", value: format))
        }
        return facts
    }

    /// Older cards only carry the one `why` line, so fall back to it.
    private var reasons: [String] {
        if let reasons = card.reasons, !reasons.isEmpty {
            return reasons
        }
        return [card.why]
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
                    .contentTransition(.symbolEffect(.replace))
            }
            .buttonStyle(.raisedSecondary)
            .frame(width: 72)
            .sensoryFeedback(.success, trigger: card.isSaved) { _, saved in saved }
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
}

/// The personal reasons this card is here, each one a short line Skillit worked out from the profile.
private struct FitReasons: View {
    let reasons: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Why it fits you")
                .font(.headline)
            ForEach(reasons, id: \.self) { reason in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Theme.agent)
                        .accessibilityHidden(true)
                    Text(reason)
                }
                .font(.subheadline)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Theme.inset, in: .rect(cornerRadius: 16))
    }
}

/// What the page itself says, kept apart from "Why it fits you" so the listing's claims never read as Skillit's.
private struct ListingHighlights: View {
    let highlights: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("From the listing")
                .font(.headline)
            ForEach(highlights, id: \.self) { highlight in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text("•").foregroundStyle(.secondary).accessibilityHidden(true)
                    Text(highlight)
                }
                .font(.subheadline)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
