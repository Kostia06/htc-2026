import SkillitKit
import SwiftUI

/// "I got the job": the end of a road. Sharing is on by default but explained, because it's what makes the
/// road better for the next person, and only step kinds and skills ever leave the phone.
struct GotTheJobSheet: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var role = ""
    @State private var companySlug: String?
    @State private var share = true
    @State private var phase = Phase.editing

    enum Phase: Equatable {
        case editing, saving, done(shared: Bool), failed(String)
    }

    var body: some View {
        NavigationStack {
            Group {
                if case let .done(shared) = phase {
                    celebration(shared: shared)
                } else {
                    form
                }
            }
            .background(Theme.ground)
            .navigationTitle("I got the job")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
        }
        .sensoryFeedback(.success, trigger: phase) { _, new in
            if case .done = new { true } else { false }
        }
        .onAppear { role = app.profile.targetRoles.first ?? "" }
    }

    private var form: some View {
        Form {
            Section("What role?") {
                TextField("Junior data analyst", text: $role)
                    .textInputAutocapitalization(.words)
            }
            if !app.companies.companies.isEmpty {
                Section("Where?") {
                    Picker("Company", selection: $companySlug) {
                        Text("Somewhere else").tag(String?.none)
                        ForEach(app.companies.companies) { company in
                            Text(company.name).tag(Optional(company.slug))
                        }
                    }
                }
            }
            Section {
                Toggle("Help the next person", isOn: $share)
            } footer: {
                Text("Shares the kinds of steps you took and your skills, never your words, names or dates. "
                    + "It only shows once three people share a similar road.")
            }
            if case let .failed(message) = phase {
                Text(message).foregroundStyle(Theme.negative)
            }
            Section {
                Button(phase == .saving ? "Saving…" : "Save", action: save)
                    .buttonStyle(.raised)
                    .disabled(role.trimmingCharacters(in: .whitespaces).isEmpty || phase == .saving)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
            }
        }
        .scrollContentBackground(.hidden)
    }

    private func celebration(shared: Bool) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "flag.checkered")
                .font(.system(size: 56))
                .foregroundStyle(Theme.positive)
            Text("Congratulations")
                .font(.largeTitle.bold())
            Text(shared
                ? "Your road is now part of the map. The next person aiming for \(role) gets a clearer path."
                : "Saved to your own notes. You can always share your road later.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Done") { dismiss() }
                .buttonStyle(.raised)
                .padding(.top, 8)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func save() {
        guard let client = app.client else { return }
        let outcome = GotTheJob(role: role.trimmingCharacters(in: .whitespaces), companySlug: companySlug, share: share)
        phase = .saving
        Task {
            do throws(SkillitError) {
                let result = try await client.recordOutcome(outcome)
                withAnimation(.spring(duration: 0.4)) { phase = .done(shared: result.shared) }
            } catch {
                phase = .failed(error.message)
            }
        }
    }
}
