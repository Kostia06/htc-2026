import RavenKit

/// Runs the spoken side of a session: plays the agent, listens to the person, and reports what happens.
/// The stream finishes when the conversation is over, either on its own or after `stop()`.
protocol VoiceEngine: AnyObject {
    /// One line for the screen about the voice itself, such as how to get a more natural one.
    var voiceHint: String? { get }
    func start(_ session: VoiceSession, director: any ConversationDirector) -> AsyncStream<VoiceEvent>
    func stop()
}

enum VoiceEvent: Equatable {
    case stateChanged(VoiceState)
    /// Loudness of whoever is talking, 0–1.
    case level(Float)
    case transcript(Speaker, String)
    case turnFinished(question: String, answer: String, durationMs: Int)
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
