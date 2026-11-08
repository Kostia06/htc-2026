import SkillitKit
import SwiftUI

/// The Practice tab: how your last interview went, then pick what you're interviewing for and start talking.
struct PracticeView: View {
    @Environment(AppModel.self) private var app
    @State private var postings = PostingsModel()
    @State private var history: PracticeHistoryModel?
    @State private var isShowingHistory = false
    @State private var isPicking = false
    @State private var pending: VoiceSessionRequest?
    @State private var activeSession: VoiceSessionModel?
    @State private var openedPosting: JobPosting?
    @State private var isPairing = false
    @State private var isRecapping = false
    @State private var replaying: PracticeSessionSummary?
    @AppStorage(InterviewTargetPicker.lastChoiceKey) private var lastChoice: Data?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let history {
                        PracticeProgressCard(model: history) { isShowingHistory = true }
                    }
                    VStack(spacing: 10) {
                        quickInterview
                        interviewChoice
                        vrLink
                    }
                    // said before the call starts, so nobody is surprised that ElevenLabs keeps the audio
                    Label("Recorded so you can replay it", systemImage: "waveform")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 4)
                    if let history {
                        RecordingsSection(
                            sessions: history.sessions,
                            onOpen: { replaying = $0 },
                            onSeeAll: { isShowingHistory = true }
                        )
                    }
                    yourPostings
                    row("Tell Skillit about a real interview", systemImage: "bubble.left.and.text.bubble.right") { isRecapping = true }
                }
                .padding(24)
            }
            .navigationTitle("Practice")
            .navigationDestination(isPresented: $isPairing) { PairHeadsetView() }
            // a sheet, not a push: the history screen brings its own NavigationStack, and nesting it broke its links
            .sheet(isPresented: $isShowingHistory) {
                PracticeHistoryView().presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $isRecapping) { RecapView(companySlug: nil, voice: ElevenLabsRecapVoice()) }
            // the session starts once the picker is fully gone; iOS drops a cover presented while a sheet is closing
            .sheet(isPresented: $isPicking, onDismiss: startPending) {
                InterviewTargetPicker(postings: postings.postings) { pending = $0 }
            }
            .sheet(item: $openedPosting) { PostingView(posting: $0) }
            .sheet(item: $replaying) { session in
                NavigationStack { ReplayView(sessionId: session.id, service: app.replayService) }
                    .presentationDragIndicator(.visible)
            }
            .fullScreenCover(item: $activeSession) { session in
                VoiceSessionView(model: session, onPracticeAgain: { start(session.request) })
            }
            .task(id: app.updatesApplied) { await postings.load(using: app.client) }
            .task(id: activeSession == nil) {
                // reloads when a session closes, so the card shows the score just earned
                guard activeSession == nil else { return }
                let model = history ?? PracticeHistoryModel(service: app.practiceHistoryService)
                history = model
                await model.refresh()
            }
        }
    }

    /// One tap, no picker: the last target, else their first target role, else whatever the server picks.
    private var quickTarget: InterviewTarget? {
        lastChoice.flatMap { try? JSONDecoder().decode(InterviewTarget.self, from: $0) }
            ?? app.profile.targetRoles.first.map(InterviewTarget.role)
    }

    private var quickInterview: some View {
        Button {
            start(.quick(target: quickTarget, difficulty: .preferred))
        } label: {
            HStack(spacing: 16) {
                Image(systemName: "bolt.fill")
                    .font(.title2)
                    .foregroundStyle(Theme.onAction)
                    .frame(width: 36)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Quick interview · 1 min")
                        .font(.title3.bold())
                    Text(quickTarget.map { "Two questions for \($0.title)" } ?? "Two questions, no follow-ups")
                        .font(.subheadline)
                        .opacity(0.85)
                        .multilineTextAlignment(.leading)
                }
                .foregroundStyle(Theme.onAction)
                Spacer(minLength: 0)
            }
            .padding(.vertical, 12)
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.action, in: .rect(cornerRadius: 20))
        }
        .buttonStyle(RaisedSurfaceStyle(surface: Theme.action, outline: .card(cornerRadius: 20)))
        .accessibilityHint("Starts a one-minute voice interview right away")
    }

    private var interviewChoice: some View {
        Button {
            isPicking = true
        } label: {
            HStack(spacing: 16) {
                Image(systemName: "person.fill.questionmark")
                    .font(.title2)
                    .foregroundStyle(Theme.action)
                    .frame(width: 36)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Interview")
                        .font(.title2.bold())
                        .foregroundStyle(.primary)
                    Text("Pick a posting, role or company, then answer out loud.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                }
            }
            .padding(.vertical, 12)
            .skillitCard()
        }
        .buttonStyle(.raisedCard())
    }

    @ViewBuilder private var yourPostings: some View {
        if !postings.postings.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Your postings")
                    .font(.headline)
                    .padding(.top, 8)
                ForEach(postings.postings) { posting in
                    PostingCard(posting: posting) { openedPosting = posting }
                }
            }
            .animation(.spring(duration: 0.35), value: postings.postings)
        }
    }

    private var vrLink: some View {
        row("Or practise in VR", systemImage: "visionpro") { isPairing = true }
    }

    private func row(_ title: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { rowLabel(title, systemImage: systemImage) }
            .buttonStyle(.raisedCard())
    }

    private func rowLabel(_ title: String, systemImage: String) -> some View {
        HStack {
            Label(title, systemImage: systemImage)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .foregroundStyle(.primary)
        .skillitCard()
    }

    private func startPending() {
        guard let request = pending else { return }
        pending = nil
        start(request)
    }

    /// Also how "Practice again" works: a fresh model replaces the one on screen, so the cover stays up.
    private func start(_ request: VoiceSessionRequest) {
        activeSession = app.voiceSession(request)
    }
}
