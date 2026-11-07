import Foundation

/// The code a headset shows as a QR, either as a `raven://pair?code=` link or typed by hand.
public struct PairingCode: Equatable, Sendable {
    public let value: String

    private static let length = 8
    /// matches the server's alphabet: no 0/O or 1/I/L, so a typed code can't be misread
    private static let allowed = Set("23456789ABCDEFGHJKMNPQRSTUVWXYZ")

    public init?(typed text: String) {
        let cleaned = text.uppercased().filter { $0.isLetter || $0.isNumber }
        guard cleaned.count == Self.length, cleaned.allSatisfy(Self.allowed.contains) else { return nil }
        value = cleaned
    }

    public init?(link: URL) {
        guard link.scheme == "raven", link.host() == "pair",
              let code = URLComponents(url: link, resolvingAgainstBaseURL: false)?
                  .queryItems?.first(where: { $0.name == "code" })?.value
        else { return nil }
        self.init(typed: code)
    }

    /// Accepts whatever the camera read: a full link or a bare code.
    public init?(scanned payload: String) {
        if let url = URL(string: payload), url.scheme != nil {
            self.init(link: url)
        } else {
            self.init(typed: payload)
        }
    }
}
