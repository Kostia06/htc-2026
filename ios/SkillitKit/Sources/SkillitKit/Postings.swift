import Foundation

/// One line of a posting's asks, marked by the server against the profile: `have` is code's call, never the model's.
public struct PostingRequirement: Decodable, Equatable, Sendable, Identifiable {
    public let text: String
    public let topic: String
    public let required: Bool
    public let have: Bool
    public let evidence: String?

    public var id: String {
        text
    }

    public init(text: String, topic: String, required: Bool, have: Bool, evidence: String? = nil) {
        self.text = text
        self.topic = topic
        self.required = required
        self.have = have
        self.evidence = evidence
    }
}

/// What the server set up from the posting: a target role, a company it now researches, and roadmap steps.
public struct PostingPrefill: Decodable, Equatable, Sendable {
    public struct Company: Decodable, Equatable, Sendable {
        public let slug: String
        public let name: String
        public let researchQueued: Bool

        public init(slug: String, name: String, researchQueued: Bool) {
            self.slug = slug
            self.name = name
            self.researchQueued = researchQueued
        }
    }

    public let targetRole: String?
    public let company: Company?
    public let steps: [String]

    public init(targetRole: String? = nil, company: Company? = nil, steps: [String] = []) {
        self.targetRole = targetRole
        self.company = company
        self.steps = steps
    }

    /// One change per thing set up, typed like a quick update's so the app reloads the right things.
    public var appliedChanges: [AppliedChange] {
        var changes: [AppliedChange] = []
        if let targetRole { changes.append(AppliedChange(type: "add_target_role", summary: "Added target role \(targetRole)")) }
        if let company {
            let summary = company.researchQueued ? "Researching \(company.name)" : "Added \(company.name)"
            changes.append(AppliedChange(type: "add_company", summary: summary))
        }
        changes.append(contentsOf: steps.map { AppliedChange(type: "add_step", summary: "Added step \"\($0)\"") })
        return changes
    }

    public var isEmpty: Bool {
        targetRole == nil && company == nil && steps.isEmpty
    }
}

/// A job posting the person is preparing for, as `/api/postings` returns it.
public struct JobPosting: Decodable, Equatable, Sendable, Identifiable {
    public let id: String
    public let title: String
    public let company: String
    public let companySlug: String?
    public let location: String?
    public let seniority: String?
    public let requirements: [PostingRequirement]
    public let responsibilities: [String]
    public let skills: [String]
    public let sourceURL: URL?
    public let prefilled: PostingPrefill
    public let createdAt: String?

    public init(
        id: String, title: String, company: String, companySlug: String? = nil, location: String? = nil, seniority: String? = nil,
        requirements: [PostingRequirement] = [], responsibilities: [String] = [], skills: [String] = [], sourceURL: URL? = nil,
        prefilled: PostingPrefill = PostingPrefill(), createdAt: String? = nil,
    ) {
        self.id = id
        self.title = title
        self.company = company
        self.companySlug = companySlug
        self.location = location
        self.seniority = seniority
        self.requirements = requirements
        self.responsibilities = responsibilities
        self.skills = skills
        self.sourceURL = sourceURL
        self.prefilled = prefilled
        self.createdAt = createdAt
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decode(String.self, forKey: .title)
        company = try container.decode(String.self, forKey: .company)
        companySlug = try container.decodeIfPresent(String.self, forKey: .companySlug)
        location = try container.decodeIfPresent(String.self, forKey: .location)
        seniority = try container.decodeIfPresent(String.self, forKey: .seniority)
        requirements = try container.decodeIfPresent([PostingRequirement].self, forKey: .requirements) ?? []
        responsibilities = try container.decodeIfPresent([String].self, forKey: .responsibilities) ?? []
        skills = try container.decodeIfPresent([String].self, forKey: .skills) ?? []
        sourceURL = try container.decodeIfPresent(String.self, forKey: .sourceURL).flatMap(URL.init(string:))
        prefilled = try container.decodeIfPresent(PostingPrefill.self, forKey: .prefilled) ?? PostingPrefill()
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
    }

    public var haveCount: Int {
        requirements.count { $0.have }
    }

    /// "6 of 9 requirements", or "No requirements listed" when the posting named none.
    public var requirementsLine: String {
        requirements.isEmpty ? "No requirements listed" : "\(haveCount) of \(requirements.count) requirements"
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, company, companySlug, location, seniority, requirements, responsibilities, skills, prefilled, createdAt
        case sourceURL = "sourceUrl"
    }
}

/// A posting to import: its link, or its text when the site can't be read for us.
public struct PostingImportRequest: Encodable, Equatable, Sendable {
    public var url: URL?
    public var text: String?

    public init(url: URL) {
        self.url = url
    }

    public init(text: String) {
        self.text = text
    }
}

/// Tells a job posting apart from an ordinary update, so the same input bar can take both.
public enum PostingDetection {
    /// Pasted postings run long; a quick update never does.
    public static let longTextThreshold = 600
    /// Shorter text still counts when it reads like a posting.
    public static let shortTextThreshold = 250
    private static let postingWords = [
        "requirements", "qualifications", "responsibilities", "what you'll do", "what you will do", "about the role", "job description",
    ]

    /// A single pasted link, or text long enough (or posting-like enough) to be a job ad; nil for an ordinary update.
    public static func detect(_ message: String) -> PostingImportRequest? {
        let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
        if let url = link(trimmed) { return PostingImportRequest(url: url) }
        if trimmed.count >= longTextThreshold { return PostingImportRequest(text: trimmed) }
        let readsLikeAd = postingWords.contains(where: trimmed.lowercased().contains)
        if trimmed.count >= shortTextThreshold, readsLikeAd { return PostingImportRequest(text: trimmed) }
        return nil
    }

    private static func link(_ text: String) -> URL? {
        guard !text.contains(where: \.isWhitespace), let url = URL(string: text), url.host() != nil else { return nil }
        return ["http", "https"].contains(url.scheme?.lowercased()) ? url : nil
    }
}
