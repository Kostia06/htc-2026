import Foundation

public extension RavenClient {
    /// One plain-words update. Raven applies it, or asks the one question it needs first; send the conversation back with the answer.
    func quickUpdate(_ request: QuickUpdateRequest) async throws(RavenError) -> QuickUpdateReply {
        try await send(authorized("POST", "api/updates", json: request))
    }
}
