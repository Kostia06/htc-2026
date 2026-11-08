import ElevenLabs
import RavenKit

/// The phone talks to the same ElevenLabs agents as the headset (Eric interviews, Jessica networks), with the
/// prompt the server built for this session. ElevenLabs owns listening, turn-taking and interruptions; we only
/// relay what happens to the screen.
final class ElevenLabsVoiceEngine: VoiceEngine {
    private var conversation: Conversation?
    private var connecting: Task<Void, Never>?
    private var continuation: AsyncStream<VoiceEvent>.Continuation?

    func start(_ session: VoiceSession) -> AsyncStream<VoiceEvent> {
        start(credentials: session.credentials)
    }

    /// Used directly by anything that has voice credentials but no practice session, like the interview recap.
    func start(credentials raw: JSONValue) -> AsyncStream<VoiceEvent> {
        AsyncStream { continuation in
            self.continuation = continuation
            continuation.yield(.stateChanged(.connecting))
            guard let credentials = ElevenLabsCredentials(raw) else {
                continuation.yield(.failed("This server didn't hand out a voice connection. Try again in a moment."))
                continuation.finish()
                return
            }
            connecting = Task { await connect(with: credentials, into: continuation) }
        }
    }

    /// The screen moves on at once; hanging up finishes in the background.
    func stop() {
        connecting?.cancel()
        continuation?.finish()
        continuation = nil
        guard let conversation else { return }
        self.conversation = nil
        Task { await conversation.endConversation() }
    }

    private func connect(with credentials: ElevenLabsCredentials, into continuation: AsyncStream<VoiceEvent>.Continuation) async {
        let config = ConversationConfig(
            agentOverrides: AgentOverrides(prompt: credentials.prompt, firstMessage: credentials.firstMessage),
            onError: { error in continuation.yield(.failed(error.localizedDescription)) },
            onAgentResponse: { text, _ in continuation.yield(.transcript(.agent, text)) },
            onUserTranscript: { text, _ in continuation.yield(.transcript(.person, text)) },
            onVadScore: { score in continuation.yield(.level(Float(score))) },
            // the manager turns speaking/VAD/transcript events into one agent state; without it the callback never fires
            agentStateConfiguration: .default,
            onAgentStateChange: { state in
                continuation.yield(.stateChanged(VoiceState(state)))
                if state == .speaking { continuation.yield(.level(0.7)) }
            },
        )
        do {
            let started = try await ElevenLabs.startConversation(
                conversationToken: credentials.conversationToken,
                config: config,
                onAgentReady: { continuation.yield(.stateChanged(.speaking)) },
                onDisconnect: { _ in continuation.finish() },
            )
            guard !Task.isCancelled else {
                await started.endConversation()
                return
            }
            conversation = started
        } catch {
            continuation.yield(.failed("Couldn't reach the interviewer. \(error.localizedDescription)"))
            continuation.finish()
        }
    }
}

nonisolated private extension VoiceState {
    init(_ state: ElevenLabs.AgentState) {
        switch state {
        case .listening: self = .listening
        case .speaking: self = .speaking
        case .thinking: self = .thinking
        }
    }
}
