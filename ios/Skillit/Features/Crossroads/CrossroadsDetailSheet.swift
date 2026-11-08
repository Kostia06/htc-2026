import SkillitKit
import SwiftUI

/// Which card was tapped: the line or fact, and the person's item it matched, if any.
struct CrossroadsDetail: Identifiable, Equatable {
    let other: Match.Other
    let match: YourItem?

    var id: String {
        other.id
    }
}

/// Everything behind one Crossroads card: the full text, why it's on screen, how many people, the source, and
/// the card's one action. The line is read live from the model so "Me too" and "Add" update while the sheet is open.
struct CrossroadsDetailSheet: View {
    let detail: CrossroadsDetail
    let model: CrossroadsModel
    let goal: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        switch detail.other {
        case let .line(line):
            lineSheet(liveLine(line))
        case let .fact(fact):
            factSheet(fact)
        }
    }

    private func liveLine(_ line: RoadLine) -> RoadLine {
        model.view?.everyone.first { $0.id == line.id } ?? line
    }

    private func lineSheet(_ line: RoadLine) -> some View {
        DetailSheet {
            HStack(alignment: .firstTextBaseline) {
                Label(line.kind.title, systemImage: line.kind.symbol)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(line.kind.tint)
                Spacer(minLength: 8)
                if line.example {
                    ExampleTag()
                }
            }
            Text(line.text).font(.title3.weight(.semibold)).fixedSize(horizontal: false, vertical: true)
            FactGrid(facts: [
                .init(label: "People", value: peopleValue(line)),
                .init(label: "From", value: line.example ? "Skillit example" : "People on your road"),
            ])
            why(lineReasons(line))
        } footer: {
            lineAction(line)
        }
    }

    private func factSheet(_ fact: ResearchFact) -> some View {
        DetailSheet {
            Label(fact.company, systemImage: "building.2.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(fact.text).font(.title3.weight(.semibold)).fixedSize(horizontal: false, vertical: true)
            FactGrid(facts: [
                .init(label: "Researched", value: fact.ageLine.capitalizedFirst),
                .init(label: "Source", value: fact.sourceHost),
            ])
            why(factReasons(fact))
        } footer: {
            if let url = URL(string: fact.sourceUrl) {
                Link(destination: url) {
                    Label("Open the source", systemImage: "arrow.up.right.square")
                }
                .buttonStyle(.raised)
            }
        }
    }

    private func why(_ reasons: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Why you're seeing this").font(.headline)
            ForEach(reasons, id: \.self) { reason in
                Label(reason, systemImage: "arrow.turn.down.right")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    @ViewBuilder private func lineAction(_ line: RoadLine) -> some View {
        if line.kind.isAddable {
            let isOnRoad = model.view?.isOnRoad(line) ?? false
            Button(isOnRoad ? "On your road" : "Add to my road", systemImage: isOnRoad ? "checkmark" : "plus") {
                Task { await model.addToRoad(line) }
            }
            .buttonStyle(.raised)
            .disabled(isOnRoad)
        } else {
            Button(line.meToo ? "You said me too" : "That's me too", systemImage: line.meToo ? "checkmark" : "hand.raised") {
                Task { await model.toggleMeToo(line) }
            }
            .buttonStyle(.raised)
            .accessibilityHint("Adds you, anonymously, to the people behind this")
        }
    }

    private func peopleValue(_ line: RoadLine) -> String {
        guard let people = line.people else { return "Fewer than \(model.view?.minPeople ?? 3)" }
        return "\(people)"
    }

    private func lineReasons(_ line: RoadLine) -> [String] {
        let source = line.example
            ? "Skillit wrote this example for the road to \(goal) until people share their own."
            : "People heading to \(goal) shared this when they landed, or while they were on the way."
        let count = line.people == nil
            ? "Counts show once \(model.view?.minPeople ?? 3) people have said the same, so nobody can be singled out."
            : nil
        return [detail.match.map { "It \($0.matchLine)." }, source, count].compactMap(\.self)
    }

    private func factReasons(_ fact: ResearchFact) -> [String] {
        [
            detail.match.map { "It \($0.matchLine)." },
            "\(fact.company) is an employer on your road to \(goal); Skillit read this from a public source \(fact.ageLine).",
        ].compactMap(\.self)
    }
}

private extension String {
    var capitalizedFirst: String {
        prefix(1).uppercased() + dropFirst()
    }
}
