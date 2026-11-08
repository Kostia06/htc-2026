import SwiftUI

/// Stands in for the whole screen on first load: the shape of the progress card and three step cards.
struct RoadmapSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                SkeletonLines(widths: [0.5, 0.35, 0.9], highlighted: 1).ravenCard()
                VStack(alignment: .leading, spacing: 12) {
                    Capsule()
                        .fill(Color(white: 0.2))
                        .frame(width: 90, height: 14)
                        .shimmering()
                    ForEach(0 ..< 3, id: \.self) { index in
                        SkeletonLines(widths: [0.7, 0.4, 0.9, 0.6], highlighted: index == 0 ? 2 : -1).ravenCard()
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
        }
        .scrollDisabled(true)
    }
}

/// The tail of the list while the next page loads, or a retry when it didn't.
struct MoreStepsSkeleton: View {
    let failed: Bool
    let retry: () -> Void

    var body: some View {
        if failed {
            VStack(spacing: 12) {
                Text("Couldn't load more steps")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Button("Try again", action: retry)
                    .buttonStyle(.raised(Color(white: 0.22)))
            }
            .ravenCard()
        } else {
            SkeletonLines(widths: [0.6, 0.4], highlighted: -1).ravenCard()
        }
    }
}
