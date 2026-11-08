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

    /// A role or free text has no employer yet, so the picker can offer a local company to prepare for.
    public var canAddCompany: Bool {
        switch self {
        case .role, .other: true
        case .posting, .company: false
        }
    }

    /// The request with a local company added; ignored when the target already has its own.
    public func request(difficulty: PracticeDifficulty, at companySlug: String?) -> VoiceSessionRequest {
        var request = request(difficulty: difficulty)
        if canAddCompany, let companySlug {
            request.companySlug = companySlug
        }
        return request
    }

    public func request(difficulty: PracticeDifficulty) -> VoiceSessionRequest {
        switch self {
        case let .posting(id, _, _): VoiceSessionRequest(mode: .interview, difficulty: difficulty, postingId: id)
        case let .role(role): VoiceSessionRequest(mode: .interview, role: role, difficulty: difficulty)
        case let .company(slug, _): VoiceSessionRequest(mode: .interview, companySlug: slug, difficulty: difficulty)
        case let .other(text): VoiceSessionRequest(mode: .interview, role: text, difficulty: difficulty)
        }
    }

    /// The same interview sent to the headset. A launch carries only a role and a company slug (no posting id),
    /// so a posting goes as its title, with the slug the caller matched from its company name.
    public func headsetLaunch(at companySlug: String?) -> HeadsetLaunch {
        switch self {
        case let .posting(_, title, _): HeadsetLaunch(mode: .interview, companySlug: companySlug, role: title)
        case let .role(role): HeadsetLaunch(mode: .interview, companySlug: companySlug, role: role)
        case let .company(slug, _): HeadsetLaunch(mode: .interview, companySlug: slug)
        case let .other(text): HeadsetLaunch(mode: .interview, companySlug: companySlug, role: text)
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
