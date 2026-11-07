#if DEBUG
    import RavenKit
    import SwiftUI

    /// Opens one screen with sample data: launch with `-RavenScreen review` (Debug builds only), for screenshots and design review.
    enum DebugScreen: String {
        case signIn, reading, review, roadmap, forYou, practice, voice, summary, profile

        static var requested: DebugScreen? {
            UserDefaults.standard.string(forKey: "RavenScreen").flatMap(DebugScreen.init(rawValue:))
        }

        @ViewBuilder var view: some View {
            switch self {
            case .signIn:
                SignInView().environment(AppModel.preview(profile: .empty, phase: .signedOut))
            case .reading:
                OnboardingFlow(model: .preview(step: .reading(fileName: "Jordan_Lee_Resume.pdf"), draft: .empty, missing: []))
                    .environment(AppModel.preview(profile: .empty))
            case .review:
                OnboardingFlow(model: .preview(step: .reviewing, draft: .sample, missing: Self.sampleQuestions))
                    .environment(AppModel.preview(profile: .empty))
            case .roadmap: tabs(.roadmap)
            case .forYou: tabs(.forYou)
            case .practice: tabs(.practice)
            case .voice: DebugVoiceSession()
            case .summary: SessionSummaryView(summary: .offline, onDone: {})
            case .profile: tabs(.profile)
            }
        }

        private func tabs(_ section: MainTabView.Section) -> some View {
            MainTabView(selection: section).environment(AppModel.preview(profile: .sample))
        }

        private static let sampleQuestions = ["Which role do you want next?", "Any projects you'd like to show?"]
    }

    /// Holds its model in state so a re-render doesn't start a second session.
    private struct DebugVoiceSession: View {
        @State private var model = VoiceSessionModel(
            request: VoiceSessionRequest(mode: .interview),
            service: OfflineVoicePractice(
                questions: [PracticeQuestion(text: "Why do you want to work on our lending team?", source: .reported)],
                company: "ATB Financial",
            ),
            engine: DemoVoiceEngine(),
        )

        var body: some View {
            VoiceSessionView(model: model)
        }
    }

    extension Profile {
        static let sample = Profile(
            headline: "Third-year computer science student",
            targetRoles: ["Junior data analyst"],
            skills: [
                .init(name: "Python", source: .resume, evidence: "Built a Python Flask API that served 2,000 internal users"),
                .init(name: "SQL", source: .resume, evidence: "Wrote SQL reports in Postgres for the lending team"),
                .init(name: "Public speaking", source: .selfReported),
            ],
            education: [
                .init(
                    school: "University of Calgary",
                    program: "BSc Computer Science",
                    year: "Third-year",
                    expectedGraduation: "April 2028",
                ),
            ],
            experience: [
                .init(role: "Software Developer Co-op", org: "ATB Financial", start: "May 2026", end: "Aug 2026", highlights: nil),
            ],
        )
    }
#endif
