import SwiftUI

/// The roadmap tiles' feel for a tappable card or chip: a ledge under the face that the face sinks into when
/// pressed. The label keeps drawing its own face (a `skillitCard()`, a pill), so this only adds the ledge.
/// Kept for things that say "tap me"; long feeds stay flat or the screen gets busy.
struct RaisedSurfaceStyle: ButtonStyle {
    enum Outline {
        case card(cornerRadius: CGFloat)
        case chip
    }

    /// One depth for every card and chip, shallower than the buttons' so a whole card doesn't look chunky.
    static let depth: CGFloat = 4

    let surface: Color
    let outline: Outline
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        configuration.label
            .offset(y: pressed ? Self.depth : 0)
            .background(alignment: .bottom) { ledge.offset(y: Self.depth) }
            .padding(.bottom, Self.depth)
            // a slim pill still needs the full 44pt tap target around it
            .frame(minHeight: isChip ? 44 : nil)
            .contentShape(.rect)
            .animation(reduceMotion ? nil : .spring(duration: 0.15), value: pressed)
            .sensoryFeedback(.impact(weight: .light), trigger: pressed) { _, now in now }
    }

    @ViewBuilder private var ledge: some View {
        switch outline {
        case let .card(cornerRadius): RoundedRectangle(cornerRadius: cornerRadius).fill(surface.ledge)
        case .chip: Capsule().fill(surface.ledge)
        }
    }

    private var isChip: Bool {
        guard case .chip = outline else { return false }
        return true
    }
}

extension ButtonStyle where Self == RaisedSurfaceStyle {
    /// For a label that is a `skillitCard()` (or a card drawn the same way with another corner radius).
    static func raisedCard(cornerRadius: CGFloat = 20) -> RaisedSurfaceStyle {
        RaisedSurfaceStyle(surface: Theme.raised, outline: .card(cornerRadius: cornerRadius))
    }

    /// For a capsule label filled with `surface`.
    static func raisedChip(_ surface: Color) -> RaisedSurfaceStyle {
        RaisedSurfaceStyle(surface: surface, outline: .chip)
    }
}

private extension Color {
    /// A light face gets a darker side, like the buttons. The dark card surfaces would vanish into the ground
    /// that way, so they get a slightly lighter side instead, the way Duolingo's dark mode does it.
    var ledge: Color {
        let resolved = resolve(in: EnvironmentValues())
        let brightness = 0.2126 * resolved.red + 0.7152 * resolved.green + 0.0722 * resolved.blue
        return brightness > 0.4 ? mix(with: .black, by: 0.35) : mix(with: .white, by: 0.08)
    }
}
