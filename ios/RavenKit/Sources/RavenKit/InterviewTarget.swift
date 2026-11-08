import Foundation

/// What the person is interviewing for, picked before a practice session starts and remembered for the next one.
public enum InterviewTarget: Codable, Equatable, Hashable, Sendable {
    /// A saved posting decides the role and the company on the server.
    case posting(id: String, title: String, company: String)
    case role(String)
    case company(slug: String, name: String)
    /// Free text: whatever they typed stands in as the role.
    case other(String)

    public var title: String {
        switch self {
        case let .posting(_, title, _): title
        case let .role(role): role
        case let .company(_, name): name
        case let .other(text): text
        }
    }

    /// The second line in a picker row; nil when the title says it all.
    public var subtitle: String? {
        switch self {
        case let .posting(_, _, company): company
        case .company: "Company"
        case .role, .other: nil
        }
    }

    public func request(difficulty: PracticeDifficulty) -> VoiceSessionRequest {
        switch self {
        case let .posting(id, _, _): VoiceSessionRequest(mode: .interview, difficulty: difficulty, postingId: id)
        case let .role(role): VoiceSessionRequest(mode: .interview, role: role, difficulty: difficulty)
        case let .company(slug, _): VoiceSessionRequest(mode: .interview, companySlug: slug, difficulty: difficulty)
        case let .other(text): VoiceSessionRequest(mode: .interview, role: text, difficulty: difficulty)
        }
    }

    /// The target a roadmap step points at: its posting first, else the company, else the role.
    public init?(action: RoadmapAction, postings: [JobPosting], companyName: (String) -> String?) {
        if let id = action.postingId, let posting = postings.first(where: { $0.id == id }) {
            self = .posting(id: id, title: posting.title, company: posting.company)
        } else if let slug = action.companySlug {
            self = .company(slug: slug, name: companyName(slug) ?? slug)
        } else if let role = action.role {
            self = .role(role)
        } else {
            return nil
        }
    }
}
