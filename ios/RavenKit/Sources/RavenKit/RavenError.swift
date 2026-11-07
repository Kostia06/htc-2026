import Foundation

public enum RavenError: Error, Equatable, Sendable {
    case unauthorized
    case offline
    /// The server said no, with a message written for people.
    case rejected(status: Int, message: String)
    case unreadableResponse

    public var message: String {
        switch self {
        case .unauthorized: "You were signed out. Sign in again to continue."
        case .offline: "You're offline. Check your connection and try again."
        case let .rejected(_, message): message
        case .unreadableResponse: "Something went wrong on our side. Try again in a moment."
        }
    }
}
