import RavenKit

/// Decides what the interviewer says after each answer.
protocol ConversationDirector {
    func nextLine(after answer: String, transcript: [TranscriptLine]) async -> NextLine
}

/// Asks the server, which can follow up on what was said; if it can't answer, the planned questions carry on in order.
struct SessionDirector: ConversationDirector {
    let service: any VoicePracticeService
    let session: VoiceSession

    func nextLine(after answer: String, transcript: [TranscriptLine]) async -> NextLine {
        if let line = try? await service.nextLine(after: answer, transcript: transcript, in: session.id) {
            return line
        }
        return script.nextLine(after: transcript)
    }

    private var script: ScriptedConversation {
        switch session.mode {
        case .interview:
            ScriptedConversation(lines: session.questions.map(\.text))
        case .networking:
            ScriptedConversation(lines: Self.networkingLines, wrapUp: "Anyway, I should go grab a drink. Really nice meeting you!")
        }
    }

    private static let networkingLines = [
        "So what are you working on these days?",
        "Nice. What kind of role are you hoping to land next?",
        "Is there anyone here you were hoping to meet?",
    ]
}
