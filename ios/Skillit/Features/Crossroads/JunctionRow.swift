import SkillitKit
import SwiftUI

/// One crossing: the person's item on the left, what everyone on the road said about the same thing on the right,
/// joined by sand connectors (sand, because Skillit drew the link). Stacks vertically at accessibility sizes.
struct JunctionRow: View {
    let junction: Junction
    let cited: Set<String>

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let stacked = typeSize.isAccessibilitySize
        let layout = stacked ? AnyLayout(VStackLayout(spacing: 0)) : AnyLayout(HStackLayout(alignment: .top, spacing: 0))
        layout {
            YourFace(item: junction.you, isCited: cited.contains(junction.you.id))
            VStack(spacing: Self.rowGap) {
                ForEach(Array(junction.others.enumerated()), id: \.element.id) { index, other in
                    let stop = stacked ? AnyLayout(VStackLayout(spacing: 0)) : AnyLayout(HStackLayout(alignment: .top, spacing: 0))
                    stop {
                        Connector(vertical: stacked).padding(.top, stacked ? 0 : Self.stopOffset - 9)
                        face(other)
                    }
                    // a rail from this stop down to the next, so one item of theirs reads as a junction with branches
                    .background(alignment: .topLeading) {
                        if !stacked, index < junction.others.count - 1 {
                            rail
                        }
                    }
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
    }

    /// Where a connector meets a card: level with the card's first line.
    private static let stopOffset: CGFloat = 22
    private static let rowGap: CGFloat = 8

    private var rail: some View {
        Capsule()
            .fill(Theme.agent.opacity(0.6))
            .frame(width: 3)
            .padding(.top, Self.stopOffset)
            .padding(.bottom, -(Self.rowGap + Self.stopOffset))
            .offset(x: 7.5)
    }

    @ViewBuilder private func face(_ other: Junction.Other) -> some View {
        switch other {
        case let .line(line):
            Face(isCited: cited.contains(line.id), surface: Theme.chip) {
                Label(line.kind.title, systemImage: line.kind.symbol)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(line.kind.tint)
                Text(line.text).font(.subheadline)
                if !line.whoLine.isEmpty {
                    Text(line.whoLine).font(.caption2).foregroundStyle(.secondary)
                }
            }
        case let .fact(fact):
            Face(isCited: cited.contains(fact.id), surface: Theme.chip) {
                Label(fact.company, systemImage: "building.2.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(fact.text).font(.subheadline)
                Text("\(fact.sourceHost) · \(fact.ageLine)").font(.caption2).foregroundStyle(.secondary)
            }
        }
    }

    private var accessibilityText: String {
        let theirs = junction.others.map { other in
            switch other {
            case let .line(line): "\(line.text). \(line.whoLine)"
            case let .fact(fact): "\(fact.company): \(fact.text). From \(fact.sourceHost), \(fact.ageLine)"
            }
        }
        return "You: \(junction.you.text). Crosses with: \(theirs.joined(separator: "; "))"
    }
}

/// The person's side of a crossing; kept plain so their own words read first.
struct YourFace: View {
    let item: YourItem
    let isCited: Bool

    var body: some View {
        Face(isCited: isCited, surface: Theme.raised) {
            Label(item.kind.title, systemImage: item.kind.symbol)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.action)
            Text(item.text).font(.subheadline)
        }
    }
}

/// A small card face; an item the latest answer leaned on gets a sand outline.
struct Face<Content: View>: View {
    let isCited: Bool
    let surface: Color
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6) { content }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .background(surface, in: .rect(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(isCited ? Theme.agent : Theme.hairline, lineWidth: isCited ? 2 : 1))
    }
}

/// The link itself: a short line with a node in the middle, like a change of trains on a route.
private struct Connector: View {
    let vertical: Bool

    var body: some View {
        ZStack {
            Capsule()
                .fill(Theme.agent.opacity(0.6))
                .frame(width: vertical ? 3 : 18, height: vertical ? 18 : 3)
            Circle()
                .fill(Theme.agent)
                .frame(width: 9, height: 9)
        }
        .frame(width: vertical ? 18 : 18, height: 18)
        .accessibilityHidden(true)
    }
}
