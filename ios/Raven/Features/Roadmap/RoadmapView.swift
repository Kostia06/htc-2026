import RavenKit
import SwiftUI

/// The home screen: progress at the top, the next few steps as cards, what's done by day, and the rest of the path below.
struct RoadmapView: View {
    @Environment(AppModel.self) private var app
    @State private var model: RoadmapModel?
    @State private var practice: PracticeLaunch?
    @State private var lastPractice: PracticeLaunch?

    var body: some View {
        NavigationStack {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.ground)
        }
        .fullScreenCover(item: $practice, onDismiss: finishPractice) { VoiceSessionView(model: $0.session) }
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
                RoadmapList(model: model, page: page, onStart: startPractice)
            }
        }
    }

    private func startPractice(_ step: RoadmapStep) {
        guard let action = step.action else { return }
        let mode: PracticeMode = action.type == .interview ? .interview : .networking
        let request = VoiceSessionRequest(mode: mode, companySlug: action.companySlug, role: action.role)
        let session = VoiceSessionModel(request: request, service: voiceService, engine: LocalVoiceEngine())
        let launch = PracticeLaunch(step: step, session: session)
        lastPractice = launch
        practice = launch
    }

    /// A session that reached its summary counts as the step done; one closed early leaves the step as it was.
    private func finishPractice() {
        guard let launch = lastPractice, case let .finished(summary) = launch.session.phase else { return }
        lastPractice = nil
        withAnimation(.spring(duration: 0.5)) {
            model?.complete(launch.step, note: String(summary.summary.prefix(160)))
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

    /// screenshots run without a signed-in client; they get the offline session instead of the server
    private var voiceService: any VoicePracticeService {
        if let client = app.client {
            return client
        }
        return OfflineVoicePractice()
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

private struct RoadmapList: View {
    let model: RoadmapModel
    let page: RoadmapPage
    let onStart: (RoadmapStep) -> Void

    @Namespace private var steps
    @State private var position = ScrollPosition()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private static let upNextCount = 3
    private static let doneAnchor = "done"

    var body: some View {
        @Bindable var model = model
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 28) {
                ProgressCard(goal: page.goal, progress: page.progress)
                section("Up next") {
                    ForEach(page.next.prefix(Self.upNextCount)) { step in
                        StepCard(step: step, style: .full) { act(on: step) }
                            .matchedGeometryEffect(id: step.id, in: steps)
                            .transition(.scale(scale: 0.96).combined(with: .opacity))
                    }
                }
                if !page.completed.isEmpty {
                    CompletedSection(days: page.completed, namespace: steps)
                        .id(Self.doneAnchor)
                }
                if page.next.count > Self.upNextCount {
                    section("Later") {
                        ForEach(page.next.dropFirst(Self.upNextCount)) { step in
                            StepCard(step: step, style: .compact) { act(on: step) }
                                .matchedGeometryEffect(id: step.id, in: steps)
                                .transition(.scale(scale: 0.96).combined(with: .opacity))
                                .onAppear {
                                    if step.id == page.next.last?.id {
                                        Task { await model.loadMore() }
                                    }
                                }
                        }
                    }
                }
                if page.nextCursor != nil {
                    MoreStepsSkeleton(failed: model.loadMoreFailed) { Task { await model.loadMore() } }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
        }
        .scrollPosition($position)
        .refreshable { await model.load() }
        .sensoryFeedback(.success, trigger: page.progress.done) { old, new in new > old }
        .sheet(item: $model.finishing) { step in
            MarkDoneSheet(step: step) { note in
                withAnimation(animation) { model.complete(step, note: note) }
            }
        }
        #if DEBUG
        .task { applyDemo() }
        #endif
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.title3.bold())
            content()
        }
    }

    private func act(on step: RoadmapStep) {
        if step.isPractice {
            onStart(step)
        } else {
            model.finishing = step
        }
    }

    private var animation: Animation {
        reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.5)
    }

    #if DEBUG
        /// `-RavenRoadmapDemo sheet` opens the mark-done sheet for the first step; `done` scrolls to what's finished. For screenshots.
        private func applyDemo() {
            switch UserDefaults.standard.string(forKey: "RavenRoadmapDemo") {
            case "sheet": model.finishing = page.next.first { !$0.isPractice }
            case "done": position.scrollTo(id: Self.doneAnchor, anchor: .top)
            default: break
            }
        }
    #endif
}
