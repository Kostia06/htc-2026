import RavenKit
import SwiftUI

/// The Practice tab: pick a spoken interview or a networking chat, or move to the headset.
struct PracticeView: View {
    @Environment(AppModel.self) private var app
    @State private var target = ""
    @State private var activeSession: VoiceSessionModel?
    @State private var isPairing = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    TextField("Company or role (optional)", text: $target)
                        .textInputAutocapitalization(.words)
                        .submitLabel(.done)
                        .ravenCard()
                        .padding(.bottom, 8)
                    choice(
                        .interview, title: "Interview", systemImage: "person.fill.questionmark",
                        detail: "Answer the questions a hiring manager would ask, out loud.",
                    )
                    choice(
                        .networking, title: "Networking", systemImage: "person.2.fill",
                        detail: "Meet someone in the field and keep the conversation going.",
                    )
                    vrLink.padding(.top, 8)
                }
                .padding(24)
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Practice")
            .navigationDestination(isPresented: $isPairing) { PairHeadsetView() }
            .fullScreenCover(item: $activeSession) { session in
                VoiceSessionView(model: session, onPracticeAgain: { start(session.request) })
            }
        }
    }

    private func choice(_ mode: PracticeMode, title: String, systemImage: String, detail: String) -> some View {
        Button {
            start(mode)
        } label: {
            HStack(spacing: 16) {
                Image(systemName: systemImage)
                    .font(.title2)
                    .foregroundStyle(Theme.action)
                    .frame(width: 36)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.title2.bold())
                        .foregroundStyle(.primary)
                    Text(detail)
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
        Button {
            isPairing = true
        } label: {
            HStack {
                Label("Practice in VR", systemImage: "visionpro")
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .foregroundStyle(.primary)
            .ravenCard()
        }
        .buttonStyle(.plain)
    }

    private func start(_ mode: PracticeMode) {
        let trimmed = target.trimmingCharacters(in: .whitespacesAndNewlines)
        start(VoiceSessionRequest(mode: mode, role: trimmed.isEmpty ? nil : trimmed))
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
