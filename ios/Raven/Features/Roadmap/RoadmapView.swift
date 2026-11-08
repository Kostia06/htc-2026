import RavenKit
import SwiftUI

/// The home screen: a calm summary of progress, then the Duolingo-style path to the goal job, loading more as you scroll.
struct RoadmapView: View {
    @Environment(AppModel.self) private var app
    @State private var model: RoadmapModel?

    var body: some View {
        NavigationStack {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.ground)
        }
        .task {
            guard model == nil else { return }
            let model = RoadmapModel(service: service)
            self.model = model
            await model.loadFirstPage()
        }
    }

    @ViewBuilder private var content: some View {
        switch model?.phase {
        case nil, .loading:
            RoadmapLoadingView()
        case let .failed(message):
            ContentUnavailableView {
                Label("Couldn't load your roadmap", systemImage: "point.topleft.down.to.point.bottomright.curvepath")
            } description: {
                Text(message)
            } actions: {
                Button("Try again") { Task { await model?.loadFirstPage() } }
                    .buttonStyle(.raised)
                    .frame(maxWidth: 220)
            }
        case let .ready(page):
            if let model {
                RoadmapPath(model: model, page: page)
            }
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
}

private struct RoadmapPath: View {
    let model: RoadmapModel
    let page: RoadmapPage
    @State private var position = ScrollPosition()

    var body: some View {
        @Bindable var model = model
        ScrollView {
            LazyVStack(spacing: 40) {
                RoadmapSummaryHeader(page: page)
                ForEach(page.units) { unit in
                    UnitSection(unit: unit, currentStepID: page.currentStepID, selectedStepID: $model.selectedStepID) { step, status in
                        change(step, to: status)
                    }
                    .id(unit.index)
                    .onAppear {
                        if unit.id == page.units.last?.id {
                            Task { await model.loadMore() }
                        }
                    }
                }
                if page.nextCursor != nil {
                    PathSkeleton(failed: model.loadMoreFailed) { Task { await model.loadMore() } }
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 16)
        }
        .scrollPosition($position)
        .sensoryFeedback(.selection, trigger: model.selectedStepID)
        .onChange(of: model.selectedStepID) { _, selected in
            guard let selected else { return }
            Task {
                // once the card is in, lift its node to the top so the card isn't hidden under the tab bar
                try? await Task.sleep(for: .milliseconds(80))
                withAnimation(.spring(duration: 0.45)) { position.scrollTo(id: selected, anchor: .top) }
            }
        }
        .sensoryFeedback(trigger: page.summary.done) { old, new in new > old ? .success : nil }
        #if DEBUG
            .task { applyDemo() }
        #endif
    }

    private func change(_ step: RoadmapStep, to status: RoadmapStep.Status) {
        withAnimation(.spring(duration: 0.35)) {
            if status == .done {
                model.selectedStepID = nil
            }
        }
        Task { await model.setStatus(status, of: step.id) }
    }

    #if DEBUG
        /// `-RavenRoadmapDemo card` opens the current step's card, `scrolled` jumps down the path, for screenshots.
        private func applyDemo() {
            switch UserDefaults.standard.string(forKey: "RavenRoadmapDemo") {
            case "card": model.selectedStepID = page.currentStepID
            case "scrolled": position.scrollTo(id: 2, anchor: .top)
            default: break
            }
        }
    #endif
}
