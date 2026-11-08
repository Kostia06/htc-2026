import Foundation

public enum PracticeMode: String, Codable, Sendable, CaseIterable {
    case interview, networking
}

/// How hard the interviewer pushes. The server treats a missing value as `standard`.
public enum PracticeDifficulty: String, Codable, Sendable, CaseIterable {
    case easy, standard, hard
}

public struct VoiceSessionRequest: Encodable, Equatable, Sendable {
    public var mode: PracticeMode
    public var companySlug: String?
    public var role: String?
    public var difficulty: PracticeDifficulty?

    public init(mode: PracticeMode, companySlug: String? = nil, role: String? = nil, difficulty: PracticeDifficulty? = nil) {
        self.mode = mode
        self.companySlug = companySlug
        self.role = role
        self.difficulty = difficulty
    }
}

/// A started voice session. Interview sessions carry `questions`; networking sessions carry `persona` and `goals`.
public struct VoiceSession: Decodable, Equatable, Sendable, Identifiable {
    public let id: String
    public let mode: PracticeMode
    public let provider: String
    /// Handed to the provider adapter untouched; its shape is the provider's business.
    public let credentials: JSONValue
    public let expiresAt: String?
    public let opening: String
    public let role: String?
    public let company: String?
    public let questions: [PracticeQuestion]
    public let persona: Persona?
    public let goals: [String]

    public init(
        id: String, mode: PracticeMode, provider: String, credentials: JSONValue = .object([:]), expiresAt: String? = nil, opening: String,
        role: String? = nil, company: String? = nil, questions: [PracticeQuestion] = [], persona: Persona? = nil, goals: [String] = [],
    ) {
        self.id = id
        self.mode = mode
        self.provider = provider
        self.credentials = credentials
        self.expiresAt = expiresAt
        self.opening = opening
        self.role = role
        self.company = company
        self.questions = questions
        self.persona = persona
        self.goals = goals
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        mode = try container.decode(PracticeMode.self, forKey: .mode)
        provider = try container.decodeIfPresent(String.self, forKey: .provider) ?? "unknown"
        credentials = try container.decodeIfPresent(JSONValue.self, forKey: .credentials) ?? .null
        expiresAt = try container.decodeIfPresent(String.self, forKey: .expiresAt)
        opening = try container.decode(String.self, forKey: .opening)
        role = try container.decodeIfPresent(String.self, forKey: .role)
        company = try container.decodeIfPresent(String.self, forKey: .company)
        questions = try container.decodeIfPresent([PracticeQuestion].self, forKey: .questions) ?? []
        persona = try container.decodeIfPresent(Persona.self, forKey: .persona)
        goals = try container.decodeIfPresent([String].self, forKey: .goals) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case id = "sessionId"
        case mode, provider, credentials, expiresAt, opening, role, company, questions, persona, goals
    }
}

public struct PracticeQuestion: Decodable, Equatable, Sendable {
    public enum Source: String, Decodable, Sendable {
        /// Someone recently reported being asked this at the company.
        case reported
        case resume
        case technical
        case behavioral
    }

    public let text: String
    public let source: Source?
    public let reportedIn: String?

    public var isReported: Bool {
        source == .reported
    }

    public init(text: String, source: Source? = nil, reportedIn: String? = nil) {
        self.text = text
        self.source = source
        self.reportedIn = reportedIn
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        text = try container.decode(String.self, forKey: .text)
        source = try? container.decodeIfPresent(Source.self, forKey: .source)
        reportedIn = try container.decodeIfPresent(String.self, forKey: .reportedIn)
    }

    private enum CodingKeys: String, CodingKey { case text, source, reportedIn }
}

public struct Persona: Decodable, Equatable, Sendable {
    public let name: String
    public let role: String
    public let company: String?

    public init(name: String, role: String, company: String? = nil) {
        self.name = name
        self.role = role
        self.company = company
    }
}

public struct VoiceTurn: Encodable, Equatable, Sendable {
    public let question: String
    public let answer: String
    public let durationMs: Int

    public init(question: String, answer: String, durationMs: Int) {
        self.question = question
        self.answer = answer
        self.durationMs = durationMs
    }
}

public struct TurnFeedback: Decodable, Equatable, Sendable {
    public struct Delivery: Decodable, Equatable, Sendable {
        public let words: Int
        public let fillerWords: Int
        public let wordsPerMinute: Double?

        public init(words: Int, fillerWords: Int, wordsPerMinute: Double?) {
            self.words = words
            self.fillerWords = fillerWords
            self.wordsPerMinute = wordsPerMinute
        }
    }

    /// Each scored quality, from 0 to 1.
    public let scores: [String: Double]
    public let delivery: Delivery?
    public let tip: String?

    public init(scores: [String: Double], delivery: Delivery? = nil, tip: String?) {
        self.scores = scores
        self.delivery = delivery
        self.tip = tip
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        scores = try container.decodeIfPresent([String: Double].self, forKey: .scores) ?? [:]
        delivery = try container.decodeIfPresent(Delivery.self, forKey: .delivery)
        tip = try container.decodeIfPresent(String.self, forKey: .tip)
    }

    private enum CodingKeys: String, CodingKey { case scores, delivery, tip }
}

public extension RavenClient {
    func startVoiceSession(_ request: VoiceSessionRequest) async throws(RavenError) -> VoiceSession {
        try await send(authorized("POST", "api/voice/sessions", json: request))
    }

    func submitTurn(_ turn: VoiceTurn, in sessionId: String) async throws(RavenError) -> TurnFeedback {
        try await send(authorized("POST", "api/voice/sessions/\(sessionId)/turns", json: turn))
    }

    func finishVoiceSession(_ sessionId: String) async throws(RavenError) -> SessionDebrief {
        try await send(authorized("POST", "api/voice/sessions/\(sessionId)/finish"))
    }
}
