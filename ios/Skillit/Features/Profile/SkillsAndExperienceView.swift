import SkillitKit
import SwiftUI

/// Behind the Profile tab's "Skills & experience" door: target roles, skills, jobs and schools, each edited in place.
struct SkillsAndExperienceView: View {
    @Environment(AppModel.self) private var app
    @State private var editor = ProfileEditor()
    @State private var experienceSheet: RowSheet<Profile.Experience>?
    @State private var educationSheet: RowSheet<Profile.Education>?
    @State private var isEditingSkills = false
    @State private var github = GithubConnectModel()

    var body: some View {
        List {
            Section {
                ChipsSection(
                    chips: app.profile.targetRoles.map { .init(title: $0) },
                    placeholder: "Add a role you're aiming for",
                    onAdd: { apply(.addTargetRole($0)) },
                    onRemove: { apply(.removeTargetRole($0.title)) },
                )
            } header: {
                Text("Target roles")
            } footer: {
                Text("The first one leads your profile and shapes your road.")
            }
            .listRowBackground(Theme.raised)
            Section {
                SkillsSummary(skills: app.profile.skills.map(\.name), failure: editor.skillsFailure)
            } header: {
                SkillsHeader { isEditingSkills = true }
            }
            .listRowBackground(Theme.raised)
            experienceSection
            educationSection
            Section("Connected accounts") {
                GithubConnectRow(model: github) { await reloadProfile() }
            }
            .listRowBackground(Theme.raised)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.ground)
        .navigationTitle("Skills & experience")
        .navigationBarTitleDisplayMode(.inline)
        .overlay(alignment: .bottom) { SavedFlash(count: editor.saveCount) }
        .sensoryFeedback(.success, trigger: editor.saveCount)
        .sheet(item: $experienceSheet) { sheet in
            ExperienceForm(editing: sheet.row) { apply(.saveExperience($0, replacing: sheet.row)) }
        }
        .sheet(item: $educationSheet) { sheet in
            EducationForm(editing: sheet.row) { apply(.saveEducation($0, replacing: sheet.row)) }
        }
        .sheet(isPresented: $isEditingSkills) {
            SkillsEditor(skills: app.profile.skills) { editor.saveSkills($0, to: app) }
        }
        .alert("Couldn't save", isPresented: hasFailure) {
            Button("OK") { editor.dismissFailure() }
        } message: {
            Text(editor.failure ?? "")
        }
    }

    private var experienceSection: some View {
        Section("Experience") {
            ForEach(app.profile.experience, id: \.self) { row in
                ExperienceRow(row: row) { experienceSheet = RowSheet(row: row) }
                    .swipeActions(edge: .trailing) {
                        Button("Delete", systemImage: "trash", role: .destructive) { apply(.removeExperience(row)) }
                    }
            }
            AddRowButton(title: "Add experience") { experienceSheet = RowSheet(row: nil) }
        }
        .listRowBackground(Theme.raised)
    }

    private var educationSection: some View {
        Section("Education") {
            ForEach(app.profile.education, id: \.self) { row in
                EducationRow(row: row) { educationSheet = RowSheet(row: row) }
                    .swipeActions(edge: .trailing) {
                        Button("Delete", systemImage: "trash", role: .destructive) { apply(.removeEducation(row)) }
                    }
            }
            AddRowButton(title: "Add education") { educationSheet = RowSheet(row: nil) }
        }
        .listRowBackground(Theme.raised)
    }

    private var hasFailure: Binding<Bool> {
        Binding(get: { editor.failure != nil }, set: { if !$0 { editor.dismissFailure() } })
    }

    /// imported GitHub projects land in the profile on the server; this brings them onto the screen
    private func reloadProfile() async {
        guard let client = app.client, let profile = try? await client.profile() else { return }
        app.profile = profile
    }

    private func apply(_ edit: ProfileEdit) {
        editor.apply(edit, to: app)
    }
}

/// What a row sheet is editing; nil means a new row. Fresh identity each time so the form restarts from the right values.
private struct RowSheet<Row: Hashable>: Identifiable {
    let id = UUID()
    let row: Row?
}

#if DEBUG
#Preview {
    NavigationStack {
        SkillsAndExperienceView()
    }
    .environment(AppModel.preview(profile: .sample))
}
#endif
