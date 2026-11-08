import Foundation

/// One line of a quick-update chat, as the server wants the conversation so far: Raven's lines are `raven`, the person's `user`.
public struct QuickUpdateLine: Codable, Equatable, Sendable {
    public enum Speaker: String, Codable, Sendable {
        case user, raven
    }

    public let speaker: Speaker
    public let text: String

    public init(speaker: Speaker, text: String) {
        self.speaker = speaker
        self.text = text
    }
}

/// One update in plain words. The conversation so far goes back each time, so the server keeps no chat state.
public struct QuickUpdateRequest: Encodable, Equatable, Sendable {
    public var message: String
    public var conversation: [QuickUpdateLine]

    public init(message: String, conversation: [QuickUpdateLine] = []) {
        self.message = message
        self.conversation = conversation
    }
}

/// One change Raven made: `type` is the server's action name, `summary` the one line to show for it.
public struct AppliedChange: Decodable, Equatable, Sendable, Identifiable {
    public let type: String
    public let summary: String

    public var id: String {
        "\(type):\(summary)"
    }

    public init(type: String, summary: String) {
        self.type = type
        self.summary = summary
    }

    /// True when the change touched the profile rather than the roadmap or private notes, so the app knows what to reload.
    public var touchesProfile: Bool {
        ["add_project", "add_experience", "add_skill", "remove_skill", "add_target_role"].contains(type)
    }
}

/// Raven's answer. `needsAnswer` true means `reply` is the one question it needs answered first and nothing was applied.
public struct QuickUpdateReply: Decodable, Equatable, Sendable {
    public let reply: String
    public let needsAnswer: Bool
    public let applied: [AppliedChange]

    public init(reply: String, needsAnswer: Bool, applied: [AppliedChange] = []) {
        self.reply = reply
        self.needsAnswer = needsAnswer
        self.applied = applied
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        reply = try container.decode(String.self, forKey: .reply)
        needsAnswer = try container.decodeIfPresent(Bool.self, forKey: .needsAnswer) ?? false
        applied = try container.decodeIfPresent([AppliedChange].self, forKey: .applied) ?? []
    }

    private enum CodingKeys: String, CodingKey { case reply, needsAnswer, applied }
}
