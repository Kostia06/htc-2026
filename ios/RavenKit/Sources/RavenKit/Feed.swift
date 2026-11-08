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
    /// ISO 8601 when the source gives a date; otherwise a short label as the source states it, such as "ongoing".
    public let when: String?
    public let `where`: String?
    public let why: String
    public let url: URL
    public let source: String
    public let attribution: Attribution?
    /// What dismissing this card steers the ranking away from.
    public let tags: [String]?
    /// Set by the server when the person saved it; flipped locally first so the bookmark fills at once.
    public var saved: Bool?

    public init(
        id: String, kind: Kind, title: String, org: String, when: String? = nil, where place: String? = nil,
        why: String, url: URL, source: String, attribution: Attribution? = nil, tags: [String]? = nil, saved: Bool = false,
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
        self.tags = tags
        self.saved = saved
    }

    public var isSaved: Bool {
        saved ?? false
    }

    /// Parses a full timestamp or a day-only date; a label such as "ongoing" has no date.
    public var date: Date? {
        guard let when else { return nil }
        return (try? Date(when, strategy: .iso8601)) ?? (try? Date(when, strategy: .iso8601.year().month().day()))
    }
}

/// Which slice of the feed a page shows; the chips at the top of the For you tab.
public enum FeedSection: String, Codable, Sendable, CaseIterable, Identifiable {
    case all, jobs, events, hackathons, courses, saved

    public var id: String {
        rawValue
    }

    public var title: String {
        switch self {
        case .all: "For you"
        case .jobs: "Jobs"
        case .events: "Events"
        case .hackathons: "Hackathons"
        case .courses: "Courses"
        case .saved: "Saved"
        }
    }
}

/// What a person can do with a card.
public enum FeedCardAction: String, Codable, Sendable {
    case save, dismiss
}

/// A page of the feed. `building` means the server is assembling a fresher feed right now.
public struct FeedPage: Codable, Sendable, Equatable {
    public let items: [FeedCard]
    public let nextCursor: String?
    public let building: Bool
    public let section: FeedSection

    public init(items: [FeedCard], nextCursor: String?, building: Bool, section: FeedSection = .all) {
        self.items = items
        self.nextCursor = nextCursor
        self.building = building
        self.section = section
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        items = try container.decode([FeedCard].self, forKey: .items)
        nextCursor = try container.decodeIfPresent(String.self, forKey: .nextCursor)
        building = try container.decode(Bool.self, forKey: .building)
        section = try container.decodeIfPresent(FeedSection.self, forKey: .section) ?? .all
    }
}
