import SkillitKit
import SwiftUI

/// One line from everyone on the road: what it is, why it's shown, and the one thing to do with it.
struct LineCard: View {
    let line: RoadLine
    var match: YourItem?
    let isCited: Bool
    let isOnRoad: Bool
    let onMeToo: () -> Void
    let onAdd: () -> Void

    var body: some View {
        Face(isCited: isCited) {
            HStack(alignment: .firstTextBaseline) {
                Label(line.kind.title, systemImage: line.kind.symbol)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(line.kind.tint)
                Spacer(minLength: 8)
                if line.example {
                    ExampleTag()
                }
            }
            Text(line.text).font(.body)
            ReasonLine(text: line.reason(matching: match), isMatch: match != nil)
            action.padding(.top, 2)
        }
    }

    @ViewBuilder private var action: some View {
        if line.kind.isAddable {
            CardAction(
                title: isOnRoad ? "On your road" : "Add to my road", symbol: isOnRoad ? "checkmark" : "plus", isOn: isOnRoad,
                action: onAdd,
            )
            .disabled(isOnRoad)
            .accessibilityHint(isOnRoad ? "" : "Adds this as a step on your road")
        } else {
            CardAction(
                title: line.meToo ? "Me too" : "That's me too", symbol: line.meToo ? "checkmark" : "hand.raised", isOn: line.meToo,
                action: onMeToo,
            )
            .accessibilityLabel("That's me too")
            .accessibilityHint("Adds you, anonymously, to the people behind this")
        }
    }
}

/// A researched fact about an employer on the road, with the source one tap away.
struct FactCard: View {
    let fact: ResearchFact
    var match: YourItem?
    let isCited: Bool

    var body: some View {
        Face(isCited: isCited) {
            Label(fact.company, systemImage: "building.2.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(fact.text).font(.body)
            ReasonLine(text: fact.reason(matching: match), isMatch: match != nil)
            if let url = URL(string: fact.sourceUrl) {
                Link(destination: url) {
                    Label("Source: \(fact.sourceHost)", systemImage: "arrow.up.right.square")
                        .font(.footnote.weight(.semibold))
                }
                .tint(Theme.action)
            }
        }
    }
}

/// The single action a card offers: a small capsule that fills sage once it's on.
private struct CardAction: View {
    let title: String
    let symbol: String
    let isOn: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(isOn ? Theme.onAction : .primary)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(isOn ? Theme.action : Theme.chip, in: .capsule)
        }
        .buttonStyle(.raisedChip(isOn ? Theme.action : Theme.chip))
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }
}
