import AuthenticationServices
import SkillitKit
import SwiftUI

/// "Bring your work": a search field and every service Skillit can read work from, each one optional. Inside a List each
/// piece is its own row; inside a stack they simply stack. Used in onboarding and in Skills & experience.
struct BringYourWorkList: View {
    @Environment(AppModel.self) private var app
    @Environment(\.webAuthenticationSession) private var webAuthenticationSession
    @Bindable var model: WorkConnectionsModel
    /// after an import or a disconnect, so the profile on screen shows the projects that came or went
    var onChange: () async -> Void = {}

    var body: some View {
        Group {
            // the load and the alert hang off the one view that's always there: on a Group inside a List they'd repeat per row
            SearchField(text: $model.query)
                .task {
                    guard !model.isLoaded, let client = app.client else { return }
                    await model.load(using: client)
                }
                .alert("Couldn't connect", isPresented: hasError) {
                    Button("OK", role: .cancel) {}
                } message: {
                    Text(model.errorMessage ?? "")
                }
            if !model.isLoaded {
                ProgressView().frame(maxWidth: .infinity)
            }
            ForEach(model.visible) { connection in
                WorkConnectionRow(
                    connection: connection,
                    isWorking: model.workingOn == connection.id,
                    onConnect: { run { await model.connect(connection, using: $0, session: webAuthenticationSession) } },
                    onDisconnect: { run { await model.disconnect(connection, using: $0) } },
                )
            }
            if model.isLoaded, model.visible.isEmpty {
                Text("Nothing matches \u{201C}\(model.query)\u{201D}. Try code, design, writing or video.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Label("Read-only. Skillit never posts or changes anything.", systemImage: "lock")
                .font(.caption)
                .foregroundStyle(.secondary)
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

private struct SearchField: View {
    @Binding var text: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundStyle(.secondary).accessibilityHidden(true)
            TextField("Search, like design or video", text: $text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
            if !text.isEmpty {
                Button("Clear", systemImage: "xmark.circle.fill") { text = "" }
                    .labelStyle(.iconOnly)
                    .foregroundStyle(.secondary)
                    .buttonStyle(.borderless)
            }
        }
        .padding(.vertical, 6)
    }
}
