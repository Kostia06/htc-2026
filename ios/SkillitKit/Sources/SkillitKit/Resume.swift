import Foundation

/// The person's resume as structured data. The server renders it to PDF; the app shows and edits it.
public struct Resume: Codable, Equatable, Sendable {
    public var contact: Contact
    public var summary: String
    public var experience: [Experience]
    public var education: [Education]
    public var projects: [Project]
    public var skills: [String]
    public var updatedAt: String?

    public static let empty = Resume()

    public init(
        contact: Contact = Contact(),
        summary: String = "",
        experience: [Experience] = [],
        education: [Education] = [],
        projects: [Project] = [],
        skills: [String] = [],
        updatedAt: String? = nil
    ) {
        self.contact = contact
        self.summary = summary
        self.experience = experience
        self.education = education
        self.projects = projects
        self.skills = skills
        self.updatedAt = updatedAt
    }

    public var isEmpty: Bool {
        summary.isEmpty && experience.isEmpty && education.isEmpty && projects.isEmpty && skills.isEmpty
    }

    /// The sections the coach can be pointed at; `nil` means the whole resume.
    public enum Section: String, Codable, CaseIterable, Sendable {
        case summary, experience, education, projects, skills
    }
}

public extension Resume {
    struct Contact: Codable, Equatable, Hashable, Sendable {
        public var name: String
        public var email: String
        public var phone: String
        public var links: [String]

        public init(name: String = "", email: String = "", phone: String = "", links: [String] = []) {
            self.name = name
            self.email = email
            self.phone = phone
            self.links = links
        }
    }

    struct Experience: Codable, Equatable, Hashable, Sendable {
        public var role: String
        public var org: String
        public var start: String
        public var end: String
        public var bullets: [String]

        public init(role: String = "", org: String = "", start: String = "", end: String = "", bullets: [String] = []) {
            self.role = role
            self.org = org
            self.start = start
            self.end = end
            self.bullets = bullets
        }
    }

    struct Education: Codable, Equatable, Hashable, Sendable {
        public var school: String
        public var program: String
        public var year: String

        public init(school: String = "", program: String = "", year: String = "") {
            self.school = school
            self.program = program
            self.year = year
        }
    }

    struct Project: Codable, Equatable, Hashable, Sendable {
        public var name: String
        public var bullets: [String]
        public var link: String

        public init(name: String = "", bullets: [String] = [], link: String = "") {
            self.name = name
            self.bullets = bullets
            self.link = link
        }
    }
}

/// What the server sends back for a resume: `saved` is false while it is only the profile laid out as one.
public struct SavedResume: Decodable, Equatable, Sendable {
    public var resume: Resume
    public var saved: Bool

    public init(resume: Resume, saved: Bool) {
        self.resume = resume
        self.saved = saved
    }
}

/// One rewrite from the coach. Nothing changes until the person accepts it and the resume is saved.
public struct ResumeSuggestion: Codable, Equatable, Identifiable, Sendable {
    public var path: String
    public var before: String
    public var after: String
    public var why: String

    public var id: String {
        path
    }

    public init(path: String, before: String, after: String, why: String) {
        self.path = path
        self.before = before
        self.after = after
        self.why = why
    }
}
