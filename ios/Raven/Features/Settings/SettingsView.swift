import SwiftUI

/// Grouped, minimal: the few things worth setting, and where the rest of the app's data lives.
struct SettingsView: View {
    @Environment(AppModel.self) private var app
    @State private var isConfirmingSignOut = false

    var body: some View {
        List {
            Section("Account") {
                LabeledContent("Signed in as", value: app.authenticator.accountLabel)
                Button("Sign out", role: .destructive) { isConfirmingSignOut = true }
            }
            .listRowBackground(Theme.raised)
            Section("Headset") {
                NavigationLink { PairHeadsetView() } label: {
                    Label("Pair a headset", systemImage: "visionpro")
                }
            }
            .listRowBackground(Theme.raised)
            Section {
                LabeledContent("Interviewer", value: "Eric")
            } header: {
                Text("Practice voice")
            } footer: {
                Text("The same voice on your phone and your headset.")
            }
            .listRowBackground(Theme.raised)
            Section("Privacy") {
                NavigationLink { PrivacyView() } label: {
                    Label("Your data", systemImage: "lock.shield")
                }
            }
            .listRowBackground(Theme.raised)
            Section {
                LabeledContent("Version", value: AppInfo.versionLabel)
            } header: {
                Text("About")
            } footer: {
                Text("Raven uses AI to read your resume, build your roadmap and run practice conversations. "
                    + "It can get things wrong; check anything before you rely on it.")
            }
            .listRowBackground(Theme.raised)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.ground)
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Sign out of Raven?", isPresented: $isConfirmingSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { Task { await app.signOut() } }
        } message: {
            Text("Your profile stays saved, and paired headsets stay signed in.")
        }
    }
}

enum AppInfo {
    static var versionLabel: String {
        let info = Bundle.main.infoDictionary ?? [:]
        let version = info["CFBundleShortVersionString"] as? String ?? "?"
        let build = info["CFBundleVersion"] as? String ?? "?"
        return "\(version) (\(build))"
    }
}
