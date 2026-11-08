import Foundation
import SkillitKit

/// The server calls a voice session makes, so the debug screen can run one without a server.
protocol VoicePracticeService {
    func startVoiceSession(_ request: VoiceSessionRequest) async throws(SkillitError) -> VoiceSession
    func submitTurn(_ turn: VoiceTurn, in sessionId: String) async throws(SkillitError) -> TurnFeedback
    func finishVoiceSession(_ sessionId: String) async throws(SkillitError) -> SessionDebrief
}

extension SkillitClient: VoicePracticeService {}

/// Sample data for the debug screen and screenshots: a scripted session, canned tips and a sample debrief.
/// Never used in a real session; without the server there is no voice.
struct PreviewVoicePractice: VoicePracticeService {
    var questions: [PracticeQuestion] = Self.generalQuestions
    var company: String?

    func startVoiceSession(_ request: VoiceSessionRequest) async throws(SkillitError) -> VoiceSession {
        VoiceSession(
            id: "preview", mode: .interview, provider: "preview",
            opening: "Hi, thanks for coming in. Ready to start?",
            role: request.role, company: company, questions: questions,
        )
    }

    func submitTurn(_: VoiceTurn, in _: String) async throws(SkillitError) -> TurnFeedback {
        try? await Task.sleep(for: .milliseconds(600))
        return TurnFeedback(scores: [:], tip: Self.tips.randomElement())
    }

    func finishVoiceSession(_: String) async throws(SkillitError) -> SessionDebrief {
        try? await Task.sleep(for: .seconds(1.2))
        return .sample
    }

    private static let generalQuestions = [
        PracticeQuestion(text: "Tell me about a project you're proud of, from start to finish.", source: .behavioral),
        PracticeQuestion(text: "Describe a time you had to learn something quickly.", source: .behavioral),
    ]

    private static let tips = [
        "Open with the situation in one sentence, then what you did.",
        "Answer the exact question first, then back it up.",
        "End with the result, and a number if you have one.",
    ]
}

extension SessionDebrief {
    static let sample = SessionDebrief(
        overall: 68,
        verdict: "Clear stories with real ownership, but the results stayed vague.",
        strengths: [
            .init(quote: "I led the rebuild of our reporting pipeline", why: "You said what you did, not what the team did."),
            .init(quote: "four hours to forty minutes", why: "A before-and-after number makes the impact land instantly."),
        ],
        improvements: [
            .init(
                moment: "Why do you want to work on our lending team?",
                said: "I think fintech is really interesting and I'd learn a lot.",
                better: "Tie it to something specific about them and something specific about you.",
                example: "Your lending team shipped instant approvals last year. I spent my co-op on risk models, "
                    + "so that's the problem I want to work on.",
            ),
            .init(
                moment: "Describe a time you had to learn something quickly.",
                said: "I picked up dbt pretty fast and it went fine.",
                better: "Say how you learned it and what it let you ship.",
                example: "I had two weeks to learn dbt. I rebuilt one model a day from the docs and had the full pipeline "
                    + "in tests by week two.",
            ),
            .init(
                moment: "Tell me about a project you're proud of.",
                said: "We got good feedback on it.",
                better: "End on a result you can measure, in one sentence.",
                example: "Analysts stopped waiting on the nightly run, and the team picked it as the default pipeline.",
            ),
        ],
        perQuestion: [
            .init(
                question: "Why do you want to work on our lending team?", score: 54,
                oneLineFeedback: "Generic. Name one thing they do that you want in on.",
            ),
            .init(
                question: "Tell me about a project you're proud of, from start to finish.", score: 81,
                oneLineFeedback: "Strong story, strong number.",
            ),
            .init(
                question: "Describe a time you had to learn something quickly.", score: 69,
                oneLineFeedback: "Good pace, missing how you actually learned it.",
            ),
        ],
        nextSteps: [
            "Write one sentence about why this company, with a fact only someone who looked would know.",
            "Rehearse the lending answer out loud twice, under 60 seconds.",
        ],
    )
}
