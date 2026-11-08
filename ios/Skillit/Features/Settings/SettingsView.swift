import SwiftUI

/// Grouped, minimal: who you are, practice, your data, about. Sign out sits alone at the bottom.
struct SettingsView: View {
    @Environment(AppModel.self) private var app
    @State private var isConfirmingSignOut = false

    var body: some View {
        List {
            Section("Account") {
                LabeledContent("Signed in as", value: app.authenticator.accountLabel)
            }
            .listRowBackground(Theme.raised)
            Section {
                NavigationLink { PairHeadsetView() } label: {
                    Label("Pair a headset", systemImage: "visionpro")
                }
                LabeledContent {
                    Text("Eric")
                } label: {
                    Label("Interviewer voice", systemImage: "person.wave.2")
                }
            } header: {
                Text("Practice")
            } footer: {
                Text("The same interviewer on your phone and your headset.")
            }
            .listRowBackground(Theme.raised)
            Section("Privacy") {
                NavigationLink { MemoryView() } label: {
                    Label("What Skillit remembers", systemImage: "brain")
                }
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
                Text("Skillit uses AI to read your resume, build your road and run practice conversations. "
                    + "It can get things wrong; check anything before you rely on it.")
            }
            .listRowBackground(Theme.raised)
            Section {
                Button("Sign out", role: .destructive) { isConfirmingSignOut = true }
                    .frame(maxWidth: .infinity)
            }
            .listRowBackground(Theme.raised)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.ground)
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Sign out of Skillit?", isPresented: $isConfirmingSignOut, titleVisibility: .visible) {
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
