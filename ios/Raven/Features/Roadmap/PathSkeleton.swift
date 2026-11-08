import SwiftUI

/// Grey nodes on the path's curve while Raven plans the next unit; the purple one says the agent is at work.
struct PathSkeleton: View {
    var count = 3
    var failed = false
    var retry: () -> Void = {}

    var body: some View {
        VStack(spacing: 22) {
            if failed {
                Button("Try loading more", action: retry)
                    .buttonStyle(.raised(Color(white: 0.22)))
                    .padding(.horizontal, 48)
            } else {
                Label("Raven is planning your next steps", systemImage: "sparkles")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.agent)
                VStack(spacing: 30) {
                    ForEach(0 ..< count, id: \.self) { position in
                        Circle()
                            .fill(position == 1 ? Theme.agent.opacity(0.45) : Color(white: 0.16))
                            .frame(width: 72, height: 72)
                            .offset(x: PathCurve.offset(at: position + 1))
                    }
                }
                .shimmering()
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .accessibilityElement(children: failed ? .contain : .ignore)
        .accessibilityLabel(failed ? "" : "Loading more steps")
    }
}

/// The whole screen before the first page arrives.
struct RoadmapLoadingView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 32) {
                SkeletonLines(widths: [0.5, 0.35, 0.95], highlighted: -1)
                SkeletonLines(widths: [0.9, 0.9], highlighted: -1)
                PathSkeleton(count: 4)
            }
            .padding(24)
        }
        .scrollDisabled(true)
    }
}
