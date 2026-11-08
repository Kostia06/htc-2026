import SkillitKit
import SwiftUI

/// The company a sheet should open; a slug alone cannot drive `.sheet(item:)`.
struct CompanyLink: Identifiable {
    let slug: String

    var id: String {
        slug
    }
}

/// A company page presented from wherever its name appears: a job card, a roadmap step, a posting.
/// "Practice an interview" on it starts a spoken session for that company over the sheet.
struct CompanySheet: View {
    @Environment(AppModel.self) private var app
    @State private var session: VoiceSessionModel?

    let slug: String

    var body: some View {
        NavigationStack {
            CompanyView(slug: slug, onPractice: practice)
        }
        .presentationBackground(Theme.ground)
        .fullScreenCover(item: $session) { session in
            VoiceSessionView(model: session, onPracticeAgain: { practice(slug) })
        }
    }

    private func practice(_ slug: String) {
        let request = VoiceSessionRequest(mode: .interview, companySlug: slug, difficulty: .preferred)
        session = app.voiceSession(request)
    }
}

extension AppModel {
    /// A session against the server, or a scripted one when nobody is signed in (previews and screenshots).
    func voiceSession(_ request: VoiceSessionRequest) -> VoiceSessionModel {
        guard let client else {
            return VoiceSessionModel(request: request, service: PreviewVoicePractice(), engine: PreviewVoiceEngine())
        }
        return VoiceSessionModel(request: request, service: client, engine: ElevenLabsVoiceEngine())
    }
}
