import RavenKit
import SwiftUI

/// Everything finished, newest day first, with what the person said they did.
struct CompletedSection: View {
    let days: [CompletedDay]
    let namespace: Namespace.ID

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Done")
                .font(.title3.bold())
            ForEach(days) { day in
                VStack(alignment: .leading, spacing: 10) {
                    Text(day.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.leading, 4)
                    ForEach(day.steps) { step in
                        CompletedRow(step: step)
                            .matchedGeometryEffect(id: step.id, in: namespace)
                            .transition(.scale(scale: 0.96).combined(with: .opacity))
                    }
                }
            }
        }
    }
}

private struct CompletedRow: View {
    let step: RoadmapStep

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "checkmark.circle.fill")
                .font(.title3)
                .foregroundStyle(Theme.action)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(step.title)
                    .font(.subheadline.weight(.medium))
                if let note = step.note, !note.isEmpty {
                    Text(note)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 0)
            Image(systemName: step.kind.symbol)
                .font(.footnote)
                .foregroundStyle(.tertiary)
                .accessibilityLabel(step.kind.name)
        }
        .ravenCard()
        .accessibilityElement(children: .combine)
    }
}
