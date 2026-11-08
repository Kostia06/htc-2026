import SwiftUI

/// Raven's palette, taken from the landing site: near-black ground, one orange for actions, purple for anything the agent is doing.
enum Theme {
    static let action = Color(red: 1.0, green: 0.29, blue: 0.11)
    static let agent = Color(red: 0.49, green: 0.36, blue: 0.98)
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
