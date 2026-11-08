import Foundation

/// What the server hands over for an ElevenLabs session. The prompt travels with the credentials because
/// ElevenLabs takes it from the client at connect time, as an override on the agent.
public struct ElevenLabsCredentials: Equatable, Sendable {
    /// Voice over WebRTC, the only path the Swift SDK supports for audio.
    public let conversationToken: String
    public let prompt: String?
    public let firstMessage: String?

    public init(conversationToken: String, prompt: String?, firstMessage: String?) {
        self.conversationToken = conversationToken
        self.prompt = prompt
        self.firstMessage = firstMessage
    }

    /// nil when the session is for another provider or the token is missing
    public init?(_ credentials: JSONValue) {
        guard case let .object(fields) = credentials,
              fields["kind"] == .string("elevenlabs"),
              case let .string(token)? = fields["conversationToken"], !token.isEmpty
        else { return nil }
        let agent = fields["overrides"]?["agent"]
        conversationToken = token
        prompt = agent?["prompt"]?["prompt"]?.stringValue
        firstMessage = agent?["firstMessage"]?.stringValue
    }
}

extension JSONValue {
    subscript(key: String) -> JSONValue? {
        guard case let .object(fields) = self else { return nil }
        return fields[key]
    }

    var stringValue: String? {
        guard case let .string(value) = self else { return nil }
        return value
    }
}
