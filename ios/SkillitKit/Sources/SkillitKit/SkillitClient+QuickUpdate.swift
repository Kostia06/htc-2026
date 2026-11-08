import Foundation

public extension SkillitClient {
    /// One plain-words update. Skillit applies it, or asks the one question it needs first; send the conversation back with the answer.
    func quickUpdate(_ request: QuickUpdateRequest) async throws(SkillitError) -> QuickUpdateReply {
        try await send(authorized("POST", "api/updates", json: request))
    }
}
