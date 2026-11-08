import SwiftUI

/// Seven rounded bars that show who is talking: sage while the person answers, sand while the agent speaks,
/// a slow breath while it thinks. With Reduce Motion the bars hold still and loudness shows as brightness.
struct VoiceBar: View {
    let state: VoiceState
    let level: Float

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private static let profile: [CGFloat] = [0.38, 0.62, 0.86, 1, 0.86, 0.62, 0.38]
    private static let tallest: CGFloat = 120

    var body: some View {
        TimelineView(.animation(paused: reduceMotion || state == .connecting)) { context in
            let time = context.date.timeIntervalSinceReferenceDate
            HStack(spacing: 10) {
                ForEach(Self.profile.indices, id: \.self) { index in
                    Capsule()
                        .fill(color)
                        .frame(width: 16, height: height(of: index, at: time))
                }
            }
            .frame(height: Self.tallest)
        }
        .opacity(reduceMotion ? 0.35 + 0.65 * Double(level) : 1)
        .animation(.spring(duration: 0.2), value: level)
        .animation(.easeInOut(duration: 0.4), value: state)
        .modifier(PulseWhileConnecting(isConnecting: state == .connecting))
        .accessibilityElement()
        .accessibilityLabel(state.label)
    }

    private var color: Color {
        switch state {
        case .connecting: Color(white: 0.22)
        case .listening: Theme.action
        case .speaking: Theme.agent
        case .thinking: Theme.agent.opacity(0.55)
        }
    }

    private func height(of index: Int, at time: TimeInterval) -> CGFloat {
        let shape = Self.profile[index]
        let fraction: CGFloat = switch state {
        case .connecting:
            0.14
        case .thinking:
            reduceMotion ? 0.2 : 0.16 + 0.1 * shape * (0.5 + 0.5 * sin(time * 1.6))
        case .listening, .speaking:
            if reduceMotion {
                0.6 * shape
            } else {
                // each bar drifts on its own phase so a steady level still reads as a voice, not a meter
                max(0.14, shape * CGFloat(level) * (0.75 + 0.25 * sin(time * 7 + Double(index) * 1.3)))
            }
        }
        return fraction * Self.tallest
    }
}

private struct PulseWhileConnecting: ViewModifier {
    let isConnecting: Bool

    func body(content: Content) -> some View {
        if isConnecting {
            content.shimmering()
        } else {
            content
        }
    }
}
