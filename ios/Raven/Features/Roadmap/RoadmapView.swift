import RavenKit
import SwiftUI

/// The home screen: progress at the top and the winding path of steps below it.
struct RoadmapView: View {
    @Environment(AppModel.self) private var app
    @State private var model: RoadmapModel?
    @State private var practice: PracticeLaunch?
    @State private var lastPractice: PracticeLaunch?
    @State private var isUpdating = false

    var body: some View {
        NavigationStack {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.ground)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Update", systemImage: "plus.bubble") { isUpdating = true }
                            .labelStyle(.titleAndIcon)
                    }
                }
        }
        .sheet(isPresented: $isUpdating) {
            // anything Raven applied is on the server already; the roadmap just needs reading again
            QuickUpdateView(onApplied: { _ in Task { await model?.load() } })
        }
        .fullScreenCover(item: $practice, onDismiss: finishPractice) { launch in
            VoiceSessionView(model: launch.session, onPracticeAgain: { startPractice(launch.step) })
        }
        .task {
            guard model == nil else { return }
            let model = RoadmapModel(service: service)
            self.model = model
            await model.load()
        }
    }

    @ViewBuilder private var content: some View {
        switch model?.phase {
        case nil, .loading:
            RoadmapSkeleton()
        case let .failed(message):
            ContentUnavailableView {
                Label("Couldn't load your roadmap", systemImage: "point.topleft.down.to.point.bottomright.curvepath")
            } description: {
                Text(message)
            } actions: {
                Button("Try again") { Task { await model?.load() } }
                    .buttonStyle(.raised)
                    .frame(maxWidth: 220)
            }
        case let .ready(page):
            if let model {
                RoadmapPath(model: model, page: page, onStart: startPractice)
            }
        }
    }

    private func startPractice(_ step: RoadmapStep) {
        guard let action = step.action else { return }
        let request = VoiceSessionRequest(mode: .interview, companySlug: action.companySlug, role: action.role, difficulty: .preferred)
        let session = VoiceSessionModel(request: request, service: voiceService, engine: voiceEngine)
        let launch = PracticeLaunch(step: step, session: session)
        lastPractice = launch
        practice = launch
    }

    /// A session that reached its summary counts as the step done; one closed early leaves the step as it was.
    private func finishPractice() {
        guard let launch = lastPractice, case let .finished(debrief) = launch.session.phase else { return }
        lastPractice = nil
        withAnimation(.spring(duration: 0.5)) {
            model?.complete(launch.step, note: String("Scored \(debrief.overall)/100. \(debrief.verdict)".prefix(160)))
        }
    }

    private var service: any RoadmapService {
        if let client = app.client {
            return client
        }
        #if DEBUG
            return SampleRoadmap(goal: app.profile.targetRoles.first ?? "Junior data analyst")
        #else
            return UnavailableRoadmap()
        #endif
    }

    // without a signed-in client (previews) there is no server to start a real voice session
    private var voiceService: any VoicePracticeService {
        if let client = app.client {
            return client
        }
        return PreviewVoicePractice()
    }

    private var voiceEngine: any VoiceEngine {
        app.client == nil ? PreviewVoiceEngine() : ElevenLabsVoiceEngine()
    }
}

/// A practice session started from a step, kept together so the step can be marked done when the session ends.
struct PracticeLaunch: Identifiable {
    let step: RoadmapStep
    let session: VoiceSessionModel

    var id: String {
        step.id
    }
}
