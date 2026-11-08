import CryptoKit
import Foundation

/// A one-time value that ties an Apple identity token to this sign-in attempt, so a stolen token can't be replayed.
/// Apple gets `hashed`; Supabase gets `raw` and checks that it hashes to what Apple signed.
public struct SignInNonce: Sendable, Equatable {
    public let raw: String
    public let hashed: String

    public init() {
        let alphabet = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var generator = SystemRandomNumberGenerator()
        raw = String((0 ..< 32).map { _ in alphabet.randomElement(using: &generator) ?? "0" })
        hashed = SHA256.hash(data: Data(raw.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

/// An address worth sending a sign-in code to. Only a sanity check: the code itself proves the inbox is real.
public struct EmailAddress: Sendable, Equatable {
    public let value: String

    public init?(typed: String) {
        let trimmed = typed.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard trimmed.wholeMatch(of: /[^@\s]+@[^@\s]+\.[^@\s]+/) != nil else { return nil }
        value = trimmed
    }
}

/// The six-digit code from the sign-in email, tolerant of the spaces people paste with it.
public struct OneTimeCode: Sendable, Equatable {
    public static let length = 6
    public let value: String

    public init?(typed: String) {
        let digits = typed.filter { !$0.isWhitespace }
        guard digits.count == Self.length, digits.allSatisfy(\.isASCII), digits.allSatisfy(\.isNumber) else { return nil }
        value = digits
    }
}
