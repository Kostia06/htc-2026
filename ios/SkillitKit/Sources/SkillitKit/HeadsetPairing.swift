import Foundation

/// The 4 digits the phone shows so a headset can join the same account by typing them in.
public struct HeadsetCode: Equatable, Sendable {
    public let digits: String
    public let expiresAt: Date

    public init(digits: String, expiresAt: Date) {
        self.digits = digits
        self.expiresAt = expiresAt
    }
}

public enum HeadsetCodeStatus: String, Decodable, Sendable {
    case waiting
    case claimed
    case expired
}

/// What the pairing screen needs from the server, so screenshots and previews can run without one.
public protocol HeadsetCodeIssuer: Sendable {
    func offerHeadsetCode() async throws(SkillitError) -> HeadsetCode
    func headsetCodeStatus(_ code: HeadsetCode) async throws(SkillitError) -> HeadsetCodeStatus
}
