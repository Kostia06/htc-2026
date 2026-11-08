import Foundation

/// One edit the server made for a job: what the line said, what it says now, why, and the requirement it serves.
public struct TailorChange: Codable, Equatable, Identifiable, Sendable {
    public enum Kind: String, Codable, Sendable {
        case reword, trim, reorder
    }

    public let id: String
    public let kind: Kind
    public let section: String
    /// The base resume line this change grows from; code on the server checked it adds nothing that line lacks.
    public let basedOn: String
    public let before: String
    public let after: String
    public let why: String
    public let requirement: String?
    public var accepted: Bool

    public init(
        id: String, kind: Kind, section: String, basedOn: String, before: String, after: String, why: String,
        requirement: String?, accepted: Bool = true,
    ) {
        self.id = id
        self.kind = kind
        self.section = section
        self.basedOn = basedOn
        self.before = before
        self.after = after
        self.why = why
        self.requirement = requirement
        self.accepted = accepted
    }

    /// "Summary", "Experience", "Skills": where the change sits, for the row's quiet label.
    public var sectionTitle: String {
        section.prefix(1).uppercased() + section.dropFirst()
    }
}

/// The posting's requirements split by whether the tailored resume now shows them.
public struct TailorMatch: Codable, Equatable, Sendable {
    public struct Requirement: Codable, Equatable, Hashable, Sendable {
        public let text: String
        public let topic: String
        public let required: Bool

        public init(text: String, topic: String, required: Bool) {
            self.text = text
            self.topic = topic
            self.required = required
        }
    }

    public let covered: [Requirement]
    public let missing: [Requirement]
    public let coveredBefore: Int

    public init(covered: [Requirement], missing: [Requirement], coveredBefore: Int) {
        self.covered = covered
        self.missing = missing
        self.coveredBefore = coveredBefore
    }

    public var total: Int {
        covered.count + missing.count
    }
}

/// A copy of the resume adapted to one job, with every change kept so it can be shown and undone.
public struct TailoredResume: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let postingId: String
    public let title: String
    public let company: String
    public let resume: Resume
    public let changes: [TailorChange]
    public let match: TailorMatch
    /// After a hand edit the log is history: toggling a change would undo the edit, so the server refuses.
    public let editedByHand: Bool
    public let updatedAt: String

    public init(
        id: String, postingId: String, title: String, company: String, resume: Resume, changes: [TailorChange],
        match: TailorMatch, editedByHand: Bool = false, updatedAt: String,
    ) {
        self.id = id
        self.postingId = postingId
        self.title = title
        self.company = company
        self.resume = resume
        self.changes = changes
        self.match = match
        self.editedByHand = editedByHand
        self.updatedAt = updatedAt
    }
}

/// One row of the tailored resumes list.
public struct TailoredResumeSummary: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let postingId: String
    public let title: String
    public let company: String
    public let covered: Int
    public let total: Int
    public let updatedAt: String

    public init(id: String, postingId: String, title: String, company: String, covered: Int, total: Int, updatedAt: String) {
        self.id = id
        self.postingId = postingId
        self.title = title
        self.company = company
        self.covered = covered
        self.total = total
        self.updatedAt = updatedAt
    }

    /// "5 of 7 requirements", or nothing to count when the posting listed none.
    public var matchLine: String {
        total == 0 ? "No requirements listed" : "\(covered) of \(total) requirements"
    }
}

/// What to tailor for: a saved posting, or a posting's text the server imports first.
public enum TailorSource: Equatable, Sendable {
    case posting(id: String)
    case text(String)
}
