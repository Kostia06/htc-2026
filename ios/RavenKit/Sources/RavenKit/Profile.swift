import Foundation

public struct Profile: Codable, Equatable, Sendable {
    public var headline: String?
    public var targetRoles: [String]
    public var goals: [String]
    public var skills: [Skill]
    public var education: [Education]
    public var experience: [Experience]
    public var projects: [Project]
    public var certifications: [String]

    public static let empty = Profile()

    public init(
        headline: String? = nil,
        targetRoles: [String] = [],
        goals: [String] = [],
        skills: [Skill] = [],
        education: [Education] = [],
        experience: [Experience] = [],
        projects: [Project] = [],
        certifications: [String] = [],
    ) {
        self.headline = headline
        self.targetRoles = targetRoles
        self.goals = goals
        self.skills = skills
        self.education = education
        self.experience = experience
        self.projects = projects
        self.certifications = certifications
    }

    /// the server leaves out empty lists in drafts, so every list decodes as empty when missing
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        headline = try container.decodeIfPresent(String.self, forKey: .headline)
        targetRoles = try container.decodeIfPresent([String].self, forKey: .targetRoles) ?? []
        goals = try container.decodeIfPresent([String].self, forKey: .goals) ?? []
        skills = try container.decodeIfPresent([Skill].self, forKey: .skills) ?? []
        education = try container.decodeIfPresent([Education].self, forKey: .education) ?? []
        experience = try container.decodeIfPresent([Experience].self, forKey: .experience) ?? []
        projects = try container.decodeIfPresent([Project].self, forKey: .projects) ?? []
        certifications = try container.decodeIfPresent([String].self, forKey: .certifications) ?? []
    }

    public var isEmpty: Bool {
        headline == nil && targetRoles.isEmpty && skills.isEmpty && education.isEmpty && experience.isEmpty
    }
}

public extension Profile {
    struct Skill: Codable, Equatable, Hashable, Sendable {
        public var name: String
        public var source: SkillSource
        public var evidence: String?

        public init(name: String, source: SkillSource, evidence: String? = nil) {
            self.name = name
            self.source = source
            self.evidence = evidence
        }
    }

    struct Education: Codable, Equatable, Hashable, Sendable {
        public var school: String
        public var program: String?
        public var year: String?
        public var expectedGraduation: String?

        public init(school: String, program: String? = nil, year: String? = nil, expectedGraduation: String? = nil) {
            self.school = school
            self.program = program
            self.year = year
            self.expectedGraduation = expectedGraduation
        }
    }

    struct Experience: Codable, Equatable, Hashable, Sendable {
        public var role: String
        public var org: String
        public var start: String?
        public var end: String?
        public var highlights: [String]?

        public init(role: String, org: String, start: String? = nil, end: String? = nil, highlights: [String]? = nil) {
            self.role = role
            self.org = org
            self.start = start
            self.end = end
            self.highlights = highlights
        }
    }

    struct Project: Codable, Equatable, Hashable, Sendable {
        public var name: String
        public var summary: String?

        public init(name: String, summary: String? = nil) {
            self.name = name
            self.summary = summary
        }
    }
}

public enum SkillSource: String, Codable, Sendable {
    case resume
    case interview
    case selfReported = "self-reported"
}
