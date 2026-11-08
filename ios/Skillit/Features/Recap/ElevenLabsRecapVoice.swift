import SkillitKit

/// Lets the recap talk through the same ElevenLabs engine as practice, keeping only what was said.
final class ElevenLabsRecapVoice: RecapVoice {
    private let engine = ElevenLabsVoiceEngine()

    func start(_ credentials: JSONValue) -> AsyncStream<RecapTranscriptLine> {
        let events = engine.start(credentials: credentials)
        return AsyncStream { continuation in
            let relay = Task {
                for await event in events {
                    guard case let .transcript(speaker, text) = event else { continue }
                    continuation.yield(RecapTranscriptLine(speaker: speaker == .agent ? .skillit : .user, text: text))
                }
                continuation.finish()
            }
            continuation.onTermination = { _ in relay.cancel() }
        }
    }

    func stop() {
        engine.stop()
    }
}
