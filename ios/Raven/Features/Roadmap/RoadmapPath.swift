import RavenKit
import SwiftUI

/// The roadmap as one line to the goal job, like a transit map: what's done, where you are, what's next,
/// and the job at the end. Every stop carries its own card so the line explains itself. Tap a stop for details.
struct RoadmapPath: View {
    let model: RoadmapModel
    let page: RoadmapPage
    let onStart: (RoadmapStep) -> Void

    @State private var selected: RoadmapStep?
    /// Run after the detail sheet is fully gone; iOS drops a full-screen cover presented while a sheet is closing.
    @State private var afterDismiss: (() -> Void)?
    @State private var showsAllDone = false

    private static let recentDoneCount = 2

    var body: some View {
        @Bindable var model = model
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                ProgressCard(goal: page.goal, progress: page.progress)
                LazyVStack(alignment: .leading, spacing: 0) {
                    doneStops
                    if let current = page.next.first {
                        StopHeader(title: "You're here")
                        TimelineStop(step: current, state: .current, isFirst: done.isEmpty, onTap: { selected = current })
                    }
                    if page.next.count > 1 {
                        StopHeader(title: "Coming up")
                        ForEach(page.next.dropFirst()) { step in
                            TimelineStop(step: step, state: .upcoming) { selected = step }
                                .onAppear {
                                    if step.id == page.next.last?.id {
                                        Task { await model.loadMore() }
                                    }
                                }
                        }
                    }
                    if page.nextCursor != nil {
                        MoreStepsSkeleton(failed: model.loadMoreFailed) { Task { await model.loadMore() } }
                            .padding(.leading, TimelineStop.railWidth)
                            .padding(.vertical, 8)
                    } else {
                        GoalStop(goal: page.goal)
                    }
                }
            }
            .padding(.horizontal, 20)
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

    @ViewBuilder private var doneStops: some View {
        if !done.isEmpty {
            HStack {
                StopHeader(title: "Done")
                Spacer()
                if done.count > Self.recentDoneCount {
                    Button(showsAllDone ? "Show less" : "Show all \(done.count)") {
                        withAnimation(.snappy) { showsAllDone.toggle() }
                    }
                    .font(.subheadline.weight(.semibold))
                    .tint(Theme.action)
                }
            }
            ForEach(visibleDone.enumerated(), id: \.element.id) { index, step in
                TimelineStop(step: step, state: .done, isFirst: index == 0) { selected = step }
            }
        }
    }

    /// Oldest first, so the line reads top to bottom as the journey so far.
    private var done: [RoadmapStep] {
        page.completed.reversed().flatMap { $0.steps.reversed() }
    }

    private var visibleDone: [RoadmapStep] {
        showsAllDone ? done : Array(done.suffix(Self.recentDoneCount))
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

private struct StopHeader: View {
    let title: String

    var body: some View {
        Text(title.uppercased())
            .font(.caption.weight(.bold))
            .tracking(1.1)
            .foregroundStyle(.secondary)
            .padding(.leading, TimelineStop.railWidth)
            .padding(.top, 18)
            .padding(.bottom, 10)
    }
}

/// The end of the line: the job all of this is for.
private struct GoalStop: View {
    let goal: String

    var body: some View {
        HStack(alignment: .center, spacing: 0) {
            Image(systemName: "flag.checkered")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.onAction)
                .frame(width: 34, height: 34)
                .background(Theme.action, in: .circle)
                .frame(width: TimelineStop.railWidth, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text("Goal")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(goal)
                    .font(.headline)
            }
        }
        .padding(.top, 8)
        .accessibilityElement(children: .combine)
    }
}
