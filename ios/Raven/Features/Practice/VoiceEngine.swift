import RavenKit

/// Runs the spoken side of a session and reports what happens. The stream finishes when the conversation
/// is over, either on its own or after `stop()`.
protocol VoiceEngine: AnyObject {
    func start(_ session: VoiceSession) -> AsyncStream<VoiceEvent>
    func stop()
}

enum VoiceEvent: Equatable {
    case stateChanged(VoiceState)
    /// Loudness of whoever is talking, 0–1.
    case level(Float)
    /// A finished line from either side, as the provider transcribed it.
    case transcript(Speaker, String)
    case failed(String)
}

enum VoiceState: Equatable {
    case connecting, listening, speaking, thinking

    var label: String {
        switch self {
        case .connecting: "Connecting…"
        case .listening: "Your turn"
        case .speaking: "Speaking"
        case .thinking: "Thinking"
        }
    }
}

enum Speaker: Equatable {
    case agent, person
}
