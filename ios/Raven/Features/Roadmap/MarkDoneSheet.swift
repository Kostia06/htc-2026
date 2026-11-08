import RavenKit
import SwiftUI

/// Asked when a step is marked done by hand: one optional line about what was actually done, kept with the step.
struct MarkDoneSheet: View {
    let step: RoadmapStep
    let onSave: (String?) -> Void

    @State private var note = ""
    @FocusState private var isEditing: Bool
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text("What did you do?")
                    .font(.title2.bold())
                Text(step.title)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            TextField("A link, or one line about it (optional)", text: $note)
                .focused($isEditing)
                .submitLabel(.done)
                .onSubmit(save)
                .padding(14)
                .background(Color(white: 0.12), in: .rect(cornerRadius: 14))
            Button("Mark done", action: save)
                .buttonStyle(.raised)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.ground)
        .presentationDetents([.height(280)])
        .presentationDragIndicator(.visible)
        .presentationBackground(Theme.ground)
        .onAppear { isEditing = true }
    }

    private func save() {
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        onSave(trimmed.isEmpty ? nil : trimmed)
        dismiss()
    }
}
