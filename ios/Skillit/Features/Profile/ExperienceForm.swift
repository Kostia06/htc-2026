import SkillitKit
import SwiftUI

/// Add or edit one job. The same sheet does both: `editing` is nil for a new row.
struct ExperienceForm: View {
    let editing: Profile.Experience?
    let onSave: (Profile.Experience) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var role: String
    @State private var org: String
    @State private var start: String
    @State private var end: String

    init(editing: Profile.Experience?, onSave: @escaping (Profile.Experience) -> Void) {
        self.editing = editing
        self.onSave = onSave
        _role = State(initialValue: editing?.role ?? "")
        _org = State(initialValue: editing?.org ?? "")
        _start = State(initialValue: editing?.start ?? "")
        _end = State(initialValue: editing?.end ?? "")
    }

    private var canSave: Bool {
        !role.trimmingCharacters(in: .whitespaces).isEmpty && !org.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Role", text: $role)
                    TextField("Company or team", text: $org)
                }
                Section("When") {
                    TextField("Started, like May 2026", text: $start)
                    TextField("Ended, or leave blank", text: $end)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.ground)
            .navigationTitle(editing == nil ? "Add experience" : "Edit experience")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", action: save).disabled(!canSave).tint(Theme.action)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func save() {
        onSave(Profile.Experience(role: role, org: org, start: start, end: end, highlights: editing?.highlights))
        dismiss()
    }
}
