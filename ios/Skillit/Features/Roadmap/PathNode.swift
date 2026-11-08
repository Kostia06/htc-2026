import SkillitKit
import SwiftUI

/// One stop on the winding path: a raised tile that sinks when pressed. Done tiles are filled,
/// the current one carries a "You're here" tag, the rest wait in grey.
struct PathNode: View {
    enum State {
        case done, current, upcoming
    }

    static let size: CGFloat = 68

    let step: RoadmapStep
    let state: State
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            Image(systemName: state == .done ? "checkmark" : step.kind.symbol)
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(state == .upcoming ? Color(white: 0.55) : Theme.onAction)
        }
        .buttonStyle(TileStyle(face: state == .upcoming ? Color(white: 0.2) : Theme.action, size: Self.size))
        .overlay(alignment: .top) {
            if state == .current {
                Text("You're here")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Theme.onAction)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Theme.agent, in: .capsule)
                    .fixedSize()
                    .offset(y: -22)
            }
        }
        .accessibilityLabel(step.title)
        .accessibilityValue(state == .done ? "Done" : state == .current ? "You're here" : "")
    }
}

/// A rounded square that sinks into its ledge when pressed, same feel as the raised buttons.
private struct TileStyle: ButtonStyle {
    let face: Color
    let size: CGFloat
    private let ledge: CGFloat = 6
    private let radius: CGFloat = 22

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        configuration.label
            .frame(width: size, height: size)
            .background(face, in: .rect(cornerRadius: radius))
            .offset(y: pressed ? ledge : 0)
            .background(
                RoundedRectangle(cornerRadius: radius)
                    .fill(face.mix(with: .black, by: 0.35))
                    .frame(width: size, height: size)
                    .offset(y: ledge),
            )
            .padding(.bottom, ledge)
            .animation(.spring(duration: 0.15), value: pressed)
            .sensoryFeedback(.impact(weight: .light), trigger: pressed) { _, now in now }
    }
}
