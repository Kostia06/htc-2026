import Foundation

/// One line of a "tell Raven how it went" chat. Raven's lines are `raven`, the person's are `user`.
public struct RecapMessage: Codable, Equatable, Sendable {
    public enum Role: String, Codable, Sendable {
        case user, raven
    }

    public let role: Role
    public let text: String

    public init(role: Role, text: String) {
        self.role = role
        self.text = text
    }
}

/// One typed turn. The whole history goes back each time, so the server keeps no chat state.
public struct RecapTurnRequest: Encodable, Equatable, Sendable {
    public var companySlug: String?
    public var message: String
    public var history: [RecapMessage]

    public init(companySlug: String? = nil, message: String, history: [RecapMessage]) {
        self.companySlug = companySlug
        self.message = message
        self.history = history
    }
}

/// What Raven understood from the story. Present only once the recap is `done`.
public struct RecapExtracted: Decodable, Equatable, Sendable {
    public let company: String?
    public let role: String?
    public let round: String?
    public let questions: [String]
    public let tip: String?
    public let outcome: String?

    public init(
        company: String? = nil, role: String? = nil, round: String? = nil, questions: [String], tip: String? = nil, outcome: String? = nil,
    ) {
        self.company = company
        self.role = role
        self.round = round
        self.questions = questions
        self.tip = tip
        self.outcome = outcome
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        company = try container.decodeIfPresent(String.self, forKey: .company)
        role = try container.decodeIfPresent(String.self, forKey: .role)
        round = try container.decodeIfPresent(String.self, forKey: .round)
        questions = try container.decodeIfPresent([String].self, forKey: .questions) ?? []
        tip = try container.decodeIfPresent(String.self, forKey: .tip)
        outcome = try container.decodeIfPresent(String.self, forKey: .outcome)
    }

    private enum CodingKeys: String, CodingKey { case company, role, round, questions, tip, outcome }
}

/// Raven's next line. `done` false means `reply` is one clarifying question; true means the recap is finished.
public struct RecapReply: Decodable, Equatable, Sendable {
    public let reply: String
    public let done: Bool
    public let extracted: RecapExtracted?
    /// True once the questions went into the anonymised pool other people see; false when they stayed in your notes.
    public let shared: Bool

    public init(reply: String, done: Bool, extracted: RecapExtracted? = nil, shared: Bool = false) {
        self.reply = reply
        self.done = done
        self.extracted = extracted
        self.shared = shared
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        reply = try container.decode(String.self, forKey: .reply)
        done = try container.decode(Bool.self, forKey: .done)
        extracted = try container.decodeIfPresent(RecapExtracted.self, forKey: .extracted)
        shared = try container.decodeIfPresent(Bool.self, forKey: .shared) ?? false
    }

    private enum CodingKeys: String, CodingKey { case reply, done, extracted, shared }
}

/// A started voice recap: the provider credentials go to the voice engine untouched.
public struct RecapVoiceStart: Decodable, Equatable, Sendable, Identifiable {
    public let id: String
    public let opening: String
    public let provider: String
    public let credentials: JSONValue
    public let expiresAt: String?

    public init(id: String, opening: String, provider: String, credentials: JSONValue = .object([:]), expiresAt: String? = nil) {
        self.id = id
        self.opening = opening
        self.provider = provider
        self.credentials = credentials
        self.expiresAt = expiresAt
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        opening = try container.decode(String.self, forKey: .opening)
        provider = try container.decodeIfPresent(String.self, forKey: .provider) ?? "unknown"
        credentials = try container.decodeIfPresent(JSONValue.self, forKey: .credentials) ?? .null
        expiresAt = try container.decodeIfPresent(String.self, forKey: .expiresAt)
    }

    private enum CodingKeys: String, CodingKey {
        case id = "sessionId"
        case opening, provider, credentials, expiresAt
    }
}

/// One spoken line of a voice recap, as the server wants it back.
public struct RecapTranscriptLine: Encodable, Equatable, Sendable {
    public enum Speaker: String, Encodable, Sendable {
        case user, raven
    }

    public let speaker: Speaker
    public let text: String

    public init(speaker: Speaker, text: String) {
        self.speaker = speaker
        self.text = text
    }
}
