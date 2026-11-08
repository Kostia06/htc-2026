import Foundation
import Observation
import SkillitKit

/// One spoken practice session: gets a session from the server, runs it through a voice engine,
/// scores each answer in the background as it lands, and fetches the debrief at the end.
@Observable
final class VoiceSessionModel: Identifiable {
    enum Phase: Equatable {
        case live
        case wrappingUp
        case finished(SessionDebrief)
        /// Ended before any answer, so there is nothing to sum up.
        case closed
        case failed(String)
    }

    private(set) var phase: Phase = .live
    private(set) var voiceState: VoiceState = .connecting
    private(set) var level: Float = 0
    private(set) var question: PracticeQuestion?
    /// 1-based position of the latest planned question the agent reached; nil until it asks the first one.
    private(set) var questionNumber: Int?
    private(set) var company: String?
    private(set) var tip: String?
    private(set) var answersScored = 0

    let request: VoiceSessionRequest
    private let service: any VoicePracticeService
    private let engine: any VoiceEngine
    private var session: VoiceSession?
    private var transcript = TranscriptTurns()
    private var scoring: [Task<Void, Never>] = []
    /// The interviewer said goodbye after the last question; the call ends once it stops speaking.
    private var isSigningOff = false

    init(request: VoiceSessionRequest, service: any VoicePracticeService, engine: any VoiceEngine) {
        self.request = request
        self.service = service
        self.engine = engine
    }

    var hasStarted: Bool {
        session != nil
    }

    /// How many questions the server planned for this interview.
    var questionCount: Int {
        session?.questions.count ?? 0
    }

    func run() async {
        guard let session = await startSession(), !Task.isCancelled else { return }
        self.session = session
        company = session.company
        for await event in engine.start(session) {
            handle(event, in: session)
        }
        // the screen went away mid-call: hang up, or the mic and the agent keep going in the background
        if Task.isCancelled {
            engine.stop()
            return
        }
        guard phase == .live else { return }
        if let last = transcript.flush() {
            submit(last, in: session)
        }
        await wrapUp(session)
    }

    func end() {
        engine.stop()
    }

    func dismissTip() {
        tip = nil
    }

    private func startSession() async -> VoiceSession? {
        do {
            return try await service.startVoiceSession(request)
        } catch let .rejected(status, message) where status == 503 {
            let reason = "\(message.prefix(1).uppercased())\(message.dropFirst())"
            phase = .failed("\(reason). Voice practice needs the server's ElevenLabs agents; there's no offline voice.")
            return nil
        } catch {
            phase = .failed(error.message)
            return nil
        }
    }

    private func handle(_ event: VoiceEvent, in session: VoiceSession) {
        switch event {
        case let .stateChanged(state):
            voiceState = state
            if isSigningOff, state == .listening {
                engine.stop()
            }
        case let .level(newLevel):
            // rise at once, fall gently, so the bars don't flicker between readings
            level = max(newLevel, level * 0.8)
        case let .transcript(speaker, text):
            if speaker == .agent {
                showQuestion(from: text, in: session)
                isSigningOff = isSigningOff || session.isSignOff(text, afterQuestion: questionNumber)
            }
            if let turn = transcript.add(speaker == .agent ? .agent : .person, text) {
                submit(turn, in: session)
            }
        case let .failed(message):
            phase = .failed(message)
            engine.stop()
        }
    }

    /// The voice decorates its lines with tags like `[laughs]`; the screen shows the words, and a line that was only tags changes nothing.
    private func showQuestion(from spokenLine: String, in session: VoiceSession) {
        let spoken = spokenLine.withoutAudioTags
        guard !spoken.isEmpty else { return }
        if let index = session.plannedQuestionIndex(matching: spoken) {
            question = session.questions[index]
            questionNumber = index + 1
        } else {
            question = PracticeQuestion(text: spoken)
        }
    }

    private func submit(_ turn: VoiceTurn, in session: VoiceSession) {
        scoring.append(Task {
            // a turn that fails to score only loses its tip; the conversation carries on
            guard let feedback = try? await service.submitTurn(turn, in: session.id) else { return }
            answersScored += 1
            tip = feedback.tip
        })
    }

    private func wrapUp(_ session: VoiceSession) async {
        guard !scoring.isEmpty else {
            phase = .closed
            return
        }
        phase = .wrappingUp
        for task in scoring {
            await task.value
        }
        do {
            let debrief = try await service.finishVoiceSession(session.id)
            phase = .finished(debrief)
        } catch {
            phase = .failed(error.message)
        }
    }
}
