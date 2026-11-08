import RavenKit
import SwiftUI

/// Slides up from the bottom when a node is tapped: what the step is, and either what you did or how to start it.
struct StepDetailSheet: View {
    let step: RoadmapStep
    let onPractice: () -> Void
    let onMarkDone: () -> Void

    private var isDone: Bool {
        step.status == .done
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    header
                    facts
                    if isDone, let note = step.note, !note.isEmpty {
                        block("What you did", text: note, systemImage: "checkmark.seal.fill", tint: Theme.action)
                    }
                    if !step.why.isEmpty {
                        block("Why this step", text: step.why, systemImage: "target", tint: Theme.agent)
                    }
                    if !step.detail.isEmpty {
                        block("How to do it", text: step.detail, systemImage: "list.bullet", tint: .secondary)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 28)
                .padding(.bottom, 16)
            }
            if !isDone {
                actions
                    .padding(.horizontal, 24)
                    .padding(.bottom, 12)
            }
        }
        .presentationDetents([.fraction(0.75), .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(Theme.ground)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            KindIcon(kind: step.kind, highlighted: true, size: 64)
            Text(step.kind.name.uppercased())
                .font(.caption.weight(.bold))
                .tracking(1.2)
                .foregroundStyle(Theme.action)
            Text(step.title)
                .font(.largeTitle.bold())
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var facts: some View {
        HStack(spacing: 10) {
            if isDone {
                fact(doneLine, systemImage: "checkmark.circle.fill", tint: Theme.action)
            } else {
                LabelChip(label: step.label)
                    .scaleEffect(1.15, anchor: .leading)
                    .padding(.trailing, 6)
            }
            if !step.estimate.isEmpty {
                fact(step.estimate, systemImage: "clock", tint: .secondary)
            }
        }
    }

    private func fact(_ text: String, systemImage: String, tint: Color) -> some View {
        Label(text, systemImage: systemImage)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(tint)
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
