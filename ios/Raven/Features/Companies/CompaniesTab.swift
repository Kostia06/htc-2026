import RavenKit
import SwiftUI

/// The Companies tab: the researched companies, and "Practice an interview here" opens a voice session for that company.
struct CompaniesTab: View {
    @Environment(AppModel.self) private var app
    @State private var session: VoiceSessionModel?

    var body: some View {
        CompaniesView(onPractice: practice)
            .fullScreenCover(item: $session) { session in
                VoiceSessionView(model: session, onPracticeAgain: { practice(session.request.companySlug ?? "") })
            }
    }

    private func practice(_ slug: String) {
        let request = VoiceSessionRequest(mode: .interview, companySlug: slug.isEmpty ? nil : slug)
        guard let client = app.client else {
            session = VoiceSessionModel(request: request, service: PreviewVoicePractice(), engine: PreviewVoiceEngine())
            return
        }
        session = VoiceSessionModel(request: request, service: client, engine: ElevenLabsVoiceEngine())
    }
}
