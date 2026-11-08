import SkillitKit
import SwiftUI

/// The open moment under the bar: what happened, what they said, the line to say instead, and for a researched
/// tip the pages it rests on.
struct MomentCard: View {
    let moment: ReplayMoment
    let when: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            summary
                .accessibilityElement(children: .combine)
            // kept out of the combined element, so each page stays its own tappable link for VoiceOver
            if !moment.sources.isEmpty {
                SourceChips(sources: moment.sources)
            }
        }
        .skillitCard()
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                MomentGlyph(kind: moment.kind)
                Text(moment.title).font(.headline)
                Spacer(minLength: 8)
                Text(when).font(.caption).monospacedDigit().foregroundStyle(.secondary)
            }
            if moment.kind == .researched {
                ResearchedBadge()
            }
            Text(moment.detail).font(.body)
            if let said = moment.said, !said.isEmpty {
                Text("You said “\(said)”").font(.subheadline).foregroundStyle(.secondary)
            }
            if let better = moment.better, !better.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Try saying").font(.caption.weight(.semibold)).foregroundStyle(Theme.agent)
                    Text(better).font(.subheadline)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.agent.opacity(0.12), in: .rect(cornerRadius: 12))
            }
            Text(moment.question).font(.caption).foregroundStyle(.tertiary)
        }
    }
}

/// Marks a tip that cites a page the server read, so it never looks like a guess dressed up as research.
struct ResearchedBadge: View {
    var body: some View {
        Text("Researched")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(Theme.agent)
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .background(Theme.agent.opacity(0.14), in: .capsule)
    }
}

/// One chip per page, opening it in the browser.
struct SourceChips: View {
    let sources: [ReplaySource]

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) { chips }
            VStack(alignment: .leading, spacing: 8) { chips }
        }
    }

    private var chips: some View {
        ForEach(sources) { source in
            Link(destination: source.url) {
                Label(source.host, systemImage: "link")
                    .font(.caption.weight(.medium))
                    .lineLimit(1)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Theme.inset, in: .capsule)
            }
            .accessibilityLabel("Source: \(source.title)")
            .accessibilityHint("Opens \(source.host)")
        }
    }
}
