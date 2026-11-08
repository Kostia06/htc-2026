import RavenKit
import SwiftUI

struct ProfileView: View {
    @Environment(AppModel.self) private var app
    @State private var editor = ProfileEditor()
    @State private var isRefreshing = false
    @State private var isShowingSettings = false
    @State private var isEditingHeadline = false
    @State private var headlineDraft = ""
    @State private var experienceSheet: RowSheet<Profile.Experience>?
    @State private var educationSheet: RowSheet<Profile.Education>?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ProfileHeader(profile: app.profile, onEditHeadline: startEditingHeadline)
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 8, trailing: 20))
                }
                Section {
                    ResumeCard(service: resumeService)
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 8, trailing: 20))
                }
                if isRefreshing, app.profile.isEmpty {
                    loadingSections
                } else {
                    editableSections
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Theme.ground)
            .navigationTitle("Profile")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Settings", systemImage: "gearshape") { isShowingSettings = true }
                }
            }
            .navigationDestination(isPresented: $isShowingSettings) { SettingsView() }
            .refreshable { await refresh() }
            .overlay(alignment: .bottom) { SavedFlash(count: editor.saveCount) }
            .sensoryFeedback(.success, trigger: editor.saveCount)
            .sheet(item: $experienceSheet) { sheet in
                ExperienceForm(editing: sheet.row) { apply(.saveExperience($0, replacing: sheet.row)) }
            }
            .sheet(item: $educationSheet) { sheet in
                EducationForm(editing: sheet.row) { apply(.saveEducation($0, replacing: sheet.row)) }
            }
            .alert("Headline", isPresented: $isEditingHeadline) {
                TextField("One line about you", text: $headlineDraft)
                Button("Save") { apply(.setHeadline(headlineDraft)) }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Shown under your target role, and to the interviewer in practice.")
            }
            .alert("Couldn't save", isPresented: hasFailure) {
                Button("OK") { editor.dismissFailure() }
            } message: {
                Text(editor.failure ?? "")
            }
        }
    }

    @ViewBuilder private var editableSections: some View {
        Section("Target roles") {
            ChipsSection(
                chips: app.profile.targetRoles.map { .init(title: $0) },
                placeholder: "Add a role you're aiming for",
                onAdd: { apply(.addTargetRole($0)) },
                onRemove: { apply(.removeTargetRole($0.title)) },
            )
        }
        .listRowBackground(Theme.raised)
        Section("Skills") {
            SkillsSummary(skills: app.profile.skills.map(\.name)) { apply(.removeSkill($0)) }
        }
        .listRowBackground(Theme.raised)
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

    @ViewBuilder private var loadingSections: some View {
        ForEach(["Target roles", "Experience"], id: \.self) { title in
            Section(title) { SkeletonLines(widths: [0.6, 0.8, 0.4], highlighted: 1).padding(.vertical, 8) }
                .listRowBackground(Theme.raised)
        }
    }

    private var hasFailure: Binding<Bool> {
        Binding(get: { editor.failure != nil }, set: { if !$0 { editor.dismissFailure() } })
    }

    private func apply(_ edit: ProfileEdit) {
        editor.apply(edit, to: app)
    }

    private func startEditingHeadline() {
        headlineDraft = app.profile.headline ?? ""
        isEditingHeadline = true
    }

    private func refresh() async {
        guard let client = app.client else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        if let profile = try? await client.profile() {
            app.profile = profile
        }
    }

    private var resumeService: any ResumeService {
        if let client = app.client {
            return client
        }
        #if DEBUG
            return SampleResume()
        #else
            return UnavailableResume()
        #endif
    }
}

/// What a row sheet is editing; nil means a new row. Fresh identity each time so the form restarts from the right values.
private struct RowSheet<Row: Hashable>: Identifiable {
    let id = UUID()
    let row: Row?
}
