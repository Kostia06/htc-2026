import SwiftUI

/// A small red dot while the call is being recorded for the replay, so the person knows it is.
struct RecordingDot: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isDim = false

    var body: some View {
        Label {
            Text("Recording")
        } icon: {
            Circle()
                .fill(.red)
                .frame(width: 8, height: 8)
                .opacity(isDim ? 0.35 : 1)
        }
        .font(.caption.weight(.medium))
        .foregroundStyle(.secondary)
        .accessibilityLabel("Recording for replay")
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1).repeatForever(autoreverses: true)) { isDim = true }
        }
    }
}
