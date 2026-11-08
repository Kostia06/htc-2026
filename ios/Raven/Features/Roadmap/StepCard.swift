import RavenKit
import SwiftUI

/// The details of one step, opened under its node with a pointer back up to it.
struct StepCard: View {
    let step: RoadmapStep
    /// How far the node sits from the centre line, so the pointer lines up with it.
    let pointerOffset: CGFloat
    let onChange: (RoadmapStep.Status) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                LabelChip(label: step.label)
                Label(step.estimate, systemImage: "clock")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Spacer(minLength: 0)
                Image(systemName: step.kind.symbol)
                    .foregroundStyle(.secondary)
                    .accessibilityLabel(step.kind.name)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(step.title)
                    .font(.title3.bold())
                Text(step.why)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            actions
        }
        .ravenCard()
        .overlay(alignment: .top) {
            Pointer()
                .fill(Theme.raised)
                .frame(width: 22, height: 11)
                .offset(x: pointerOffset, y: -10)
        }
    }

    @ViewBuilder private var actions: some View {
        switch step.status {
        case .todo:
            HStack(spacing: 12) {
                Button("Start") { onChange(.started) }
                    .buttonStyle(.raised)
                Button("Mark done") { onChange(.done) }
                    .buttonStyle(.raised(Color(white: 0.22)))
            }
        case .started:
            Button("Mark done") { onChange(.done) }
                .buttonStyle(.raised)
        case .done, .skipped:
            Button(step.status == .done ? "Not done yet" : "Bring it back") { onChange(.todo) }
                .buttonStyle(.raised(Color(white: 0.22)))
        }
    }
}

private struct LabelChip: View {
    let label: RoadmapStep.Label

    var body: some View {
        Text(label.text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(label == .readyNow ? Theme.action : .secondary)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(label == .readyNow ? Theme.action.opacity(0.15) : Color(white: 0.16), in: .capsule)
    }
}

private struct Pointer: Shape {
    nonisolated func path(in rect: CGRect) -> Path {
        Path { path in
            path.move(to: CGPoint(x: rect.midX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
            path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
            path.closeSubpath()
        }
    }
}
