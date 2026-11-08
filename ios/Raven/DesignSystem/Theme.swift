import SwiftUI

/// Raven's palette: near-black ground, muted sage for actions, warm sand for anything the agent is doing.
enum Theme {
    static let action = Color(red: 0.66, green: 0.78, blue: 0.64)
    /// The pastels are light, so text and icons sitting on them are dark rather than white.
    static let onAction = Color(red: 0.08, green: 0.05, blue: 0.16)
    static let agent = Color(red: 0.89, green: 0.82, blue: 0.68)
    // a deep green-charcoal instead of pure black, so the background belongs with the sage and sand
    static let ground = Color(red: 0.06, green: 0.075, blue: 0.065)
    static let raised = Color(red: 0.11, green: 0.13, blue: 0.115)
    static let hairline = Color(red: 0.85, green: 0.92, blue: 0.85, opacity: 0.09)
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
