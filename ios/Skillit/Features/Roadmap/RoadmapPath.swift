import SkillitKit
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
                    ProgressCard(goal: page.goal, progress: trailProgress, fromResume: fromResume.count)
                        .padding(.horizontal, 20)
                    if !fromResume.isEmpty {
                        ResumeStepsCard(steps: fromResume) { selected = $0 }
                            .padding(.horizontal, 20)
                    }
                    if done.count > Self.recentDoneCount {
                        Button(showsAllDone ? "Hide earlier steps" : "Show \(done.count - Self.recentDoneCount) earlier steps") {
                            withAnimation(.snappy) { showsAllDone.toggle() }
                        }
                        .font(.subheadline.weight(.semibold))
                        .tint(.secondary)
                    }
                    // the rows are laid out from the measured width; drawing them at width 0 flashes every tile at the left edge
                    if width > 0 {
                        trail
                    }
                }
                .padding(.vertical, 16)
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
            }
            // keyed on the width too: the trail only exists once it is measured, so an earlier scroll finds nothing
            .task(id: width > 0 ? page.next.first?.id : nil) {
                guard width > 0, let current = page.next.first else { return }
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
        // "what did you do?" by text or voice; Skillit marks the step done itself and only asks if it must
        .sheet(item: $model.finishing) { step in
            QuickUpdateView(focus: step) { _ in
                Task { await model.load() }
            }
        }
    }

    private var trail: some View {
        LazyVStack(spacing: 0) {
            ForEach(stops.enumerated(), id: \.element.id) { index, step in
                PathRow(
                    width: width,
                    sway: sway(index),
                    previousSway: index == 0 ? nil : sway(index - 1),
                    nextSway: hasStop(after: index) ? sway(index + 1) : nil,
                ) {
                    PathNode(step: step, state: state(of: step), meta: StopLabel.meta(for: step, state: state(of: step))) {
                        selected = step
                    }
                } label: {
                    // the label is part of the stop too, so a tap on the words opens it as well; VoiceOver reads it on the tile
                    StopLabel(step: step, state: state(of: step))
                        .contentShape(.rect)
                        .onTapGesture { selected = step }
                        .accessibilityHidden(true)
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
        page.completed.reversed().flatMap { $0.steps.reversed() }.filter { !$0.isFromResume }
    }

    /// What the resume already showed: one summary card instead of a long run of done tiles.
    private var fromResume: [RoadmapStep] {
        page.completed.reversed().flatMap { $0.steps.reversed() }.filter(\.isFromResume)
    }

    private var stops: [RoadmapStep] {
        (showsAllDone ? done : Array(done.suffix(Self.recentDoneCount))) + page.next
    }

    /// The goal tile follows the last step once the whole road is loaded; a loading skeleton gets no trail.
    private func hasStop(after index: Int) -> Bool {
        index < stops.count - 1 || page.nextCursor == nil
    }

    /// The big count covers the trail only; resume steps sit in their own card and line.
    private var trailProgress: RoadmapProgress {
        var progress = page.progress
        progress.done = max(0, progress.done - fromResume.count)
        progress.total = max(progress.done, progress.total - fromResume.count)
        return progress
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
            Text(Self.meta(for: step, state: state))
                .font(.caption.weight(.semibold))
                .foregroundStyle(state == .current ? Theme.action : .secondary)
            Text(step.title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(state == .upcoming ? .secondary : .primary)
                .lineLimit(3)
                .minimumScaleFactor(0.85)
        }
    }

    /// "Done today", "Done yesterday", "Done Oct 3"; a bare weekday is ambiguous once a step is over a week old.
    static func meta(for step: RoadmapStep, state: PathNode.State) -> String {
        if state == .done, let stamp = step.completedAt, let date = try? Date(stamp, strategy: .iso8601) {
            let calendar = Calendar.current
            if calendar.isDateInToday(date) { return "Done today" }
            if calendar.isDateInYesterday(date) { return "Done yesterday" }
            return "Done \(date.formatted(.dateTime.month(.abbreviated).day()))"
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
