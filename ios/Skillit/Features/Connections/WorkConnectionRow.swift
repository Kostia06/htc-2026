import SkillitKit
import SwiftUI

/// One service in "Bring your work": what Skillit reads from it, Connect / Disconnect, and once connected what it took.
struct WorkConnectionRow: View {
    let connection: WorkConnection
    let isWorking: Bool
    let onConnect: () -> Void
    let onDisconnect: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                ServiceLogo(connection: connection)
                VStack(alignment: .leading, spacing: 2) {
                    Text(connection.name).font(.headline)
                    Text(statusLine).font(.footnote).foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                action
            }
            if connection.isConnected, !connection.projects.isEmpty {
                ImportedWorkList(projects: connection.projects, suggestions: connection.suggestions)
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder private var action: some View {
        if isWorking {
            ProgressView()
        } else if connection.isConnected || connection.status == .revoking {
            Button("Disconnect", role: .destructive, action: onDisconnect)
                .buttonStyle(.borderless)
                .accessibilityLabel("Disconnect \(connection.name)")
        } else if !connection.configured {
            Text("Coming soon").font(.footnote).foregroundStyle(.secondary)
        } else {
            Button("Connect", action: onConnect)
                .buttonStyle(.borderless)
                .fontWeight(.semibold)
                .accessibilityLabel("Connect \(connection.name)")
        }
    }

    private var statusLine: String {
        switch connection.status {
        case .connected where connection.importing: "Reading your work…"
        case .connected: connection.projects.isEmpty ? "Connected" : "\(connection.projects.count) added to your profile"
        case .pending: "Finish signing in on \(connection.name)"
        case .revoking: "Disconnecting didn't finish. Try again."
        case .notConnected: connection.reads
        }
    }
}

private struct ImportedWorkList: View {
    let projects: [WorkConnection.Project]
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
        .padding(.leading, 48)
    }
}

extension WorkConnection.Category {
    var symbol: String {
        switch self {
        case .code: "chevron.left.forwardslash.chevron.right"
        case .design: "paintpalette"
        case .writing: "doc.text"
        case .documents: "folder"
        case .video: "play.rectangle"
        case .other: "link"
        }
    }
}
