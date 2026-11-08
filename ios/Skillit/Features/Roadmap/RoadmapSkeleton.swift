import SwiftUI

/// Stands in for the whole screen on first load: the progress card and the first few tiles of the trail.
struct RoadmapSkeleton: View {
    @State private var width: CGFloat = 0

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                SkeletonLines(widths: [0.5, 0.35, 0.9], highlighted: 1)
                    .skillitCard()
                    .padding(.horizontal, 20)
                VStack(spacing: 0) {
                    ForEach(0 ..< 4, id: \.self) { index in
                        PathRow(width: width, sway: sway(index), previousSway: index == 0 ? nil : sway(index - 1)) {
                            RoundedRectangle(cornerRadius: 22)
                                .fill(Theme.secondaryButton)
                                .frame(width: PathNode.size, height: PathNode.size)
                                .shimmering()
                        } label: {
                            SkeletonLines(widths: [0.2, 0.3], highlighted: -1)
                        }
                    }
                }
            }
            .padding(.vertical, 16)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        }
        .scrollDisabled(true)
        .accessibilityElement()
        .accessibilityLabel("Loading your road")
    }

    /// Same swing as the real trail, so the screen doesn't jump when the steps arrive.
    private func sway(_ index: Int) -> CGFloat {
        sin(Double(index) * 0.9) * width * 0.18
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
                    .buttonStyle(.raised(Theme.secondaryButton))
            }
            .skillitCard()
        } else {
            SkeletonLines(widths: [0.6, 0.4], highlighted: -1).skillitCard()
        }
    }
}
