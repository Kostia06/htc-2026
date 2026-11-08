import Foundation

/// One service the person can bring their work from (GitHub, Notion, YouTube…), read-only through the server.
/// Only derived project summaries ever reach the app, never a token.
public struct WorkConnection: Decodable, Equatable, Sendable, Identifiable {
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

    public enum Category: String, Decodable, Sendable {
        case code, design, writing, documents, video, other

        public init(from decoder: Decoder) throws {
            let raw = try decoder.singleValueContainer().decode(String.self)
            self = Category(rawValue: raw) ?? .other
        }

        /// words someone might search for to find this kind of work
        var searchTerms: [String] {
            switch self {
            case .code: ["code", "coding", "programming", "developer", "software", "repos"]
            case .design: ["design", "portfolio", "art", "ui", "visual"]
            case .writing: ["writing", "notes", "blog", "articles", "docs"]
            case .documents: ["documents", "docs", "files", "slides", "sheets"]
            case .video: ["video", "videos", "film", "channel"]
            case .other: []
            }
        }
    }

    public struct Project: Decodable, Equatable, Sendable, Identifiable {
        public let name: String
        public let summary: String?
        public let language: String?
        public let kind: String?
        public var id: String {
            name
        }

        /// the repo's language, or what kind of thing it is
        public var detail: String? {
            language ?? kind
        }
    }

    public let id: String
    public let name: String
    public let category: Category
    /// one line saying what's read, e.g. "Reads your public repos. Never posts."
    public let reads: String
    /// false when the server isn't set up for this service yet: the row says "Coming soon" instead of offering a button
    public let configured: Bool
    public let status: Status
    public let projects: [Project]
    public let suggestions: [String]
    /// true right after the sign-in finished, while the server reads the work
    public let importing: Bool

    public var isConnected: Bool {
        status == .connected
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? id
        category = try container.decodeIfPresent(Category.self, forKey: .category) ?? .other
        reads = try container.decodeIfPresent(String.self, forKey: .reads) ?? ""
        configured = try container.decodeIfPresent(Bool.self, forKey: .configured) ?? false
        status = try container.decodeIfPresent(Status.self, forKey: .status) ?? .notConnected
        projects = try container.decodeIfPresent([Project].self, forKey: .projects) ?? []
        suggestions = try container.decodeIfPresent([String].self, forKey: .suggestions) ?? []
        importing = try container.decodeIfPresent(Bool.self, forKey: .importing) ?? false
    }

    public init(
        id: String, name: String, category: Category, reads: String = "", configured: Bool = true,
        status: Status = .notConnected, projects: [Project] = [], suggestions: [String] = [], importing: Bool = false,
    ) {
        self.id = id
        self.name = name
        self.category = category
        self.reads = reads
        self.configured = configured
        self.status = status
        self.projects = projects
        self.suggestions = suggestions
        self.importing = importing
    }

    /// Whether a search box query finds this service: by its name, or by the kind of work ("design", "video").
    public func matches(_ query: String) -> Bool {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if needle.isEmpty {
            return true
        }
        return name.lowercased().contains(needle) || category.searchTerms.contains { $0.hasPrefix(needle) }
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, category, reads, configured, status, projects, suggestions, importing
    }
}

public extension [WorkConnection] {
    func matching(_ query: String) -> [WorkConnection] {
        filter { $0.matches(query) }
    }
}

#if DEBUG
public extension WorkConnection {
    static func preview(id: String, name: String, category: Category, status: Status = .notConnected) -> WorkConnection {
        WorkConnection(id: id, name: name, category: category, reads: "Reads your public work. Never posts.", status: status)
    }
}
#endif
