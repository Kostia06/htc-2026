import SwiftUI

/// What the server keeps, in plain words, and the one button that removes all of it.
struct PrivacyView: View {
    @Environment(AppModel.self) private var app
    @State private var isConfirming = false
    @State private var isDeleting = false
    @State private var failure: String?

    var body: some View {
        List {
            Section("What Skillit keeps") {
                StoredRow(
                    icon: "lock.doc",
                    title: "Profile",
                    detail: "Encrypted with a key tied to your account; only you can read it.",
                )
                StoredRow(
                    icon: "doc.text",
                    title: "Resume text",
                    detail: "Deleted an hour after upload. Only what you confirm stays, in your profile.",
                )
                StoredRow(icon: "waveform", title: "Practice sessions", detail: "Transcripts and scores, encrypted the same way.")
                StoredRow(
                    icon: "point.topleft.down.to.point.bottomright.curvepath",
                    title: "Roadmap and feed",
                    detail: "Built from your profile; rebuilt when it changes.",
                )
            }
            .listRowBackground(Theme.raised)
            Section {
                NavigationLink { MemoryView() } label: {
                    Label("What Skillit remembers about you", systemImage: "brain")
                }
            } footer: {
                Text("See, delete or anonymously share the notes Skillit keeps to personalise your practice.")
            }
            .listRowBackground(Theme.raised)
            Section {
                Button(role: .destructive) { isConfirming = true } label: {
                    HStack {
                        Text("Delete my data")
                        Spacer()
                        if isDeleting { ProgressView().tint(.secondary) }
                    }
                }
                .disabled(isDeleting)
            } footer: {
                Text("Removes your profile, memories, roadmap, feed and practice sessions from Skillit's servers, "
                    + "then signs you out. This can't be undone.")
            }
            .listRowBackground(Theme.raised)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.ground)
        .navigationTitle("Your data")
        .navigationBarTitleDisplayMode(.inline)
        .animation(.easeOut(duration: 0.2), value: isDeleting)
        .confirmationDialog("Delete everything Skillit knows about you?", isPresented: $isConfirming, titleVisibility: .visible) {
            Button("Delete my data", role: .destructive) { Task { await deleteEverything() } }
        } message: {
            Text("Your profile, memories, roadmap, feed and practice sessions are removed for good, and you're signed out.")
        }
        .alert("Couldn't delete your data", isPresented: hasFailure) {
            Button("OK") { failure = nil }
        } message: {
            Text(failure ?? "")
        }
    }

    private var hasFailure: Binding<Bool> {
        Binding(get: { failure != nil }, set: { if !$0 { failure = nil } })
    }

    private func deleteEverything() async {
        guard let client = app.client else {
            await app.signOut()
            return
        }
        isDeleting = true
        defer { isDeleting = false }
        do {
            try await client.eraseMyData()
            await app.signOut()
        } catch {
            failure = error.message
        }
    }
}

private struct StoredRow: View {
    let icon: String
    let title: String
    let detail: String

    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(detail).font(.subheadline).foregroundStyle(.secondary)
            }
        } icon: {
            Image(systemName: icon).foregroundStyle(Theme.agent)
        }
        .padding(.vertical, 2)
    }
}
