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
                        node(Theme.action)
                        VStack(spacing: 28) {
                            ForEach(1 ..< 5, id: \.self) { index in
                                node(Color(white: 0.22))
                                    .offset(x: [0, 48, 72, 48, 0][index])
                            }
                        }
                        .shimmering()
                    }
                    .frame(maxWidth: .infinity)
                    Text("Raven is building your first steps from your profile.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                }
                .padding(24)
            }
        }
    }

    private func node(_ color: Color) -> some View {
        Circle()
            .fill(color)
            .overlay(Circle().strokeBorder(Theme.hairline, lineWidth: 1))
            .frame(width: 64, height: 64)
    }
}
