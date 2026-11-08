import SwiftUI

/// Shown only when the person reached the end before the resume was read: a short wait, in the agent's colour.
struct FinishingUpView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "sparkles")
                .font(.largeTitle)
                .foregroundStyle(Theme.agent)
                .symbolEffect(.pulse)
            Text("Finishing up")
                .font(.title2.bold())
                .foregroundStyle(Theme.agent)
            Text("Adding what's on your resume to your answers.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.ground)
        .accessibilityElement(children: .combine)
    }
}
