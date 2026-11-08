import RavenKit
import SwiftUI

/// Slides up from the bottom when a node is tapped: what the step is, and either what you did or how to start it.
struct StepDetailSheet: View {
    let step: RoadmapStep
    let onPractice: () -> Void
    let onMarkDone: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 12) {
                    KindIcon(kind: step.kind, highlighted: true, size: 48)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(step.kind.name)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(step.title)
                            .font(.title3.bold())
                    }
                }
                if step.status == .done {
                    doneSummary
                } else {
                    details
                }
            }
            .padding(24)
        }
        .scrollBounceBehavior(.basedOnSize)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(Theme.ground)
    }

    private var doneSummary: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(doneLine, systemImage: "checkmark.circle.fill")
                .font(.headline)
                .foregroundStyle(Theme.action)
            if let note = step.note, !note.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("What you did")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(note)
                        .font(.body)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .ravenCard()
            }
            if !step.why.isEmpty {
                Text(step.why)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                LabelChip(label: step.label)
                if !step.estimate.isEmpty {
                    Label(step.estimate, systemImage: "clock")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            if !step.why.isEmpty {
                Text(step.why)
                    .font(.body)
            }
            if !step.detail.isEmpty {
                Text(step.detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let action = step.action {
                StartPracticeButton(
                    mode: action.type == .interview ? .interview : .networking,
                    companySlug: action.companySlug,
                    role: action.role,
                    stepID: step.id,
                    onPhone: onPractice,
                )
            } else {
                Button("Mark done", action: onMarkDone)
                    .buttonStyle(.raised)
            }
        }
    }

    private var doneLine: String {
        guard let stamp = step.completedAt,
              let date = try? Date(stamp, strategy: .iso8601)
        else { return "Done" }
        return "Done \(date.formatted(.relative(presentation: .named)))"
    }
}
