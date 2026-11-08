import Foundation

/// Something Raven has written down about the person. Stored encrypted on the server, readable only by them.
public struct PrivateMemory: Codable, Equatable, Sendable, Identifiable {
    public enum Kind: String, Codable, Sendable, CaseIterable {
        case goal, skill, weakness, preference, note
    }

    public let id: String
    public let kind: Kind
    public let text: String
    public let createdAt: String
    public let lastUsedAt: String?
    /// How many times this shaped an answer or a plan.
    public let uses: Int

    public init(id: String, kind: Kind, text: String, createdAt: String, lastUsedAt: String? = nil, uses: Int = 0) {
        self.id = id
        self.kind = kind
        self.text = text
        self.createdAt = createdAt
        self.lastUsedAt = lastUsedAt
        self.uses = uses
    }
}

public extension RavenClient {
    func memories() async throws(RavenError) -> [PrivateMemory] {
        let response: MemoriesResponse = try await send(authorized("GET", "api/me/memories"))
        return response.memories
    }

    func forgetMemory(id: String) async throws(RavenError) {
        do {
            let _: [String: Bool] = try await send(authorized("DELETE", "api/me/memories/\(id)"))
        } catch .unreadableResponse {
            // a 204 has no body to decode; any refusal was already thrown as `.rejected` before decoding
        }
    }

    /// Publishes a scrubbed copy of a note as an anonymous interview report for that company and role. The note itself stays private.
    func shareMemory(id: String, companySlug: String, role: String) async throws(RavenError) {
        let body = ShareBody(companySlug: companySlug, role: role)
        let _: [String: Bool] = try await send(authorized("POST", "api/me/memories/\(id)/share", json: body))
    }
}

private struct MemoriesResponse: Decodable { let memories: [PrivateMemory] }
private struct ShareBody: Encodable {
    let companySlug: String
    let role: String
}
