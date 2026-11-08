import Foundation

/// One page of the person's roadmap: progress, the open steps from `cursor` on, and everything finished grouped by day.
/// `nextCursor` is nil only once the path has reached its end.
public struct RoadmapPage: Decodable, Equatable, Sendable {
    public var goal: String
    public var progress: RoadmapProgress
    public var next: [RoadmapStep]
    public var nextCursor: String?
    public var completed: [CompletedDay]

    public init(goal: String, progress: RoadmapProgress, next: [RoadmapStep], nextCursor: String?, completed: [CompletedDay] = []) {
        self.goal = goal
        self.progress = progress
        self.next = next
        self.nextCursor = nextCursor
        self.completed = completed
    }
}

public struct RoadmapProgress: Decodable, Equatable, Sendable {
    public var done: Int
    public var total: Int
    public var streakDays: Int

    public init(done: Int, total: Int, streakDays: Int) {
        self.done = done
        self.total = total
        self.streakDays = streakDays
    }
}

/// The steps finished on one calendar day, `day` as `yyyy-MM-dd` in the time zone the page was asked for.
public struct CompletedDay: Decodable, Equatable, Sendable, Identifiable {
    public var day: String
    public var steps: [RoadmapStep]

    public var id: String {
        day
    }

    public init(day: String, steps: [RoadmapStep]) {
        self.day = day
        self.steps = steps
    }
}

/// What the app launches when the person taps a step's button: a spoken interview.
public struct RoadmapAction: Decodable, Equatable, Sendable {
    public enum Kind: String, Decodable, Sendable {
        case interview
    }

    public let type: Kind
    public let companySlug: String?
    public let role: String?
    /// Set on the interview step a job posting added; the session then asks about that posting.
    public let postingId: String?

    public init(type: Kind, companySlug: String? = nil, role: String? = nil, postingId: String? = nil) {
        self.type = type
        self.companySlug = companySlug
        self.role = role
        self.postingId = postingId
    }
}

public struct RoadmapStep: Decodable, Equatable, Sendable, Identifiable {
    public enum Kind: String, Sendable, CaseIterable {
        case project, event, course, application, certification, volunteering
        case interviewPractice = "interview_practice"
        case networkingPractice = "networking_practice"
    }

    public enum Label: String, Decodable, Sendable {
        case readyNow = "ready_now"
        case stretch
        case longTerm = "long_term"
    }

    public enum Status: String, Codable, Sendable {
        case todo, started, done, skipped
    }

    public let id: String
    public let kind: Kind
    public let title: String
    public let why: String
    public let detail: String
    public let label: Label
    public let estimate: String
    public let action: RoadmapAction?
    public var status: Status
    public var completedAt: String?
    public var note: String?

    public init(
        id: String, kind: Kind, title: String, why: String, detail: String, label: Label, estimate: String,
        action: RoadmapAction? = nil, status: Status = .todo, completedAt: String? = nil, note: String? = nil,
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.why = why
        self.detail = detail
        self.label = label
        self.estimate = estimate
        self.action = action
        self.status = status
        self.completedAt = completedAt
        self.note = note
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        // a kind added on the server later still shows, as a generic project step
        kind = try Kind(rawValue: container.decode(String.self, forKey: .kind)) ?? .project
        title = try container.decode(String.self, forKey: .title)
        why = try container.decodeIfPresent(String.self, forKey: .why) ?? ""
        detail = try container.decodeIfPresent(String.self, forKey: .detail) ?? ""
        label = try container.decodeIfPresent(Label.self, forKey: .label) ?? .stretch
        estimate = try container.decodeIfPresent(String.self, forKey: .estimate) ?? ""
        action = try? container.decodeIfPresent(RoadmapAction.self, forKey: .action)
        status = try container.decodeIfPresent(Status.self, forKey: .status) ?? .todo
        completedAt = try container.decodeIfPresent(String.self, forKey: .completedAt)
        note = try container.decodeIfPresent(String.self, forKey: .note)
    }

    private enum CodingKeys: String, CodingKey {
        case id, kind, title, why, detail, label, estimate, action, status, completedAt, note
    }
}
