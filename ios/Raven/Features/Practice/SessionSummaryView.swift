import RavenKit
import SwiftUI

/// What the agent made of the session and what to prepare next. `summary` is nil while it's being written.
struct SessionSummaryView: View {
    let summary: SessionSummary?
    let onDone: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("How it went")
                    .font(.largeTitle.bold())
                if let summary {
                    Text(summary.summary)
                    if !summary.prepList.isEmpty {
                        prepList(summary.prepList)
                    }
                } else {
                    SkeletonLines().ravenCard()
                    SkeletonLines(widths: [0.5, 0.9, 0.7], highlighted: 0).ravenCard()
                }
            }
            .padding(24)
        }
        .safeAreaInset(edge: .bottom) {
            Button(action: onDone) {
                Text("Done")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
            }
            .buttonStyle(.glassProminent)
            .controlSize(.large)
            .padding(24)
        }
        .background(Theme.ground)
    }

    private func prepList(_ steps: [SessionSummary.PrepStep]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Before the next one")
                .font(.headline)
            ForEach(Array(steps.enumerated()), id: \.offset) { _, step in
                VStack(alignment: .leading, spacing: 4) {
                    Text(step.step)
                        .font(.body.weight(.semibold))
                    Text(step.why)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .ravenCard()
            }
        }
    }
}
