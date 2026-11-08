import SkillitKit
import SwiftUI

/// The service's own logo on a tile in its brand colour, so each row is recognisable at a glance. A service the app
/// doesn't have a logo for falls back to its kind of work.
struct ServiceLogo: View {
    let connection: WorkConnection
    @Environment(\.colorScheme) private var colorScheme

    private static let tileSize: CGFloat = 36

    var body: some View {
        RoundedRectangle(cornerRadius: 9, style: .continuous)
            .fill(brand?.tile(colorScheme) ?? Color(.tertiarySystemFill))
            .overlay {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .strokeBorder(Color(.separator), lineWidth: brand?.needsOutline ?? false ? 0.5 : 0)
            }
            .overlay { glyph }
            .frame(width: Self.tileSize, height: Self.tileSize)
            .accessibilityHidden(true)
    }

    @ViewBuilder private var glyph: some View {
        if let brand {
            Image("ServiceLogos/\(connection.id)")
                .resizable()
                .scaledToFit()
                .foregroundStyle(brand.glyph(colorScheme))
                .padding(brand.isMulticolour ? 7 : 8)
        } else {
            Image(systemName: connection.category.symbol)
                .foregroundStyle(.secondary)
        }
    }

    private var brand: Brand? {
        Brand(rawValue: connection.id)
    }
}

/// Official brand colours. Everything around the tile stays on the app's theme.
private enum Brand: String {
    case github, gitlab, bitbucket, dribbble, notion, googledrive, youtube

    var isMulticolour: Bool {
        self == .googledrive
    }

    /// dark tiles on a dark background, and the white Drive tile on a light one, need an edge to read as tiles
    var needsOutline: Bool {
        self == .github || self == .googledrive
    }

    func tile(_ scheme: ColorScheme) -> Color {
        switch self {
        case .github: Color(red: 0x18 / 255, green: 0x17 / 255, blue: 0x17 / 255)
        case .gitlab: Color(red: 0xFC / 255, green: 0x6D / 255, blue: 0x26 / 255)
        case .bitbucket: Color(red: 0x00 / 255, green: 0x52 / 255, blue: 0xCC / 255)
        case .dribbble: Color(red: 0xEA / 255, green: 0x4C / 255, blue: 0x89 / 255)
        case .notion: scheme == .dark ? .white : .black
        case .googledrive: .white
        case .youtube: Color(red: 0xFF / 255, green: 0x00 / 255, blue: 0x00 / 255)
        }
    }

    func glyph(_ scheme: ColorScheme) -> Color {
        self == .notion && scheme == .dark ? .black : .white
    }
}
