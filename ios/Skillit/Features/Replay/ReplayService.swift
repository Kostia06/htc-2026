import Foundation
import SkillitKit

/// Where a replay and its recording come from: the server in the app, sample data in previews.
protocol ReplayService: Sendable {
    func sessionReplay(id: String) async throws(SkillitError) -> SessionReplay
    func replayAudio(id: String) async throws(SkillitError) -> Data
}

extension SkillitClient: ReplayService {}

struct UnavailableReplay: ReplayService {
    func sessionReplay(id _: String) async throws(SkillitError) -> SessionReplay {
        throw .offline
    }

    func replayAudio(id _: String) async throws(SkillitError) -> Data {
        throw .offline
    }
}

extension AppModel {
    var replayService: any ReplayService {
        client ?? UnavailableReplay()
    }
}

#if DEBUG
    /// A three-minute interview with every kind of moment and no audio, for previews and screenshots.
    struct SampleReplay: ReplayService {
        func sessionReplay(id _: String) async throws(SkillitError) -> SessionReplay {
            .sample
        }

        func replayAudio(id _: String) async throws(SkillitError) -> Data {
            throw .offline
        }
    }

    extension SessionReplay {
        static let sample = SessionReplay(
            audioUrl: "/api/voice/sessions/preview/replay/audio", recording: .ready, timing: .seconds, durationSec: 190,
            moments: [
                ReplayMoment(
                    seconds: 14, kind: .strength, title: "This worked", detail: "A before-and-after number makes the impact land.",
                    said: "four hours to forty minutes", question: "Tell me about a project you're proud of.", turn: 0,
                ),
                ReplayMoment(
                    seconds: 71, kind: .filler, title: "4 filler words", detail: "Pause for a breath instead of saying \"um\" or \"like\".",
                    question: "Why our lending team?", turn: 1,
                ),
                ReplayMoment(
                    seconds: 102, kind: .mistake, title: "Stayed too general",
                    detail: "Generic. Name one thing they do that you want in on.",
                    question: "Why our lending team?", turn: 1,
                ),
                ReplayMoment(
                    seconds: 103, kind: .better, title: "A stronger way to say it",
                    detail: "Tie it to something specific about them and something about you.",
                    better: "Your lending team shipped instant approvals last year. I spent my co-op on risk models.",
                    said: "fintech is really interesting", question: "Why our lending team?", turn: 1,
                ),
                ReplayMoment(
                    seconds: 104, kind: .researched, title: "How their interviewers hear it",
                    detail: "Their careers page says they hire people who own outcomes, so name what you owned.",
                    better: "I owned the risk model end to end and cut review time by [number].",
                    said: "fintech is really interesting", question: "Why our lending team?", turn: 1,
                    sources: [ReplaySource(title: "Our values", url: URL(string: "https://example.com/careers/values")!)],
                ),
            ],
            transcript: [
                ReplayLine(seconds: 0, speaker: .agent, text: "Tell me about a project you're proud of."),
                ReplayLine(seconds: 6, speaker: .person, text: "I rebuilt our reporting pipeline at ATB."),
                ReplayLine(seconds: 14, speaker: .person, text: "The nightly run went from four hours to forty minutes."),
                ReplayLine(seconds: 64, speaker: .agent, text: "Why do you want to work on our lending team?"),
                ReplayLine(seconds: 70, speaker: .person, text: "Um, I think fintech is really interesting and, like, I'd learn a lot."),
                ReplayLine(seconds: 150, speaker: .agent, text: "Thanks, that's everything from me."),
            ],
        )
    }
#endif
