import RavenKit
import SwiftUI

/// One round step on the path: a coloured face on a darker ledge, like the raised buttons, that sinks when pressed.
struct PathNode: View {
    let step: RoadmapStep
    let state: NodeState
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.title2.weight(.heavy))
                .foregroundStyle(state == .upcoming ? Color(white: 0.45) : .white)
        }
        .buttonStyle(NodeButtonStyle(face: face))
        .background {
            if state == .current {
                PulsingRing()
            }
        }
        .overlay(alignment: .top) {
            if state == .current {
                StartBubble().offset(y: -46)
            }
        }
        .accessibilityLabel("\(step.title), \(accessibilityState)")
        .accessibilityHint("Shows the step's details")
    }

    private var symbol: String {
        switch state {
        case .done: "checkmark"
        case .skipped: "forward.fill"
        case .current, .upcoming: step.kind.symbol
        }
    }

    private var face: Color {
        switch state {
        case .done, .current: Theme.action
        case .skipped: Color(white: 0.3)
        case .upcoming: Color(white: 0.2)
        }
    }

    private var accessibilityState: String {
        switch state {
        case .done: "done"
        case .current: "up next"
        case .skipped: "skipped"
        case .upcoming: "not started"
        }
    }
}

private struct NodeButtonStyle: ButtonStyle {
    let face: Color
    private let size: CGFloat = 72
    private let depth: CGFloat = 7

    func makeBody(configuration: Configuration) -> some View {
        let sunk = configuration.isPressed ? depth : 0
        configuration.label
            .frame(width: size, height: size)
            .background(face, in: .circle)
            .overlay(Circle().strokeBorder(.white.opacity(0.12), lineWidth: 2).padding(4))
            .offset(y: sunk)
            .background(alignment: .bottom) {
                Circle()
                    .fill(face.mix(with: .black, by: 0.4))
                    .frame(width: size, height: size)
                    .offset(y: depth)
            }
            .padding(.bottom, depth)
            .animation(.spring(duration: 0.15), value: configuration.isPressed)
    }
}

/// A ring that breathes around the current step; it holds still when Reduce Motion is on.
private struct PulsingRing: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isExpanded = false

    var body: some View {
        Circle()
            .strokeBorder(Theme.action.opacity(isExpanded ? 0.15 : 0.55), lineWidth: 5)
            .frame(width: 96, height: 96)
            .scaleEffect(isExpanded ? 1.12 : 1)
            .offset(y: -3)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeInOut(duration: 1.1).repeatForever()) { isExpanded = true }
            }
    }
}

private struct StartBubble: View {
    var body: some View {
        Text("START")
            .font(.caption.weight(.heavy))
            .foregroundStyle(Theme.action)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Theme.raised, in: .rect(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.hairline, lineWidth: 2))
            .fixedSize()
            .accessibilityHidden(true)
    }
}
