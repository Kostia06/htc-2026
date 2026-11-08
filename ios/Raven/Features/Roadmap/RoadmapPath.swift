import RavenKit
import SwiftUI

/// The Duolingo-style winding path: finished steps first, then the current one, then what's ahead.
/// Tapping any node opens its details in a bottom sheet.
struct RoadmapPath: View {
    let model: RoadmapModel
    let page: RoadmapPage
    let onStart: (RoadmapStep) -> Void

    @State private var selected: RoadmapStep?
    /// Run after the detail sheet is fully gone; iOS drops a full-screen cover presented while a sheet is closing.
    @State private var afterDismiss: (() -> Void)?

    var body: some View {
        @Bindable var model = model
        ScrollView {
            VStack(spacing: 28) {
                ProgressCard(goal: page.goal, progress: page.progress)
                    .padding(.horizontal, 20)
                LazyVStack(spacing: 22) {
                    ForEach(Array(path.enumerated()), id: \.element.id) { index, step in
                        PathNode(step: step, state: state(of: step)) { selected = step }
                            .offset(x: Self.sway(index))
                            .onAppear {
                                if step.id == page.next.last?.id {
                                    Task { await model.loadMore() }
                                }
                            }
                    }
                    if page.nextCursor != nil {
                        MoreStepsSkeleton(failed: model.loadMoreFailed) { Task { await model.loadMore() } }
                            .padding(.horizontal, 20)
                    }
                }
            }
            .padding(.vertical, 16)
        }
        .refreshable { await model.load() }
        .sensoryFeedback(.success, trigger: page.progress.done) { old, new in new > old }
        .sheet(item: $selected, onDismiss: runAfterDismiss) { step in
            StepDetailSheet(
                step: step,
                onPractice: { close { onStart(step) } },
                onMarkDone: { close { model.finishing = step } },
            )
        }
        .sheet(item: $model.finishing) { step in
            MarkDoneSheet(step: step) { note in
                withAnimation(.spring(duration: 0.5)) { model.complete(step, note: note) }
            }
        }
    }

    private func close(then action: @escaping () -> Void) {
        afterDismiss = action
        selected = nil
    }

    private func runAfterDismiss() {
        afterDismiss?()
        afterDismiss = nil
    }

    /// Oldest finished step at the top, so the path reads as a journey down to what's next.
    private var path: [RoadmapStep] {
        page.completed.reversed().flatMap { $0.steps.reversed() } + page.next
    }

    private func state(of step: RoadmapStep) -> PathNode.State {
        if step.status == .done { return .done }
        return step.id == page.next.first?.id ? .current : .upcoming
    }

    private static func sway(_ index: Int) -> CGFloat {
        sin(Double(index) * 0.9) * 80
    }
}
