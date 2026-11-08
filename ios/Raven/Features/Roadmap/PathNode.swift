import RavenKit
import SwiftUI

/// One stop on the winding path. Done steps are filled, the current one pulses, the rest wait in grey.
struct PathNode: View {
    enum State {
        case done, current, upcoming
    }

    let step: RoadmapStep
    let state: State
    let onTap: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @SwiftUI.State private var pulsing = false

    private let size: CGFloat = 76

    var body: some View {
        Button(action: onTap) {
            Image(systemName: state == .done ? "checkmark" : step.kind.symbol)
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(state == .upcoming ? Color(white: 0.55) : .white)
        }
        .buttonStyle(NodeStyle(face: face, size: size))
        .background {
            if state == .current {
                Circle()
                    .stroke(Theme.action.opacity(0.5), lineWidth: 4)
                    .frame(width: size + 18, height: size + 18)
                    .scaleEffect(pulsing ? 1.08 : 0.96)
                    .opacity(pulsing ? 0.3 : 0.9)
                    .offset(y: -3)
            }
        }
        .onAppear {
            guard state == .current, !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) { pulsing = true }
        }
        .accessibilityLabel(step.title)
        .accessibilityValue(state == .done ? "Done" : state == .current ? "Up next" : "")
    }

    private var face: Color {
        switch state {
        case .done: Theme.action
        case .current: Theme.action
        case .upcoming: Color(white: 0.2)
        }
    }
}

/// A round button that sinks into its ledge when pressed, same feel as the raised buttons.
private struct NodeStyle: ButtonStyle {
    let face: Color
    let size: CGFloat
    private let ledge: CGFloat = 7

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        configuration.label
            .frame(width: size, height: size)
            .background(face, in: .circle)
            .offset(y: pressed ? ledge : 0)
            .background(
                Circle()
                    .fill(face.mix(with: .black, by: 0.35))
                    .frame(width: size, height: size)
                    .offset(y: ledge),
            )
            .padding(.bottom, ledge)
            .animation(.spring(duration: 0.15), value: pressed)
            .sensoryFeedback(.impact(weight: .light), trigger: pressed) { _, now in now }
    }
}
