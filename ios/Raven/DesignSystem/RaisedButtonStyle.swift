import SwiftUI

/// Chunky button: a darker ledge under the face that the face sinks into when pressed.
struct RaisedButtonStyle: ButtonStyle {
    var color: Color = Theme.action
    var foreground: Color = Theme.onAction
    var depth: CGFloat = 5
    var cornerRadius: CGFloat = 16

    func makeBody(configuration: Configuration) -> some View {
        let sunk = configuration.isPressed ? depth : 0
        configuration.label
            .font(.headline)
            .foregroundStyle(foreground)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(color, in: .rect(cornerRadius: cornerRadius))
            .offset(y: sunk)
            .background(alignment: .bottom) {
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(color.mix(with: .black, by: 0.35))
                    .offset(y: depth)
            }
            .padding(.bottom, depth)
            .animation(.spring(duration: 0.15), value: configuration.isPressed)
            .sensoryFeedback(.impact(weight: .light), trigger: configuration.isPressed) { _, pressed in pressed }
    }
}

extension ButtonStyle where Self == RaisedButtonStyle {
    static var raised: RaisedButtonStyle { RaisedButtonStyle() }

    /// The quieter button that sits beside a `.raised` one.
    static var raisedSecondary: RaisedButtonStyle { RaisedButtonStyle(color: Theme.secondaryButton, foreground: .white) }

    static func raised(_ color: Color, foreground: Color = .white) -> RaisedButtonStyle {
        RaisedButtonStyle(color: color, foreground: foreground)
    }
}
