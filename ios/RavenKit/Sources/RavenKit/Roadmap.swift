import Foundation

/// One page of the person's roadmap to their goal job. `nextCursor` is nil only once the path has reached its end.
public struct RoadmapPage: Decodable, Equatable, Sendable {
    public var goal: String
    public var summary: RoadmapSummary
    public var units: [RoadmapUnit]
    public var nextCursor: String?

    public init(goal: String, summary: RoadmapSummary, units: [RoadmapUnit], nextCursor: String?) {
        self.goal = goal
        self.summary = summary
        self.units = units
        self.nextCursor = nextCursor
    }
}

public struct RoadmapSummary: Decodable, Equatable, Sendable {
    public var done: Int
    public var total: Int
    public var thisWeek: Int

    public init(done: Int, total: Int, thisWeek: Int) {
        self.done = done
        self.total = total
        self.thisWeek = thisWeek
    }
}

public struct RoadmapUnit: Decodable, Equatable, Sendable, Identifiable {
    /// `agent` when Raven planned the unit for this person, `template` when it fell back to the field's standard steps.
    public enum Source: String, Decodable, Sendable {
        case agent, template
    }

    public var index: Int
    public var title: String
    public var summary: String
    public var source: Source?
    public var steps: [RoadmapStep]

    public var id: Int {
        index
    }

    public init(index: Int, title: String, summary: String, source: Source? = .agent, steps: [RoadmapStep]) {
        self.index = index
        self.title = title
        self.summary = summary
        self.source = source
        self.steps = steps
    }
}

public struct RoadmapStep: Decodable, Equatable, Sendable, Identifiable {
    public enum Kind: String, Sendable, CaseIterable {
        case project, course, hackathon, event, networking, certification, volunteering, application
        case interviewPractice = "interview_practice"
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
    public let label: Label
    public let estimate: String
    public var status: Status

    public init(id: String, kind: Kind, title: String, why: String, label: Label, estimate: String, status: Status = .todo) {
        self.id = id
        self.kind = kind
        self.title = title
        self.why = why
        self.label = label
        self.estimate = estimate
        self.status = status
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        // a kind added on the server later still shows, as a generic project node
        kind = try Kind(rawValue: container.decode(String.self, forKey: .kind)) ?? .project
        title = try container.decode(String.self, forKey: .title)
        why = try container.decode(String.self, forKey: .why)
        label = try container.decodeIfPresent(Label.self, forKey: .label) ?? .stretch
        estimate = try container.decodeIfPresent(String.self, forKey: .estimate) ?? ""
        status = try container.decodeIfPresent(Status.self, forKey: .status) ?? .todo
    }

    private enum CodingKeys: String, CodingKey {
        case id, kind, title, why, label, estimate, status
    }
}
