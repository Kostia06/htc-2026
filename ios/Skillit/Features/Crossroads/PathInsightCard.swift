import SkillitKit
import SwiftUI

/// The one insight on top: the path most people took to the person's role, and how much of it they've done.
struct PathInsightCard: View {
    let insight: PathInsight
    /// Other roles that worked on this road, named in one quiet line.
    let otherRoles: [String]
    let isCited: Bool

    var body: some View {
        Face(isCited: isCited) {
            HStack(alignment: .firstTextBaseline) {
                Text(lead).font(.subheadline).foregroundStyle(.secondary)
                Spacer(minLength: 8)
                if insight.isExample {
                    ExampleTag()
                }
            }
            Text("You've done \(insight.doneCount) of \(insight.steps.count)")
                .font(.title2.bold())
            PathSteps(steps: insight.steps, done: insight.done)
            if let next = insight.next {
                Label("Next on this path: \(next.name)", systemImage: "arrow.right.circle.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.action)
            }
            if !otherRoles.isEmpty {
                Text("Also worked: \(otherRoles.joined(separator: ", "))")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
    }

    private var lead: String {
        if let people = insight.people {
            return "\(people) people who got \(insight.role) took this path"
        }
        return "A typical path to \(insight.role)"
    }

    private var accessibilityText: String {
        let steps = insight.steps.map { "\($0.name)\(insight.done.contains($0) ? ", done" : "")" }.joined(separator: "; ")
        let next = insight.next.map { ". Next: \($0.name)" } ?? ""
        let example = insight.isExample ? "Example. " : ""
        return "\(example)\(lead). You've done \(insight.doneCount) of \(insight.steps.count): \(steps)\(next)"
    }
}

/// The path as labelled tiles: done ones filled teal, the rest outlined. Wraps rather than shrinking text.
private struct PathSteps: View {
    let steps: [RoadmapStep.Kind]
    let done: Set<RoadmapStep.Kind>

    var body: some View {
        FlowLayout(spacing: 6) {
            ForEach(steps, id: \.self) { kind in
                let isDone = done.contains(kind)
                HStack(spacing: 5) {
                    Image(systemName: isDone ? "checkmark" : kind.symbol)
                    Text(kind.name)
                }
                .font(.footnote.weight(.semibold))
                .lineLimit(1)
                .fixedSize()
                .foregroundStyle(isDone ? Theme.onAction : .primary)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(isDone ? Theme.positive : Theme.chip, in: .capsule)
            }
        }
    }
}
