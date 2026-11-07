import SwiftUI

/// The Duolingo-style path to the person's goal job. The server side of the roadmap isn't built yet, so this shows its skeleton.
struct RoadmapView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("On the way to")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text(app.profile.targetRoles.first ?? "your next role")
                            .font(.largeTitle.bold())
                    }
                    VStack(spacing: 28) {
                        ForEach(0 ..< 5, id: \.self) { index in
                            Circle()
                                .fill(index == 0 ? Theme.action : Color(white: 0.16))
                                .frame(width: 64, height: 64)
                                .offset(x: [0, 48, 72, 48, 0][index])
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .shimmering()
                    Text("Raven is building your first steps from your profile.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                }
                .padding(24)
            }
        }
    }
}
