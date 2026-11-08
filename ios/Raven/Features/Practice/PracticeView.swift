import RavenKit
import SwiftUI

/// The Practice tab: start a spoken interview, or move to the headset.
struct PracticeView: View {
    @Environment(AppModel.self) private var app
    @State private var target = ""
    @AppStorage(PracticeDifficulty.storageKey) private var difficulty: PracticeDifficulty = .standard
    @State private var activeSession: VoiceSessionModel?
    @State private var isPairing = false
    @State private var isRecapping = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    TextField("Company or role (optional)", text: $target)
                        .textInputAutocapitalization(.words)
                        .submitLabel(.done)
                        .ravenCard()
                    DifficultyPicker(difficulty: $difficulty)
                        .padding(.bottom, 8)
                    interviewChoice
                    vrLink.padding(.top, 8)
                    row("Tell Raven about a real interview", systemImage: "bubble.left.and.text.bubble.right") { isRecapping = true }
                    NavigationLink { PracticeHistoryView() } label: { rowLabel("Past sessions", systemImage: "chart.line.uptrend.xyaxis") }
                        .buttonStyle(.plain)
                }
                .padding(24)
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Practice")
            .navigationDestination(isPresented: $isPairing) { PairHeadsetView() }
            .sheet(isPresented: $isRecapping) { RecapView(companySlug: nil, voice: ElevenLabsRecapVoice()) }
            .fullScreenCover(item: $activeSession) { session in
                VoiceSessionView(model: session, onPracticeAgain: { start(session.request) })
            }
        }
    }

    private var interviewChoice: some View {
        Button {
            start()
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
                    Text("Answer the questions a hiring manager would ask, out loud.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                }
            }
            .padding(.vertical, 12)
            .ravenCard()
        }
        .buttonStyle(.plain)
    }

    private var vrLink: some View {
        row("Practice in VR", systemImage: "visionpro") { isPairing = true }
    }

    private func row(_ title: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { rowLabel(title, systemImage: systemImage) }
            .buttonStyle(.plain)
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
        .ravenCard()
    }

    private func start() {
        let trimmed = target.trimmingCharacters(in: .whitespacesAndNewlines)
        start(VoiceSessionRequest(mode: .interview, role: trimmed.isEmpty ? nil : trimmed, difficulty: difficulty))
    }

    /// Also how "Practice again" works: a fresh model replaces the one on screen, so the cover stays up.
    private func start(_ request: VoiceSessionRequest) {
        guard let client = app.client else {
            // screenshots run without a signed-in client; they get the scripted session instead of the server
            activeSession = VoiceSessionModel(request: request, service: PreviewVoicePractice(), engine: PreviewVoiceEngine())
            return
        }
        activeSession = VoiceSessionModel(request: request, service: client, engine: ElevenLabsVoiceEngine())
    }
}
