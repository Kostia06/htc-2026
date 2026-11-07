import Foundation
import Observation
import RavenKit

/// One spoken practice session: gets a session from the server, runs it through a voice engine,
/// scores each answer as it lands, and fetches the summary at the end.
@Observable
final class VoiceSessionModel: Identifiable {
    enum Phase: Equatable {
        case live
        case wrappingUp
        case finished(SessionSummary)
        /// Ended before any answer, so there is nothing to sum up.
        case closed
        case failed(String)
    }

    private(set) var phase: Phase = .live
    private(set) var voiceState: VoiceState = .connecting
    private(set) var level: Float = 0
    private(set) var question: PracticeQuestion?
    private(set) var company: String?
    private(set) var tip: String?
    /// Why this session isn't the real thing, when it falls back to running offline.
    private(set) var notice: String?

    private let request: VoiceSessionRequest
    private var service: any VoicePracticeService
    private let engine: any VoiceEngine
    private var session: VoiceSession?
    private var turns: [Task<Void, Never>] = []

    init(request: VoiceSessionRequest, service: any VoicePracticeService, engine: any VoiceEngine) {
        self.request = request
        self.service = service
        self.engine = engine
    }

    var hasStarted: Bool {
        session != nil
    }

    func run() async {
        guard let session = await startSession() else { return }
        self.session = session
        company = session.company ?? session.persona?.company
        for await event in engine.start(session) {
            handle(event, in: session)
        }
        guard phase == .live, !Task.isCancelled else { return }
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
            notice = "\(message.prefix(1).uppercased())\(message.dropFirst()). This is an offline practice run."
            service = OfflineVoicePractice()
            return try? await service.startVoiceSession(request)
        } catch {
            phase = .failed(error.message)
            return nil
        }
    }

    private func handle(_ event: VoiceEvent, in session: VoiceSession) {
        switch event {
        case let .stateChanged(state):
            voiceState = state
        case let .level(newLevel):
            // rise at once, fall gently, so the bars don't flicker between readings
            level = max(newLevel, level * 0.8)
        case let .transcript(speaker, text):
            guard speaker == .agent else { return }
            question = session.questions.first { $0.text == text } ?? PracticeQuestion(text: text)
        case let .turnFinished(question, answer, durationMs):
            submit(VoiceTurn(question: question, answer: answer, durationMs: durationMs), in: session)
        case let .failed(message):
            phase = .failed(message)
            engine.stop()
        }
    }

    private func submit(_ turn: VoiceTurn, in session: VoiceSession) {
        turns.append(Task {
            // a turn that fails to score only loses its tip; the conversation carries on
            guard let feedback = try? await service.submitTurn(turn, in: session.id) else { return }
            tip = feedback.tip
        })
    }

    private func wrapUp(_ session: VoiceSession) async {
        guard !turns.isEmpty else {
            phase = .closed
            return
        }
        phase = .wrappingUp
        for turn in turns {
            await turn.value
        }
        do {
            let summary = try await service.finishVoiceSession(session.id)
            phase = .finished(summary)
        } catch {
            phase = .failed(error.message)
        }
    }
}
