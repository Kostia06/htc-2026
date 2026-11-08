import SkillitKit
import SwiftUI

/// The whole skill list, editable: add one (with suggestions), tap a name to rename it, minus or swipe to remove.
/// Nothing reaches the server until Done, and then it's one patch.
struct SkillsEditor: View {
    let onDone: (SkillsDraft) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var draft: SkillsDraft
    @State private var newSkill = ""
    @State private var renaming: SkillsDraft.Row?
    @State private var renameText = ""
    @State private var problem: String?
    @FocusState private var isAdding: Bool

    init(skills: [Profile.Skill], onDone: @escaping (SkillsDraft) -> Void) {
        self.onDone = onDone
        _draft = State(initialValue: SkillsDraft(skills: skills))
    }

    var body: some View {
        NavigationStack {
            List {
                addSection
                listSection
            }
            .scrollContentBackground(.hidden)
            .background(Theme.ground)
            .navigationTitle("Edit skills")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: finish)
                        .buttonStyle(.borderedProminent)
                        .tint(Theme.action)
                        .foregroundStyle(Theme.onAction)
                }
            }
            .alert("Rename skill", isPresented: isRenaming, presenting: renaming) { row in
                TextField("Skill", text: $renameText)
                Button("Cancel", role: .cancel) {}
                Button("Rename") { rename(row) }
            } message: { row in
                if row.source == .selfReported {
                    Text("Fix the wording of \(row.name).")
                } else {
                    // the resume quote backed the old wording, so the new one stands on the person's word
                    Text("A renamed skill counts as added by you.")
                }
            }
            .animation(.snappy, value: draft.rows)
        }
        .interactiveDismissDisabled(draft.patch != nil)
    }

    private var addSection: some View {
        Section {
            HStack(spacing: 8) {
                Image(systemName: "plus.circle.fill")
                    .foregroundStyle(isAdding ? Theme.action : .secondary)
                    .accessibilityHidden(true)
                TextField("Add a skill", text: $newSkill)
                    .focused($isAdding)
                    .submitLabel(.done)
                    .onSubmit { add(newSkill) }
                    .disabled(!draft.canAdd)
                if !newSkill.isEmpty {
                    Button("Add") { add(newSkill) }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.action)
                }
            }
            .frame(minHeight: 44)
            if !suggestions.isEmpty {
                SkillSuggestions(names: suggestions) { add($0) }
            }
        } footer: {
            if let problem {
                Text(problem).foregroundStyle(Theme.negative)
            } else if !draft.canAdd {
                Text("That's the most Skillit keeps. Remove one to add another.")
            }
        }
        .listRowBackground(Theme.raised)
    }

    private var listSection: some View {
        Section {
            if draft.rows.isEmpty {
                Text("No skills yet.").foregroundStyle(.secondary)
            }
            ForEach(draft.rows) { row in
                SkillEditorRow(row: row) {
                    renameText = row.name
                    renaming = row
                } onRemove: {
                    draft.remove(row.id)
                }
            }
            .onDelete { draft.remove(atOffsets: $0) }
        } header: {
            Text("Your skills (\(draft.rows.count))")
        }
        .listRowBackground(Theme.raised)
    }

    private var suggestions: [String] {
        guard draft.canAdd else { return [] }
        return draft.suggestions(matching: newSkill, among: SkillsDraft.commonSkills)
    }

    private var isRenaming: Binding<Bool> {
        Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })
    }

    private func add(_ text: String) {
        if draft.add(text) {
            newSkill = ""
            problem = nil
        } else if draft.contains(text.trimmingCharacters(in: .whitespacesAndNewlines)) {
            problem = "\(text.trimmingCharacters(in: .whitespacesAndNewlines)) is already on your list."
        }
    }

    private func rename(_ row: SkillsDraft.Row) {
        let text = renameText.trimmingCharacters(in: .whitespacesAndNewlines)
        if draft.rename(row.id, to: text) {
            problem = nil
        } else if !text.isEmpty, draft.contains(text, except: row.id) {
            problem = "\(text) is already on your list."
        }
    }

    private func finish() {
        onDone(draft)
        dismiss()
    }
}

/// One skill: a visible remove button, the name (tap to rename) and where it came from.
private struct SkillEditorRow: View {
    let row: SkillsDraft.Row
    let onRename: () -> Void
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button(action: onRemove) {
                Image(systemName: "minus.circle.fill")
                    .font(.title3)
                    .foregroundStyle(Theme.negative)
                    .frame(minWidth: 44, minHeight: 44)
                    .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove \(row.name)")
            Button(action: onRename) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.name).font(.body)
                    Text(row.source.label).font(.caption).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(row.name), \(row.source.label)")
            .accessibilityHint("Rename")
        }
    }
}

/// Known skills that aren't on the list yet, one tap to add.
private struct SkillSuggestions: View {
    let names: [String]
    let onPick: (String) -> Void

    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(names, id: \.self) { name in
                Button { onPick(name) } label: {
                    Label(name, systemImage: "plus")
                        .font(.subheadline)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Theme.chip, in: .capsule)
                        .contentShape(.capsule)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Add \(name)")
            }
        }
        .padding(.vertical, 4)
    }
}

private extension SkillSource {
    var label: String {
        switch self {
        case .resume: "From your resume"
        case .interview: "From practice"
        case .selfReported: "Added by you"
        }
    }
}

#if DEBUG
    #Preview {
        SkillsEditor(skills: [
            .init(name: "Python", source: .resume, evidence: "Built a pandas pipeline"),
            .init(name: "SQL", source: .interview),
            .init(name: "Public speaking", source: .selfReported),
        ]) { _ in }
    }
#endif
