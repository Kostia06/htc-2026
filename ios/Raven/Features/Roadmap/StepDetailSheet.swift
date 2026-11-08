import RavenKit
import SwiftUI

/// Slides up from the bottom when a node is tapped: what the step is, in a glance, and the one way to start it.
struct StepDetailSheet: View {
    let step: RoadmapStep
    let onPractice: () -> Void
    let onMarkDone: () -> Void

    private var isDone: Bool {
        step.status == .done
    }

    var body: some View {
        DetailSheet {
            Text(step.title)
                .font(.title2.bold())
                .fixedSize(horizontal: false, vertical: true)
            if !step.why.isEmpty {
                Label(step.why, systemImage: "target")
                    .font(.subheadline)
                    .foregroundStyle(Theme.agent)
                    .lineLimit(2)
            }
            FactGrid(facts: facts)
            if isDone, let note = step.note, !note.isEmpty {
                labelled("What you did", text: note)
            }
            if !step.detail.isEmpty {
                labelled("How", text: step.detail)
            }
        } footer: {
            if !isDone {
                actions
            }
        }
    }

    private var facts: [FactGrid.Fact] {
        var facts = [FactGrid.Fact(label: "Kind", value: step.kind.name)]
        if isDone {
            facts.append(.init(label: "Status", value: doneLine, tint: Theme.positive))
        } else {
            facts.append(.init(label: "Status", value: step.label.text))
        }
        if !step.estimate.isEmpty {
            facts.append(.init(label: "Time", value: step.estimate))
        }
        return facts
    }

    private func labelled(_ title: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            ExpandableText(text: text)
        }
    }

    @ViewBuilder private var actions: some View {
        if let action = step.action {
            StartPracticeButton(companySlug: action.companySlug, role: action.role, stepID: step.id, onPhone: onPractice)
        } else {
            Button("Mark done", action: onMarkDone)
                .buttonStyle(.raised)
        }
    }

    private var doneLine: String {
        guard let stamp = step.completedAt,
              let date = try? Date(stamp, strategy: .iso8601)
        else { return "Done" }
        return "Done \(date.formatted(.relative(presentation: .named)))"
    }
}
