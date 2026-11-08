import SwiftUI

/// A Duolingo-style answer tile: an outlined face on a ledge that turns orange once picked.
struct OptionButtonStyle: ButtonStyle {
    var isSelected: Bool
    var isFullWidth = true

    private let depth: CGFloat = 4
    private let cornerRadius: CGFloat = 14

    func makeBody(configuration: Configuration) -> some View {
        let edge = isSelected ? Theme.action : Color(white: 0.24)
        let sunk = configuration.isPressed ? depth : 0
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(isSelected ? Theme.action : .primary)
            .multilineTextAlignment(.leading)
            .frame(maxWidth: isFullWidth ? .infinity : nil, minHeight: 28, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            // opaque under the tint, or the ledge below shows through the face
            .background {
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(Theme.raised)
                    .overlay(RoundedRectangle(cornerRadius: cornerRadius).fill(isSelected ? Theme.action.opacity(0.14) : .clear))
            }
            .overlay(RoundedRectangle(cornerRadius: cornerRadius).strokeBorder(edge, lineWidth: 2))
            .offset(y: sunk)
            .background(alignment: .bottom) {
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(edge)
                    .offset(y: depth)
            }
            .padding(.bottom, depth)
            .contentShape(.rect)
            .animation(.spring(duration: 0.15), value: configuration.isPressed)
    }
}
