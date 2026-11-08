import AuthenticationServices
import SkillitKit
import SwiftUI

/// "Connect GitHub" and, once connected, what Skillit took from it plus a way out. Used in Skills & experience and onboarding.
struct GithubConnectRow: View {
    @Environment(AppModel.self) private var app
    @Environment(\.webAuthenticationSession) private var webAuthenticationSession
    let model: GithubConnectModel
    /// after an import or a disconnect, so the profile on screen shows the projects that came or went
    var onChange: () async -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: "chevron.left.forwardslash.chevron.right")
                    .font(.title3)
                    .foregroundStyle(Theme.action)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text("GitHub").font(.headline)
                    Text(statusLine).font(.footnote).foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                action
            }
            if model.isConnected, !model.github.projects.isEmpty {
                GithubProjectsList(projects: model.github.projects, suggestions: model.github.suggestions)
            }
            Label("Read-only. Skillit never posts or changes anything.", systemImage: "lock")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
        .task {
            guard !model.isLoaded, let client = app.client else { return }
            await model.load(using: client)
        }
        .alert("GitHub", isPresented: hasError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(model.errorMessage ?? "")
        }
    }

    @ViewBuilder private var action: some View {
        if model.isWorking {
            ProgressView()
        } else if !model.github.configured {
            EmptyView()
        } else if model.isConnected || model.github.status == .revoking {
            Button("Disconnect", role: .destructive) { run { await model.disconnect(using: $0) } }
                .buttonStyle(.borderless)
        } else {
            Button("Connect") { run { await model.connect(using: $0, session: webAuthenticationSession) } }
                .buttonStyle(.borderless)
                .fontWeight(.semibold)
        }
    }

    private var statusLine: String {
        if !model.github.configured {
            return "Not available yet"
        }
        switch model.github.status {
        case .connected where model.github.importing: return "Reading your repos…"
        case .connected: return model.github.projects.isEmpty ? "Connected" : "\(model.github.projects.count) projects added"
        case .pending: return "Finish signing in on GitHub"
        case .revoking: return "Disconnecting didn't finish. Try again."
        case .notConnected: return "Add your public projects"
        }
    }

    private var hasError: Binding<Bool> {
        Binding(get: { model.errorMessage != nil }, set: { if !$0 { model.errorMessage = nil } })
    }

    private func run(_ work: @escaping (SkillitClient) async -> Void) {
        guard let client = app.client else { return }
        Task {
            await work(client)
            await onChange()
        }
    }
}

private struct GithubProjectsList: View {
    let projects: [GithubConnection.Project]
    let suggestions: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(projects) { project in
                VStack(alignment: .leading, spacing: 2) {
                    Text(project.name).font(.subheadline.weight(.semibold))
                    if let summary = project.summary {
                        Text(summary).font(.footnote).foregroundStyle(.secondary)
                    }
                }
            }
            ForEach(suggestions, id: \.self) { suggestion in
                Label(suggestion, systemImage: "lightbulb")
                    .font(.footnote)
                    .foregroundStyle(Theme.agent)
            }
        }
        .padding(.leading, 40)
    }
}
