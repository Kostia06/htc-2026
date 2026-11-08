import Foundation

/// What the server hands over for an ElevenLabs session. The prompt travels with the credentials because
/// ElevenLabs takes it from the client at connect time, as an override on the agent.
public struct ElevenLabsCredentials: Equatable, Sendable {
    /// Voice over WebRTC, the only path the Swift SDK supports for audio.
    public let conversationToken: String
    public let prompt: String?
    /// Fills the agent's first message, which is set to "{{opening}}" on ElevenLabs.
    public let opening: String?

    public init(conversationToken: String, prompt: String?, opening: String?) {
        self.conversationToken = conversationToken
        self.prompt = prompt
        self.opening = opening
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
        opening = fields["dynamicVariables"]?["opening"]?.stringValue
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
