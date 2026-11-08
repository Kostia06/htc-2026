import Foundation
import RavenKit

/// The server calls a recap makes, so the screen can also run with no account for screenshots and previews.
protocol RecapService {
    func recapTurn(_ request: RecapTurnRequest) async throws(RavenError) -> RecapReply
    func startRecapVoice(companySlug: String?) async throws(RavenError) -> RecapVoiceStart
    func finishRecapVoice(_ sessionId: String, transcript: [RecapTranscriptLine]) async throws(RavenError) -> RecapReply
}

extension RavenClient: RecapService {}

/// No server: asks one clarifying question the first time, then wraps up with a fixed extraction.
struct OfflineRecapService: RecapService {
    func recapTurn(_ request: RecapTurnRequest) async throws(RavenError) -> RecapReply {
        try? await Task.sleep(for: .milliseconds(900))
        let alreadyAsked = request.history.contains { $0.role == .raven && $0.text.hasSuffix("?") && $0.text != RecapModel.opening }
        if alreadyAsked || request.companySlug != nil {
            return Self.finished
        }
        return RecapReply(reply: "Nice. Which company was that with?", done: false)
    }

    func startRecapVoice(companySlug _: String?) async throws(RavenError) -> RecapVoiceStart {
        RecapVoiceStart(id: "offline", opening: RecapModel.opening, provider: "offline")
    }

    func finishRecapVoice(_: String, transcript _: [RecapTranscriptLine]) async throws(RavenError) -> RecapReply {
        try? await Task.sleep(for: .milliseconds(900))
        return Self.finished
    }

    static let finished = RecapReply(
        reply: "Got it: 2 questions from ATB's technical round. I'll share them anonymously.",
        done: true,
        extracted: RecapExtracted(
            company: "ATB Financial", role: "Junior data analyst", round: "technical",
            questions: ["Explain a left join", "How would you find a slow query?"]
        ),
        shared: true
    )
}
