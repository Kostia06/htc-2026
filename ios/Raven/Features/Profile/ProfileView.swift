import RavenKit
import SwiftUI

struct ProfileView: View {
    @Environment(AppModel.self) private var app
    @State private var isRefreshing = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(app.profile.targetRoles.first ?? "No target role yet")
                            .font(.title2.bold())
                        if let headline = app.profile.headline {
                            Text(headline).foregroundStyle(.secondary)
                        }
                    }
                    .redacted(reason: isRefreshing ? .placeholder : [])
                }
                Section("Skills") {
                    if app.profile.skills.isEmpty {
                        Text("Add skills from your resume or as you finish steps.").foregroundStyle(.secondary)
                    }
                    ForEach(app.profile.skills, id: \.self) { skill in
                        LabeledContent(skill.name, value: skill.source == .resume ? "From your resume" : "You added this")
                    }
                }
                .redacted(reason: isRefreshing ? .placeholder : [])
                Section("Experience") {
                    ForEach(app.profile.experience, id: \.self) { LabeledContent($0.role, value: $0.org) }
                }
            }
            .scrollContentBackground(.hidden)
            .navigationTitle("Profile")
            .refreshable { await refresh() }
        }
    }

    private func refresh() async {
        guard let client = app.client else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        if let profile = try? await client.profile() {
            app.profile = profile
        }
    }
}
