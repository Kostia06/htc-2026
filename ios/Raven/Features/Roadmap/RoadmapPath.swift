import RavenKit
import SwiftUI

/// The roadmap as a winding trail of tiles: what's done, where you are, what's next, and the goal job at the end.
/// Each tile is labelled beside it and joined to the next by a dotted trail. Tap a tile for its details.
struct RoadmapPath: View {
    let model: RoadmapModel
    let page: RoadmapPage
    let onStart: (RoadmapStep) -> Void

    @State private var selected: RoadmapStep?
    /// Run after the detail sheet is fully gone; iOS drops a full-screen cover presented while a sheet is closing.
    @State private var afterDismiss: (() -> Void)?
    @State private var showsAllDone = false
    @State private var width: CGFloat = 0

    private static let recentDoneCount = 3

    var body: some View {
        @Bindable var model = model
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 20) {
                    ProgressCard(goal: page.goal, progress: page.progress)
                        .padding(.horizontal, 20)
                    if done.count > Self.recentDoneCount {
                        Button(showsAllDone ? "Hide earlier steps" : "Show \(done.count - Self.recentDoneCount) earlier steps") {
                            withAnimation(.snappy) { showsAllDone.toggle() }
                        }
                        .font(.subheadline.weight(.semibold))
                        .tint(.secondary)
                    }
                    trail
                }
                .padding(.vertical, 16)
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
            }
            .task(id: page.next.first?.id) {
                guard let current = page.next.first else { return }
                proxy.scrollTo(current.id, anchor: .center)
            }
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

    private var trail: some View {
        LazyVStack(spacing: 0) {
            ForEach(stops.enumerated(), id: \.element.id) { index, step in
                PathRow(width: width, sway: sway(index), previousSway: index == 0 ? nil : sway(index - 1)) {
                    PathNode(step: step, state: state(of: step)) { selected = step }
                } label: {
                    StopLabel(step: step, state: state(of: step))
                }
                .id(step.id)
                .onAppear {
                    if step.id == page.next.last?.id {
                        Task { await model.loadMore() }
                    }
                }
            }
            if page.nextCursor != nil {
                MoreStepsSkeleton(failed: model.loadMoreFailed) { Task { await model.loadMore() } }
                    .padding(.horizontal, 20)
                    .padding(.top, 12)
            } else {
                PathRow(width: width, sway: sway(stops.count), previousSway: stops.isEmpty ? nil : sway(stops.count - 1)) {
                    GoalTile()
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Goal").font(.caption.weight(.semibold)).foregroundStyle(Theme.agent)
                        Text(page.goal).font(.subheadline.weight(.semibold)).lineLimit(2)
                    }
                }
            }
        }
    }

    /// Oldest finished step first, so the trail reads top to bottom as the journey so far.
    private var done: [RoadmapStep] {
        page.completed.reversed().flatMap { $0.steps.reversed() }
    }

    private var stops: [RoadmapStep] {
        (showsAllDone ? done : Array(done.suffix(Self.recentDoneCount))) + page.next
    }

    private func state(of step: RoadmapStep) -> PathNode.State {
        if step.status == .done { return .done }
        return step.id == page.next.first?.id ? .current : .upcoming
    }

    private func sway(_ index: Int) -> CGFloat {
        sin(Double(index) * 0.9) * width * 0.18
    }

    private func close(then action: @escaping () -> Void) {
        afterDismiss = action
        selected = nil
    }

    private func runAfterDismiss() {
        afterDismiss?()
        afterDismiss = nil
    }
}

/// What a tile is, written beside it so the trail explains itself without tapping.
private struct StopLabel: View {
    let step: RoadmapStep
    let state: PathNode.State

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(meta)
                .font(.caption.weight(.semibold))
                .foregroundStyle(state == .current ? Theme.action : .secondary)
            Text(step.title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(state == .upcoming ? .secondary : .primary)
                .lineLimit(2)
        }
    }

    private var meta: String {
        if state == .done, let stamp = step.completedAt, let date = try? Date(stamp, strategy: .iso8601) {
            return "Done \(date.formatted(.dateTime.weekday(.abbreviated)))"
        }
        return step.estimate.isEmpty ? step.kind.name : "\(step.kind.name) · \(step.estimate)"
    }
}

private struct GoalTile: View {
    var body: some View {
        Image(systemName: "flag.checkered")
            .font(.system(size: 24, weight: .bold))
            .foregroundStyle(Theme.onAction)
            .frame(width: PathNode.size, height: PathNode.size)
            .background(Theme.agent, in: .rect(cornerRadius: 22))
            .padding(.bottom, 6)
            .accessibilityLabel("Goal")
    }
}
