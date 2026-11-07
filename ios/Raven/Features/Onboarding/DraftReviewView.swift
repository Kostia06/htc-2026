import RavenKit
import SwiftUI

/// The person checks what Raven drafted: anything wrong is a swipe away, anything missing is a line to type.
struct DraftReviewView: View {
    @Bindable var model: OnboardingModel
    let confirm: () -> Void
    @State private var newSkill = ""

    var body: some View {
        List {
            if !model.missing.isEmpty {
                Section("Still worth adding") {
                    ForEach(model.missing, id: \.self) { Text($0).foregroundStyle(.secondary) }
                }
            }
            Section("Aiming for") {
                TextField("A role, like junior data analyst", text: targetRole)
                TextField("One line about you", text: headline)
            }
            Section {
                ForEach(model.profile.skills, id: \.self) { SkillRow(skill: $0) }
                    .onDelete { model.profile.skills.remove(atOffsets: $0) }
                TextField("Add a skill", text: $newSkill)
                    .onSubmit(addSkill)
            } header: {
                Text("Skills")
            } footer: {
                if model.droppedClaims > 0 {
                    Text("Raven left out \(model.droppedClaims) skill(s) it couldn't point to in your resume.")
                }
            }
            if !model.profile.experience.isEmpty {
                Section("Experience") {
                    ForEach(model.profile.experience, id: \.self) { item in
                        LabeledContent(item.role, value: item.org)
                    }
                    .onDelete { model.profile.experience.remove(atOffsets: $0) }
                }
            }
            if !model.profile.education.isEmpty {
                Section("Education") {
                    ForEach(model.profile.education, id: \.self) { item in
                        LabeledContent(item.school, value: item.program ?? "")
                    }
                    .onDelete { model.profile.education.remove(atOffsets: $0) }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .navigationTitle("Check your profile")
        .safeAreaInset(edge: .bottom) {
            Button(action: confirm) {
                Group {
                    if model.step == .saving {
                        ProgressView()
                    } else {
                        Text("Looks right")
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
            }
            .buttonStyle(.glassProminent)
            .controlSize(.large)
            .disabled(!model.canConfirm)
            .padding(.horizontal, 24)
        }
    }

    private var targetRole: Binding<String> {
        Binding(
            get: { model.profile.targetRoles.first ?? "" },
            set: { model.profile.targetRoles = $0.isEmpty ? [] : [$0] + model.profile.targetRoles.dropFirst() },
        )
    }

    private var headline: Binding<String> {
        Binding(get: { model.profile.headline ?? "" }, set: { model.profile.headline = $0.isEmpty ? nil : $0 })
    }

    private func addSkill() {
        let name = newSkill.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        model.profile.skills.append(.init(name: name, source: .selfReported))
        newSkill = ""
    }
}

private struct SkillRow: View {
    let skill: Profile.Skill

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(skill.name)
            if let evidence = skill.evidence {
                Text("“\(evidence)”")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
    }
}
