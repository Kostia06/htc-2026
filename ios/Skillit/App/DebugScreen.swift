#if DEBUG
    import SkillitKit
    import SwiftUI

    /// Opens one screen with sample data: launch with `-SkillitScreen onboarding` (Debug builds only), for screenshots and design review.
    enum DebugScreen: String {
        case signIn, onboarding, roadmap, forYou, forYouBuilding, practice, voice, summary, profile, pairHeadset, startPractice, notifications

        static var requested: DebugScreen? {
            UserDefaults.standard.string(forKey: "RavenScreen").flatMap(DebugScreen.init(rawValue:))
        }

        @ViewBuilder var view: some View {
            switch self {
            case .signIn:
                SignInView().environment(AppModel.preview(profile: .empty, phase: .signedOut))
            case .onboarding:
                OnboardingFlow(model: .debugPreview()).environment(AppModel.preview(profile: .empty))
            case .roadmap: tabs(.roadmap)
            case .forYou: forYou(.preview(cards: FeedCard.samples))
            case .forYouBuilding: forYou(.preview(cards: [], isBuilding: true))
            case .practice: tabs(.practice)
            case .voice: DebugVoiceSession()
            case .summary: SessionSummaryView(debrief: .sample, onPracticeAgain: {}, onDone: {})
            case .profile: tabs(.profile)
            case .pairHeadset:
                NavigationStack { PairHeadsetView(issuer: DemoHeadsetIssuer(), link: DemoHeadsetLink()) }
                    .environment(AppModel.preview(profile: .sample))
            case .startPractice:
                DebugStartPractice().environment(AppModel.preview(profile: .sample))
            case .notifications:
                NotificationCenterView(model: .preview(SkillitNotification.samples)).environment(AppModel.preview(profile: .sample))
            }
        }

        private func tabs(_ section: MainTabView.Section) -> some View {
            MainTabView(selection: section).environment(AppModel.preview(profile: .sample))
        }

        private func forYou(_ feed: ForYouModel) -> some View {
            let app = AppModel.preview(profile: .sample)
            app.feed = feed
            return MainTabView(selection: .forYou).environment(app)
        }

    }

    /// The Start button in each of its states, inside sample step cards like the roadmap's.
    private struct DebugStartPractice: View {
        var body: some View {
            ScrollView {
                VStack(spacing: 20) {
                    card("Compact", button: StartPracticeButton(companySlug: "atb", link: DemoHeadsetLink()) {})
                    card("Sent", button: StartPracticeButton(link: DemoHeadsetLink(), initialPhase: .sent) {})
                    card(
                        "Open · Quest connected",
                        button: StartPracticeButton(companySlug: "atb", link: DemoHeadsetLink(), initialPhase: .expanded) {},
                    )
                    card(
                        "Open · no headset listening",
                        button: StartPracticeButton(
                            companySlug: "atb", link: DemoHeadsetLink(isConnected: false), initialPhase: .expanded,
                        ) {},
                    )
                }
                .padding(24)
            }
            .background(Theme.ground)
        }

        private func card(_ state: String, button: StartPracticeButton) -> some View {
            VStack(alignment: .leading, spacing: 12) {
                Text("Mock interview with ATB")
                    .font(.headline)
                Text(state)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                HStack { button }
            }
            .skillitCard()
        }
    }

    /// Holds its model in state so a re-render doesn't start a second session.
    private struct DebugVoiceSession: View {
        @State private var model = VoiceSessionModel(
            request: VoiceSessionRequest(mode: .interview),
            service: PreviewVoicePractice(
                questions: [PracticeQuestion(text: "Why do you want to work on our lending team?", source: .reported)],
                company: "ATB Financial",
            ),
            engine: PreviewVoiceEngine(),
        )

        var body: some View {
            VoiceSessionView(model: model, onPracticeAgain: {})
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
