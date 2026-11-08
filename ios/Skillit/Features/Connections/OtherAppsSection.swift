import AuthenticationServices
import SkillitKit
import SwiftUI

/// "More apps": a search of Composio's whole catalog and the person's other connected apps, each its own List row.
struct OtherAppsSection: View {
    @Environment(AppModel.self) private var app
    @Environment(\.webAuthenticationSession) private var webAuthenticationSession
    @Bindable var model: OtherAppsModel

    var body: some View {
        Group {
            SearchField(text: $model.query, prompt: "Search 1,700 apps, like Slack or Figma")
                .task {
                    guard let client = app.client else { return }
                    await model.load(using: client)
                }
                .task(id: model.query) {
                    guard let client = app.client else { return }
                    await model.search(using: client)
                }
                .alert("Couldn't connect", isPresented: hasError) {
                    Button("OK", role: .cancel) {}
                } message: {
                    Text(model.errorMessage ?? "")
                }
            ForEach(model.rows) { other in
                OtherAppRow(
                    app: other,
                    isWorking: model.workingOn == other.slug,
                    onConnect: { run { await model.connect(other, using: $0, session: webAuthenticationSession) } },
                    onDisconnect: { run { await model.disconnect(other, using: $0) } },
                )
            }
            if model.hasMore {
                if model.workingOn == "more" {
                    ProgressView().frame(maxWidth: .infinity)
                } else {
                    Button("Show more") { run { await model.loadMore(using: $0) } }
                }
            }
            if model.rows.isEmpty {
                Text(emptyText).font(.footnote).foregroundStyle(.secondary)
            }
        }
    }

    private var emptyText: String {
        model.isSearching
            ? "No app called \u{201C}\(model.query.trimmingCharacters(in: .whitespaces))\u{201D} yet."
            : "Connect anything else you work in. Skillit's assistant can look things up in them, read-only."
    }

    private var hasError: Binding<Bool> {
        Binding(get: { model.errorMessage != nil }, set: { if !$0 { model.errorMessage = nil } })
    }

    private func run(_ work: @escaping (SkillitClient) async -> Void) {
        guard let client = app.client else { return }
        Task { await work(client) }
    }
}

private struct OtherAppRow: View {
    let app: ConnectedApp
    let isWorking: Bool
    let onConnect: () -> Void
    let onDisconnect: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            AppLogo(url: app.logo)
            VStack(alignment: .leading, spacing: 2) {
                Text(app.name).font(.headline)
                Text(statusLine).font(.footnote).foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            action
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder private var action: some View {
        if isWorking {
            ProgressView()
        } else if app.isLinked {
            Button("Disconnect", role: .destructive, action: onDisconnect)
                .buttonStyle(.borderless)
                .accessibilityLabel("Disconnect \(app.name)")
        } else if !app.connectable {
            Text("Not yet").font(.footnote).foregroundStyle(.secondary)
        } else {
            Button("Connect", action: onConnect)
                .buttonStyle(.borderless)
                .fontWeight(.semibold)
                .accessibilityLabel("Connect \(app.name)")
        }
    }

    private var statusLine: String {
        switch app.status {
        case .connected: "Connected · nothing imported yet"
        case .pending: "Finish signing in on \(app.name)"
        case .revoking: "Disconnecting didn't finish. Try again."
        case .notConnected where !app.connectable: "Skillit can't connect this one yet"
        case .notConnected: app.category?.capitalized ?? "Connect to keep it with your work"
        }
    }
}

/// The catalog's logo on a white tile, since they come in any colour; a link glyph while it loads or if it can't.
private struct AppLogo: View {
    let url: URL?

    var body: some View {
        RoundedRectangle(cornerRadius: 9, style: .continuous)
            .fill(url == nil ? Color(.tertiarySystemFill) : .white)
            .overlay {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFit().padding(6)
                } placeholder: {
                    Image(systemName: "link").foregroundStyle(.secondary)
                }
            }
            .frame(width: 36, height: 36)
            .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            .accessibilityHidden(true)
    }
}
