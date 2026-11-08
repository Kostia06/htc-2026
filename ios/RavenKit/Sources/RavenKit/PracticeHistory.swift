import Foundation

/// One past practice session as the history list shows it: no transcript, just enough to pick it out.
public struct PracticeSessionSummary: Codable, Hashable, Sendable, Identifiable {
    public enum Status: String, Codable, Sendable {
        case active, finished
    }

    public let id: String
    public let mode: PracticeMode
    public let companySlug: String?
    public let companyName: String?
    public let status: Status
    public let createdAt: String
    public let finishedAt: String?
    /// Average over every scored quality of every turn, 1 to 5. Missing until a turn was scored.
    public let score: Double?
    public let turnCount: Int

    public init(
        id: String, mode: PracticeMode, companySlug: String? = nil, companyName: String? = nil, status: Status, createdAt: String,
        finishedAt: String? = nil, score: Double? = nil, turnCount: Int,
    ) {
        self.id = id
        self.mode = mode
        self.companySlug = companySlug
        self.companyName = companyName
        self.status = status
        self.createdAt = createdAt
        self.finishedAt = finishedAt
        self.score = score
        self.turnCount = turnCount
    }
}

public struct PracticeHistoryPage: Codable, Equatable, Sendable {
    public var sessions: [PracticeSessionSummary]
    public var nextCursor: String?

    public init(sessions: [PracticeSessionSummary] = [], nextCursor: String? = nil) {
        self.sessions = sessions
        self.nextCursor = nextCursor
    }

    /// Adds the next page, skipping anything already shown.
    public mutating func append(_ next: PracticeHistoryPage) {
        let known = Set(sessions.map(\.id))
        sessions += next.sessions.filter { !known.contains($0.id) }
        nextCursor = next.nextCursor
    }
}

/// One exchange in a replayed session, with the feedback it got at the time.
public struct PracticeTurn: Decodable, Equatable, Sendable, Identifiable {
    public let idx: Int
    public let question: String
    public let answer: String
    public let scores: [String: Double]
    public let delivery: TurnFeedback.Delivery?
    public let tip: String?

    public var id: Int {
        idx
    }

    /// Mean of the scored qualities, 1 to 5; nil when this turn was not scored.
    public var averageScore: Double? {
        scores.isEmpty ? nil : scores.values.reduce(0, +) / Double(scores.count)
    }

    public init(
        idx: Int, question: String, answer: String, scores: [String: Double] = [:],
        delivery: TurnFeedback.Delivery? = nil, tip: String? = nil,
    ) {
        self.idx = idx
        self.question = question
        self.answer = answer
        self.scores = scores
        self.delivery = delivery
        self.tip = tip
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        idx = try container.decode(Int.self, forKey: .idx)
        question = try container.decode(String.self, forKey: .question)
        answer = try container.decode(String.self, forKey: .answer)
        scores = try container.decodeIfPresent([String: Double].self, forKey: .scores) ?? [:]
        delivery = try container.decodeIfPresent(TurnFeedback.Delivery.self, forKey: .delivery)
        tip = try container.decodeIfPresent(String.self, forKey: .tip)
    }

    private enum CodingKeys: String, CodingKey { case idx, question, answer, scores, delivery, tip }
}

/// A whole past session, as `GET /api/voice/sessions/:id` replays it.
public struct PracticeSessionDetail: Decodable, Equatable, Sendable, Identifiable {
    public let id: String
    public let mode: PracticeMode
    public let companySlug: String?
    public let status: PracticeSessionSummary.Status
    public let createdAt: String
    public let turns: [PracticeTurn]

    public init(
        id: String, mode: PracticeMode, companySlug: String? = nil, status: PracticeSessionSummary.Status,
        createdAt: String, turns: [PracticeTurn],
    ) {
        self.id = id
        self.mode = mode
        self.companySlug = companySlug
        self.status = status
        self.createdAt = createdAt
        self.turns = turns
    }
}

public extension RavenClient {
    /// Newest first. Pass the page's `nextCursor` for the next one.
    func practiceHistory(cursor: String? = nil) async throws(RavenError) -> PracticeHistoryPage {
        var request = try await authorized("GET", "api/voice/history")
        if let cursor {
            request.url = request.url?.appending(queryItems: [URLQueryItem(name: "cursor", value: cursor)])
        }
        return try await send(request)
    }

    func practiceSession(id: String) async throws(RavenError) -> PracticeSessionDetail {
        try await send(authorized("GET", "api/voice/sessions/\(id)"))
    }
}
