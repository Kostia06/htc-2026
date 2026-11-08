import SwiftUI

/// "Connected apps": the "Bring your work" list on its own screen, behind a Profile door and the plus menu's Connect.
struct ConnectedAppsView: View {
    @Environment(AppModel.self) private var app
    @State private var work = WorkConnectionsModel()
    @State private var others = OtherAppsModel()

    var body: some View {
        List {
            Section {
                BringYourWorkList(model: work) { await app.noteWorkChanged() }
            } footer: {
                Text(
                    "Each one is optional. Skillit adds your projects and their main languages; "
                        + "disconnecting removes only what that service added.",
                )
            }
            .listRowBackground(Theme.raised)
            Section {
                OtherAppsSection(model: others)
            } header: {
                Text("More apps")
            } footer: {
                Text(
                    "Connected through Composio. Nothing is imported; Skillit's assistant can only look things up in them, "
                        + "and never posts or changes anything. Disconnecting revokes access.",
                )
            }
            .listRowBackground(Theme.raised)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.ground)
        .navigationTitle("Connected apps")
        .navigationBarTitleDisplayMode(.inline)
    }
}
