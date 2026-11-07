import AVFAudio
import RavenKit

/// Stands in for the live providers (Gemini Live, ElevenLabs) until their adapters exist. It reads each question aloud
/// with the on-device voice, listens to the microphone, and ends the answer on a pause. It cannot transcribe, so the
/// answer it reports is a placeholder and the server's scores reflect that.
final class DemoVoiceEngine: VoiceEngine {
    private let speech = SpeechPlayer()
    private let microphone = MicrophoneLevelMonitor()
    private var conversation: Task<Void, Never>?

    func start(_ session: VoiceSession) -> AsyncStream<VoiceEvent> {
        let (stream, events) = AsyncStream.makeStream(of: VoiceEvent.self)
        conversation = Task {
            await converse(session, events)
            events.finish()
        }
        events.onTermination = { [weak self] _ in
            Task { @MainActor in self?.stop() }
        }
        return stream
    }

    func stop() {
        conversation?.cancel()
        conversation = nil
        microphone.stop()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func converse(_ session: VoiceSession, _ events: AsyncStream<VoiceEvent>.Continuation) async {
        events.yield(.stateChanged(.connecting))
        do {
            try AVAudioSession.sharedInstance().setCategory(.playAndRecord, options: .defaultToSpeaker)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            events.yield(.failed("Sound isn't available right now. Try again in a moment."))
            return
        }
        await say(session.opening, events)
        for question in Self.prompts(for: session) {
            guard !Task.isCancelled else { return }
            await say(question, events)
            guard !Task.isCancelled else { return }
            do {
                let durationMs = try await listen(events)
                events.yield(.turnFinished(question: question, answer: Self.placeholderAnswer(durationMs), durationMs: durationMs))
            } catch {
                events.yield(.failed(error.message))
                return
            }
            events.yield(.stateChanged(.thinking))
            try? await Task.sleep(for: .seconds(1.5))
        }
    }

    private func say(_ line: String, _ events: AsyncStream<VoiceEvent>.Continuation) async {
        events.yield(.transcript(.agent, line))
        events.yield(.stateChanged(.speaking))
        // the synthesizer doesn't report loudness, so the bars move on an invented level while it talks
        let motion = Task {
            while !Task.isCancelled {
                events.yield(.level(Float.random(in: 0.35 ... 0.9)))
                try? await Task.sleep(for: .milliseconds(90))
            }
        }
        await speech.speak(line)
        motion.cancel()
        events.yield(.level(0))
    }

    private func listen(_ events: AsyncStream<VoiceEvent>.Continuation) async throws(MicrophoneLevelMonitor.Failure) -> Int {
        events.yield(.stateChanged(.listening))
        let levels = try await microphone.levels()
        defer { microphone.stop() }
        let clock = ContinuousClock()
        let started = clock.now
        var timer = AnswerTimer()
        for await level in levels {
            events.yield(.level(level))
            if timer.isFinished(hearing: level, after: clock.now - started) {
                break
            }
        }
        events.yield(.level(0))
        return Int((clock.now - started) / .milliseconds(1))
    }

    private static func prompts(for session: VoiceSession) -> [String] {
        if !session.questions.isEmpty {
            return session.questions.map(\.text)
        }
        return [
            "So what are you working on these days?",
            "What kind of role are you hoping to land next?",
            "Is there anything I can help you with, or someone you'd like to meet?",
        ]
    }

    /// the server needs answer text; the demo has none, so it says so plainly instead of inventing words
    private static func placeholderAnswer(_ durationMs: Int) -> String {
        "(Spoken answer, \(durationMs / 1000) seconds long. The on-device demo doesn't transcribe yet.)"
    }
}
