import SwiftUI

/// The one number from the session, drawn in as the view appears.
struct ScoreRing: View {
    let score: Int
    var size: CGFloat = 148

    @State private var shown = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color(white: 0.16), lineWidth: 12)
            Circle()
                .trim(from: 0, to: CGFloat(shown) / 100)
                .stroke(Theme.action, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 2) {
                Text(shown, format: .number)
                    .font(.system(size: size * 0.34, weight: .bold, design: .rounded))
                    .contentTransition(.numericText())
                    .monospacedDigit()
                Text("out of 100")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: size, height: size)
        .accessibilityElement()
        .accessibilityLabel("Score \(score) out of 100")
        .onAppear {
            withAnimation(reduceMotion ? nil : .spring(duration: 1.1, bounce: 0.15)) {
                shown = score
            }
        }
    }
}
