import Foundation

/// What a notification is about. Unknown kinds from a newer server decode as `.other` instead of failing the page.
public enum NotificationKind: String, Codable, Sendable, CaseIterable {
    case reportReady = "report_ready"
    case resumeReady = "resume_ready"
    case deadline
    case roadNudge = "road_nudge"
    case interviewQuestion = "interview_question"
    case companyNews = "company_news"
    case feedMatch = "feed_match"
    case other

    public init(from decoder: any Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = NotificationKind(rawValue: raw) ?? .other
    }

    /// The kinds a person can switch off, in the order the settings screen lists them.
    public static let toggleable: [NotificationKind] = allCases.filter { $0 != .other }
}

/// Where tapping a notification lands.
public enum NotificationTarget: Hashable, Sendable, Codable {
    case feed(id: String)
    case company(slug: String)
    case step(id: String)
    case report(id: String)
    case resume(id: String)
    case unknown

    private enum Keys: String, CodingKey { case type, id, slug }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: Keys.self)
        let id = try container.decodeIfPresent(String.self, forKey: .id)
        switch try container.decode(String.self, forKey: .type) {
        case "feed": self = id.map { .feed(id: $0) } ?? .unknown
        case "company": self = try container.decodeIfPresent(String.self, forKey: .slug).map { .company(slug: $0) } ?? .unknown
        case "step": self = id.map { .step(id: $0) } ?? .unknown
        case "report": self = id.map { .report(id: $0) } ?? .unknown
        case "resume": self = id.map { .resume(id: $0) } ?? .unknown
        default: self = .unknown
        }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: Keys.self)
        switch self {
        case let .feed(id): try container.encode("feed", forKey: .type); try container.encode(id, forKey: .id)
        case let .company(slug): try container.encode("company", forKey: .type); try container.encode(slug, forKey: .slug)
        case let .step(id): try container.encode("step", forKey: .type); try container.encode(id, forKey: .id)
        case let .report(id): try container.encode("report", forKey: .type); try container.encode(id, forKey: .id)
        case let .resume(id): try container.encode("resume", forKey: .type); try container.encode(id, forKey: .id)
        case .unknown: try container.encode("unknown", forKey: .type)
        }
    }
}

public struct SkillitNotification: Codable, Hashable, Sendable, Identifiable {
    public let id: String
    public let kind: NotificationKind
    public let title: String
    /// One line saying why this is worth a look.
    public let body: String
    public let target: NotificationTarget
    public let createdAt: String
    public var readAt: String?
    /// The server already pushed it through APNs; a device with push working should not post it again.
    public let pushed: Bool

    public var isRead: Bool {
        readAt != nil
    }

    public init(
        id: String, kind: NotificationKind, title: String, body: String, target: NotificationTarget, createdAt: String,
        readAt: String? = nil, pushed: Bool = false,
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.body = body
        self.target = target
        self.createdAt = createdAt
        self.readAt = readAt
        self.pushed = pushed
    }
}

public struct NotificationPage: Codable, Equatable, Sendable {
    public var items: [SkillitNotification]
    public var nextCursor: String?
    public var unread: Int
    /// 21:00 to 08:00 where the person is: the app keeps quiet too.
    public var quiet: Bool

    public init(items: [SkillitNotification] = [], nextCursor: String? = nil, unread: Int = 0, quiet: Bool = false) {
        self.items = items
        self.nextCursor = nextCursor
        self.unread = unread
        self.quiet = quiet
    }
}

public struct NotificationPreferences: Codable, Equatable, Sendable {
    public var timezone: String?
    public var kinds: [String: Bool]

    public init(timezone: String? = nil, kinds: [String: Bool] = [:]) {
        self.timezone = timezone
        self.kinds = kinds
    }

    public func isOn(_ kind: NotificationKind) -> Bool {
        kinds[kind.rawValue] ?? true
    }
}

public extension [SkillitNotification] {
    /// Today's notifications, then everything earlier, each newest first; empty groups are left out.
    func groupedByDay(now: Date = .now, calendar: Calendar = .current) -> [(title: String, items: [SkillitNotification])] {
        let today = filter { RelativeTime.date(from: $0.createdAt).map { calendar.isDate($0, inSameDayAs: now) } ?? false }
        let earlier = filter { item in !today.contains(where: { $0.id == item.id }) }
        return [("Today", today), ("Earlier", earlier)].filter { !$0.items.isEmpty }
    }

    /// The ones this device should still show as a local notification: unread, not already shown here, and not
    /// pushed by the server when this device can receive pushes.
    func awaitingLocalDelivery(alreadyShown: Set<String>, receivesPush: Bool) -> [SkillitNotification] {
        filter { !$0.isRead && !alreadyShown.contains($0.id) && !(receivesPush && $0.pushed) }
    }
}
