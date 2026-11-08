import Foundation

/// Crossroads: the person's own notes beside what everyone on the same road learned, and where the two overlap.
public struct Crossroads: Decodable, Equatable, Sendable {
    public struct Road: Decodable, Equatable, Sendable {
        public let goal: String
        public let lane: String
        public let laneName: String

        public init(goal: String, lane: String, laneName: String) {
            self.goal = goal
            self.lane = lane
            self.laneName = laneName
        }
    }

    public var road: Road
    public var you: [YourItem]
    public var everyone: [RoadLine]
    public var research: [ResearchFact]
    public var links: [CrossroadsLink]
    public var trails: [Trail]
    /// The smallest group a real count is ever shown for.
    public var minPeople: Int

    public init(
        road: Road, you: [YourItem], everyone: [RoadLine], research: [ResearchFact] = [], links: [CrossroadsLink] = [],
        trails: [Trail] = [], minPeople: Int = 3
    ) {
        self.road = road
        self.you = you
        self.everyone = everyone
        self.research = research
        self.links = links
        self.trails = trails
        self.minPeople = minPeople
    }
}

/// One thing the person knows about themselves. Only `memory` items can be deleted here; `profile` ones live in Profile.
public struct YourItem: Decodable, Equatable, Sendable, Identifiable {
    public enum Source: String, Decodable, Sendable {
        case memory, profile
    }

    public let id: String
    public let kind: PrivateMemory.Kind
    public let text: String
    public let source: Source

    public init(id: String, kind: PrivateMemory.Kind, text: String, source: Source = .memory) {
        self.id = id
        self.kind = kind
        self.text = text
        self.source = source
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        // a kind added on the server later still shows, as a plain note
        kind = try PrivateMemory.Kind(rawValue: container.decode(String.self, forKey: .kind)) ?? .note
        text = try container.decode(String.self, forKey: .text)
        source = try container.decodeIfPresent(Source.self, forKey: .source) ?? .memory
    }

    private enum CodingKeys: String, CodingKey { case id, kind, text, source }
}

/// One line from the road. `people` is set only when three or more real people stand behind it; an `example` was
/// written by Skillit so the road isn't empty and is never counted as anyone.
public struct RoadLine: Decodable, Equatable, Sendable, Identifiable {
    public enum Kind: String, Decodable, Sendable {
        case struggle, tip, interview, win
    }

    public let id: String
    public let kind: Kind
    public let text: String
    public var people: Int?
    public let example: Bool
    public var meToo: Bool

    public init(id: String, kind: Kind, text: String, people: Int? = nil, example: Bool = false, meToo: Bool = false) {
        self.id = id
        self.kind = kind
        self.text = text
        self.people = people
        self.example = example
        self.meToo = meToo
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        kind = try Kind(rawValue: container.decode(String.self, forKey: .kind)) ?? .tip
        text = try container.decode(String.self, forKey: .text)
        people = try container.decodeIfPresent(Int.self, forKey: .people)
        example = try container.decodeIfPresent(Bool.self, forKey: .example) ?? false
        meToo = try container.decodeIfPresent(Bool.self, forKey: .meToo) ?? false
    }

    private enum CodingKeys: String, CodingKey { case id, kind, text, people, example, meToo }
}

/// A researched fact about an employer on the road, with where it came from and how old it is.
public struct ResearchFact: Decodable, Equatable, Sendable, Identifiable {
    public let id: String
    public let company: String
    public let slug: String
    public let kind: String
    public let text: String
    public let sourceUrl: String
    public let sourceHost: String
    public let ageDays: Int

    public init(
        id: String, company: String, slug: String, kind: String, text: String, sourceUrl: String, sourceHost: String, ageDays: Int,
    ) {
        self.id = id
        self.company = company
        self.slug = slug
        self.kind = kind
        self.text = text
        self.sourceUrl = sourceUrl
        self.sourceHost = sourceHost
        self.ageDays = ageDays
    }
}

/// One of the person's items and a road line or fact about the same thing; `score` is 0...1.
public struct CrossroadsLink: Decodable, Equatable, Sendable, Hashable {
    public let you: String
    public let everyone: String
    public let score: Double

    public init(you: String, everyone: String, score: Double) {
        self.you = you
        self.everyone = everyone
        self.score = score
    }
}

/// A road that ended in a job: step kinds in the order people took them.
public struct Trail: Decodable, Equatable, Sendable, Identifiable {
    public let id: String
    public let role: String
    public let people: Int?
    public let example: Bool
    public let steps: [RoadmapStep.Kind]
    public let skills: [String]

    public init(id: String, role: String, people: Int? = nil, example: Bool = false, steps: [RoadmapStep.Kind], skills: [String] = []) {
        self.id = id
        self.role = role
        self.people = people
        self.example = example
        self.steps = steps
        self.skills = skills
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        role = try container.decode(String.self, forKey: .role)
        people = try container.decodeIfPresent(Int.self, forKey: .people)
        example = try container.decodeIfPresent(Bool.self, forKey: .example) ?? false
        // a step kind this build doesn't know is left out of the trail rather than failing the whole screen
        steps = try container.decode([String].self, forKey: .steps).compactMap(RoadmapStep.Kind.init(rawValue:))
        skills = try container.decodeIfPresent([String].self, forKey: .skills) ?? []
    }

    private enum CodingKeys: String, CodingKey { case id, role, people, example, steps, skills }
}

/// What a Crossroads answer leaned on; `id` is the item's id in `Crossroads`.
public struct CrossroadsCite: Decodable, Equatable, Sendable, Hashable {
    public enum Kind: String, Decodable, Sendable {
        case you, everyone, trail, research
    }

    public let type: Kind
    public let id: String

    public init(type: Kind, id: String) {
        self.type = type
        self.id = id
    }
}

public struct CrossroadsAnswer: Decodable, Equatable, Sendable {
    public let reply: String
    public let needsAnswer: Bool
    public let cites: [CrossroadsCite]

    public init(reply: String, needsAnswer: Bool, cites: [CrossroadsCite] = []) {
        self.reply = reply
        self.needsAnswer = needsAnswer
        self.cites = cites
    }
}
