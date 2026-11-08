import SwiftUI

/// Placeholder bars shaped like the content they stand in for, with one agent-coloured bar, like the landing site.
struct SkeletonLines: View {
    var widths: [CGFloat] = [0.9, 0.7, 0.8, 0.5]
    var highlighted = 2

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(widths.indices, id: \.self) { index in
                Capsule()
                    .fill(index == highlighted ? Theme.agent.opacity(0.6) : Color(white: 0.2))
                    .containerRelativeFrame(.horizontal) { length, _ in length * widths[index] * 0.85 }
                    .frame(height: 10)
            }
        }
        .shimmering()
        .accessibilityElement()
        .accessibilityLabel("Loading")
    }
}

private struct Shimmer: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isDim = false

    func body(content: Content) -> some View {
        content
            .opacity(isDim ? 0.45 : 1)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeInOut(duration: 0.9).repeatForever()) { isDim = true }
            }
    }
}

extension View {
    /// A slow pulse for loading placeholders; still when Reduce Motion is on.
    func shimmering() -> some View {
        modifier(Shimmer())
    }
}
