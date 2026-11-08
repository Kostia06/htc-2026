import Foundation
import RavenKit

/// No audio at all: walks the screen through connecting, the agent asking, and the person answering.
/// For the debug screen and screenshots only; a real session always goes through ElevenLabs.
final class PreviewVoiceEngine: VoiceEngine {
    private static let answer = "I led the rebuild of our reporting pipeline and cut the nightly run from four hours to forty minutes."
    private var task: Task<Void, Never>?

    func start(_ session: VoiceSession) -> AsyncStream<VoiceEvent> {
        AsyncStream { continuation in
            task = Task {
                await play(session, into: continuation)
                continuation.finish()
            }
        }
    }

    func stop() {
        task?.cancel()
    }

    private func play(_ session: VoiceSession, into continuation: AsyncStream<VoiceEvent>.Continuation) async {
        continuation.yield(.stateChanged(.connecting))
        try? await Task.sleep(for: .seconds(1.2))
        let lines = [session.opening] + session.questions.map(\.text)
        for line in lines where !Task.isCancelled {
            continuation.yield(.stateChanged(.speaking))
            continuation.yield(.transcript(.agent, line))
            await breathe(0.7, for: 2.5, into: continuation)
            continuation.yield(.stateChanged(.listening))
            await breathe(0.55, for: 6, into: continuation)
            continuation.yield(.transcript(.person, Self.answer))
        }
    }

    private func breathe(_ peak: Float, for seconds: Double, into continuation: AsyncStream<VoiceEvent>.Continuation) async {
        let end = Date.now.addingTimeInterval(seconds)
        while Date.now < end, !Task.isCancelled {
            continuation.yield(.level(Float.random(in: peak * 0.5 ... peak)))
            try? await Task.sleep(for: .milliseconds(120))
        }
    }
}
