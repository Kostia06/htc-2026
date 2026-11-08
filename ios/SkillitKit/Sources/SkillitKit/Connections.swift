import Foundation

/// The person's GitHub link, read-only through the server. Only derived project summaries ever reach the app, never a token.
public struct GithubConnection: Decodable, Equatable, Sendable {
    public enum Status: String, Decodable, Sendable {
        case notConnected = "not_connected"
        case pending
        case connected
        /// the server couldn't reach Composio to revoke; disconnecting again finishes the job
        case revoking

        public init(from decoder: Decoder) throws {
            let raw = try decoder.singleValueContainer().decode(String.self)
            self = Status(rawValue: raw) ?? .notConnected
        }
    }

    public struct Project: Decodable, Equatable, Sendable, Identifiable {
        public let name: String
        public let summary: String?
        public let language: String?
        public var id: String {
            name
        }
    }

    /// false when the server has no Composio key: the row says so instead of offering a button that can't work
    public let configured: Bool
    public let status: Status
    public let projects: [Project]
    public let suggestions: [String]
    /// true right after the sign-in finished, while the server reads the repos
    public let importing: Bool

    public static let unknown = GithubConnection(configured: true, status: .notConnected, projects: [], suggestions: [], importing: false)

    public init(configured: Bool, status: Status, projects: [Project], suggestions: [String], importing: Bool) {
        self.configured = configured
        self.status = status
        self.projects = projects
        self.suggestions = suggestions
        self.importing = importing
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        configured = try container.decodeIfPresent(Bool.self, forKey: .configured) ?? false
        status = try container.decodeIfPresent(Status.self, forKey: .status) ?? .notConnected
        projects = try container.decodeIfPresent([Project].self, forKey: .projects) ?? []
        suggestions = try container.decodeIfPresent([String].self, forKey: .suggestions) ?? []
        importing = try container.decodeIfPresent(Bool.self, forKey: .importing) ?? false
    }

    private enum CodingKeys: String, CodingKey { case configured, status, projects, suggestions, importing }
}

/// The part of a LinkedIn profile a suggestion is about.
public enum LinkedinArea: String, Decodable, Sendable, CaseIterable {
    case headline, about, skills, experience
}

/// Edits for a LinkedIn profile, each pointing at the exact text in the person's own PDF.
public struct LinkedinReview: Decodable, Equatable, Sendable {
    public struct Suggestion: Decodable, Equatable, Sendable, Identifiable {
        public let area: LinkedinArea
        public let quote: String
        public let suggestion: String
        public let why: String
        public var id: String {
            "\(area.rawValue)|\(quote)|\(suggestion)"
        }

        public init(area: LinkedinArea, quote: String, suggestion: String, why: String) {
            self.area = area
            self.quote = quote
            self.suggestion = suggestion
            self.why = why
        }
    }

    public let targetRole: String?
    public let suggestions: [Suggestion]

    public init(targetRole: String?, suggestions: [Suggestion]) {
        self.targetRole = targetRole
        self.suggestions = suggestions
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        targetRole = try container.decodeIfPresent(String.self, forKey: .targetRole)
        // an area this build doesn't know yet is dropped rather than failing the whole review
        let lossy = try container.decodeIfPresent([Lossy<Suggestion>].self, forKey: .suggestions) ?? []
        suggestions = lossy.compactMap(\.value)
    }

    private enum CodingKeys: String, CodingKey { case targetRole, suggestions }
}

private struct Lossy<Value: Decodable>: Decodable {
    let value: Value?

    init(from decoder: Decoder) throws {
        value = try? Value(from: decoder)
    }
}
