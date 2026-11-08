import SwiftUI

/// Raven's palette: near-black ground, lavender for actions, mint for anything the agent is doing.
enum Theme {
    static let action = Color(red: 0.73, green: 0.65, blue: 1.0)
    /// Lavender is light, so text and icons sitting on it are dark rather than white.
    static let onAction = Color(red: 0.08, green: 0.05, blue: 0.16)
    static let agent = Color(red: 0.40, green: 0.86, blue: 0.76)
    static let ground = Color(red: 0.03, green: 0.03, blue: 0.03)
    static let raised = Color(white: 0.09)
    static let hairline = Color(white: 1, opacity: 0.08)
}

extension View {
    /// The card surface used across the app: flat, hairline edge, no shadow.
    func ravenCard() -> some View {
        padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.raised, in: .rect(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(Theme.hairline))
    }
}
