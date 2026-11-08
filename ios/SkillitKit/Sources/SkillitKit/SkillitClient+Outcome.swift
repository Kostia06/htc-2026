import Foundation

/// "I got the job." Sharing is a choice: only then does the road that got them there help the next person.
public struct GotTheJob: Encodable, Equatable, Sendable {
    public let role: String
    public let companySlug: String?
    public let share: Bool

    public init(role: String, companySlug: String?, share: Bool) {
        self.role = role
        self.companySlug = companySlug
        self.share = share
    }

    enum CodingKeys: String, CodingKey {
        case role, share
        case companySlug = "company"
    }
}

/// What went into the shared trail: step kinds and skills only, never the person's words.
public struct OutcomeResult: Decodable, Equatable, Sendable {
    public let shared: Bool
    public let steps: [String]
    public let skills: [String]
}

public extension SkillitClient {
    func recordOutcome(_ outcome: GotTheJob) async throws(SkillitError) -> OutcomeResult {
        try await send(authorized("POST", "api/me/outcome", json: outcome))
    }
}
