import AVFAudio
import RavenKit

/// The default voice: everything on device. Speaks with the best installed voice, transcribes with SpeechAnalyzer,
/// hands the turn back after a short pause, and stops talking the moment the person cuts in.
final class LocalVoiceEngine: VoiceEngine {
    private let speech = SpeechPlayer()
    private let listener = SpeechListener()
    private let clock = ContinuousClock()
    private var conversation: Task<Void, Never>?
    private var listening: Task<Void, Never>?
    private var events: AsyncStream<VoiceEvent>.Continuation?

    private var detector = TurnDetector()
    private var turnStarted = ContinuousClock.now
    private var isSpeaking = false
    private var wasInterrupted = false

    var voiceHint: String? {
        speech.voiceHint
    }

    func start(_ session: VoiceSession, director: any ConversationDirector) -> AsyncStream<VoiceEvent> {
        let (stream, events) = AsyncStream.makeStream(of: VoiceEvent.self)
        self.events = events
        conversation = Task {
            await converse(session, director)
            stop()
        }
        events.onTermination = { [weak self] _ in
            Task { @MainActor in self?.stop() }
        }
        return stream
    }

    /// Everything at once: voice, recognizer, microphone, audio session.
    func stop() {
        conversation?.cancel()
        conversation = nil
        speech.stop()
        listening?.cancel()
        listening = nil
        listener.stop()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        events?.finish()
        events = nil
    }

    private func converse(_ session: VoiceSession, _ director: any ConversationDirector) async {
        events?.yield(.stateChanged(.connecting))
        do {
            try AVAudioSession.sharedInstance().setCategory(.playAndRecord, options: [.defaultToSpeaker, .allowBluetoothHFP])
            try AVAudioSession.sharedInstance().setActive(true)
            let heard = try await listener.start()
            listening = Task {
                for await event in heard {
                    handle(event)
                }
            }
        } catch let failure as SpeechListener.Failure {
            events?.yield(.failed(failure.message))
            return
        } catch {
            events?.yield(.failed("Sound isn't available right now. Try again in a moment."))
            return
        }

        var transcript: [TranscriptLine] = []
        var line = NextLine(say: session.opening, kind: .question)
        var isOpening = true
        while !Task.isCancelled {
            transcript.append(TranscriptLine(speaker: .interviewer, text: line.say))
            await say(line.say)
            guard !Task.isCancelled, line.kind != .wrapUp else { return }
            let (answer, durationMs) = await listen()
            guard !Task.isCancelled else { return }
            transcript.append(TranscriptLine(speaker: .candidate, text: answer))
            events?.yield(.transcript(.person, answer))
            // the opening is small talk, not something to score
            if !isOpening, !answer.isEmpty {
                events?.yield(.turnFinished(question: line.say, answer: answer, durationMs: durationMs))
            }
            isOpening = false
            events?.yield(.stateChanged(.thinking))
            line = await director.nextLine(after: answer, transcript: transcript)
        }
    }

    private func say(_ line: String) async {
        events?.yield(.transcript(.agent, line))
        events?.yield(.stateChanged(.speaking))
        listener.clearHeard()
        wasInterrupted = false
        isSpeaking = true
        // the synthesizer doesn't report loudness, so the bars move on an invented level while it talks
        let motion = Task {
            while !Task.isCancelled {
                events?.yield(.level(Float.random(in: 0.35 ... 0.9)))
                try? await Task.sleep(for: .milliseconds(90))
            }
        }
        await speech.speak(line)
        motion.cancel()
        isSpeaking = false
        events?.yield(.level(0))
        // whatever leaked in from the speaker while it talked isn't the person's answer
        if !wasInterrupted {
            listener.clearHeard()
        }
    }

    private func listen() async -> (answer: String, durationMs: Int) {
        events?.yield(.stateChanged(.listening))
        detector = listener.canTranscribe ? TurnDetector() : TurnDetector(silenceToFinish: .milliseconds(1200))
        turnStarted = clock.now
        if wasInterrupted {
            detector.hearWords(at: .zero)
        }
        while !Task.isCancelled, !detector.isFinished(at: elapsed) {
            try? await Task.sleep(for: .milliseconds(50))
        }
        events?.yield(.level(0))
        let durationMs = Int(elapsed / .milliseconds(1))
        let answer = listener.canTranscribe ? listener.heard : Self.untranscribed(durationMs)
        listener.clearHeard()
        return (answer, durationMs)
    }

    private func handle(_ event: SpeechListener.Event) {
        switch event {
        case let .level(level):
            guard !isSpeaking else { return }
            events?.yield(.level(level))
            if !listener.canTranscribe, level >= detector.speechLevel {
                detector.hearWords(at: elapsed)
            }
            detector.hear(level: level, at: elapsed)
        case let .heard(text):
            if isSpeaking {
                guard TurnDetector.isInterruption(text) else { return }
                wasInterrupted = true
                speech.stop()
            } else if !text.isEmpty {
                detector.hearWords(at: elapsed)
            }
        }
    }

    private var elapsed: Duration {
        clock.now - turnStarted
    }

    /// without a recognizer there are no words; say so plainly instead of inventing them
    private static func untranscribed(_ durationMs: Int) -> String {
        "(Spoken answer, \(durationMs / 1000) seconds long. This device couldn't transcribe it.)"
    }
}
