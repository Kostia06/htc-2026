import SkillitKit
import SwiftUI

/// One line from everyone on the road, with "That's me too" so the person can stand behind it.
struct RoadLineRow: View {
    let line: RoadLine
    let isCited: Bool
    let onMeToo: () -> Void

    var body: some View {
        Face(isCited: isCited, surface: Theme.raised) {
            Label(line.kind.title, systemImage: line.kind.symbol)
                .font(.caption.weight(.semibold))
                .foregroundStyle(line.kind.tint)
            Text(line.text).font(.subheadline)
            HStack(alignment: .center) {
                if !line.whoLine.isEmpty {
                    Text(line.whoLine).font(.caption2).foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                // interview questions are reported, not lived: there's nothing to stand behind
                if line.kind != .interview {
                    meTooButton
                }
            }
        }
    }

    private var meTooButton: some View {
        Button(action: onMeToo) {
            Label(line.meToo ? "Me too" : "That's me too", systemImage: line.meToo ? "checkmark" : "plus")
                .font(.caption.weight(.semibold))
                .foregroundStyle(line.meToo ? Theme.onAction : .primary)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(line.meToo ? Theme.action : Theme.chip, in: .capsule)
        }
        .buttonStyle(.raisedChip(line.meToo ? Theme.action : Theme.chip))
        .accessibilityLabel("That's me too")
        .accessibilityAddTraits(line.meToo ? .isSelected : [])
        .accessibilityHint("Adds you, anonymously, to the people behind this line")
    }
}

/// A researched fact, with the source one tap away so the person can check it themselves.
struct ResearchRow: View {
    let fact: ResearchFact
    let isCited: Bool

    var body: some View {
        Face(isCited: isCited, surface: Theme.raised) {
            Label(fact.company, systemImage: "building.2.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(fact.text).font(.subheadline)
            HStack(spacing: 4) {
                if let url = URL(string: fact.sourceUrl) {
                    Link(fact.sourceHost, destination: url).tint(Theme.action)
                } else {
                    Text(fact.sourceHost)
                }
                Text("· researched \(fact.ageLine)").foregroundStyle(.secondary)
            }
            .font(.caption2)
        }
    }
}
