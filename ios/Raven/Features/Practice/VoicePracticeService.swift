import Foundation
import RavenKit

/// The three server calls a voice session makes, so a session can also run offline.
protocol VoicePracticeService {
    func startVoiceSession(_ request: VoiceSessionRequest) async throws(RavenError) -> VoiceSession
    func submitTurn(_ turn: VoiceTurn, in sessionId: String) async throws(RavenError) -> TurnFeedback
    func finishVoiceSession(_ sessionId: String) async throws(RavenError) -> SessionSummary
}

extension RavenClient: VoicePracticeService {}

/// A session with no server: generic questions, canned tips, and a summary that says nothing was scored.
/// Used when the server has no voice provider yet, and for screenshots.
struct OfflineVoicePractice: VoicePracticeService {
    var questions: [PracticeQuestion] = Self.generalQuestions
    var company: String?

    func startVoiceSession(_ request: VoiceSessionRequest) async throws(RavenError) -> VoiceSession {
        switch request.mode {
        case .interview:
            VoiceSession(
                id: "offline", mode: .interview, provider: "offline",
                opening: "Hi, thanks for making the time. Let's start whenever you're ready.",
                role: request.role, company: company, questions: questions,
            )
        case .networking:
            VoiceSession(
                id: "offline", mode: .networking, provider: "offline",
                opening: "Hey, I'm Sam. I don't think we've met. What brings you here tonight?",
                persona: Persona(name: "Sam", role: "works in tech and comes to most meetups"),
                goals: ["Introduce yourself in a sentence or two", "Ask one real question", "Ask how to follow up"],
            )
        }
    }

    func submitTurn(_: VoiceTurn, in _: String) async throws(RavenError) -> TurnFeedback {
        try? await Task.sleep(for: .milliseconds(600))
        return TurnFeedback(scores: [:], tip: Self.tips.randomElement())
    }

    func finishVoiceSession(_: String) async throws(RavenError) -> SessionSummary {
        try? await Task.sleep(for: .seconds(1.2))
        return .offline
    }

    private static let generalQuestions = [
        PracticeQuestion(text: "Tell me about a project you're proud of, from start to finish.", source: .behavioral),
        PracticeQuestion(text: "Describe a time you had to learn something quickly.", source: .behavioral),
        PracticeQuestion(text: "Where do you want to be in two years?", source: .behavioral),
    ]

    private static let tips = [
        "Open with the situation in one sentence, then what you did.",
        "Answer the exact question first, then back it up.",
        "End with the result, and a number if you have one.",
    ]
}

extension SessionSummary {
    static let offline = SessionSummary(
        summary: "This was an offline practice run, so your answers weren't scored. The questions and timing match a real session.",
        prepList: [
            .init(step: "Write one story for each question", why: "A prepared story keeps you from rambling when you're nervous."),
            .init(step: "Practise the first sentence out loud", why: "A clear opening sets up the rest of the answer."),
            .init(step: "Run a scored session once you're online", why: "Raven can then point at exactly what to fix."),
        ],
    )
}
