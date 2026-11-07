import SwiftUI

/// Suggestions the agent finds for this person: events, hackathons, courses, projects. Filled once the notification center ships.
struct ForYouView: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(0 ..< 3, id: \.self) { _ in
                        SkeletonLines(widths: [0.5, 0.9, 0.7], highlighted: 0).ravenCard()
                    }
                }
                .padding(24)
            }
            .navigationTitle("For you")
        }
    }
}
