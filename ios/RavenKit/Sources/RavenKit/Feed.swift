import Foundation

/// One thing in the For you feed, ranked on the server against the person's profile.
public struct FeedCard: Codable, Sendable, Hashable, Identifiable {
    public enum Kind: String, Codable, Sendable {
        case job, hackathon, course, event

        /// A kind added on the server later shows as an event rather than failing the whole page.
        public init(from decoder: Decoder) throws {
            let raw = try decoder.singleValueContainer().decode(String.self)
            self = Kind(rawValue: raw) ?? .event
        }
    }

    /// Credit a source requires next to its listings, such as "Jobs by Adzuna".
    public struct Attribution: Codable, Sendable, Hashable {
        public let label: String
        public let url: URL

        public init(label: String, url: URL) {
            self.label = label
            self.url = url
        }
    }

    public let id: String
    public let kind: Kind
    public let title: String
    public let org: String
    /// ISO 8601; for a job this is when it was posted.
    public let when: String?
    public let `where`: String?
    public let why: String
    public let url: URL
    public let source: String
    public let attribution: Attribution?

    public init(
        id: String, kind: Kind, title: String, org: String, when: String? = nil, where place: String? = nil,
        why: String, url: URL, source: String, attribution: Attribution? = nil,
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.org = org
        self.when = when
        self.where = place
        self.why = why
        self.url = url
        self.source = source
        self.attribution = attribution
    }

    public var date: Date? {
        when.flatMap { try? Date($0, strategy: .iso8601) }
    }
}

/// A page of the feed. `building` means the server is assembling a fresher feed right now.
public struct FeedPage: Codable, Sendable, Equatable {
    public let items: [FeedCard]
    public let nextCursor: String?
    public let building: Bool

    public init(items: [FeedCard], nextCursor: String?, building: Bool) {
        self.items = items
        self.nextCursor = nextCursor
        self.building = building
    }
}
