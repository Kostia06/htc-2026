import RavenKit
import SwiftUI

/// Add or edit one school. `editing` is nil for a new row.
struct EducationForm: View {
    let editing: Profile.Education?
    let onSave: (Profile.Education) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var school: String
    @State private var program: String
    @State private var year: String
    @State private var graduation: String

    init(editing: Profile.Education?, onSave: @escaping (Profile.Education) -> Void) {
        self.editing = editing
        self.onSave = onSave
        _school = State(initialValue: editing?.school ?? "")
        _program = State(initialValue: editing?.program ?? "")
        _year = State(initialValue: editing?.year ?? "")
        _graduation = State(initialValue: editing?.expectedGraduation ?? "")
    }

    private var canSave: Bool {
        !school.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("School", text: $school)
                    TextField("Program, like BSc Computer Science", text: $program)
                }
                Section("Where you're at") {
                    TextField("Year, like Third-year", text: $year)
                    TextField("Expected graduation, like April 2028", text: $graduation)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.ground)
            .navigationTitle(editing == nil ? "Add education" : "Edit education")
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
        onSave(Profile.Education(school: school, program: program, year: year, expectedGraduation: graduation))
        dismiss()
    }
}
