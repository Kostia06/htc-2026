import SkillitKit
import SwiftUI

/// "Interview for what?": a saved posting, a target role, or anything typed in. When the choice has no employer,
/// it offers the local companies Skillit knows. Remembers the last choice, so the next session is one tap.
struct InterviewTargetPicker: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @AppStorage(PracticeDifficulty.storageKey) private var difficulty: PracticeDifficulty = .standard
    @AppStorage(InterviewTargetPicker.lastChoiceKey) private var lastChoice: Data?
    @State private var selected: InterviewTarget?
    @State private var other = ""
    @State private var localCompany: String?

    static let lastChoiceKey = "interviewTarget"

    let postings: [JobPosting]
    /// Preselected by the caller, like the roadmap step that opened the picker; otherwise the last choice.
    var initial: InterviewTarget?
    let onStart: (VoiceSessionRequest) -> Void

    var body: some View {
        NavigationStack {
            List {
                practisingFor
                if !postings.isEmpty {
                    section("Your postings", postings.map { InterviewTarget.posting(id: $0.id, title: $0.title, company: $0.company) })
                }
                section("Target roles", app.profile.targetRoles.map(InterviewTarget.role))
                Section("Something else") {
                    TextField("A role, a company, anything", text: $other)
                        .textInputAutocapitalization(.words)
                        .submitLabel(.done)
                        .onChange(of: other) { _, text in
                            let trimmed = text.trimmingCharacters(in: .whitespaces)
                            if !trimmed.isEmpty { selected = .other(trimmed) } else if case .other = selected { selected = nil }
                        }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.ground)
            .navigationTitle("Interview for")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) { footer }
        }
        .presentationDetents([.large])
        .presentationBackground(Theme.ground)
        .onAppear(perform: preselect)
    }

    /// The one line that says what this interview is for, plus the local companies when there's no employer yet.
    private var practisingFor: some View {
        Section {
            VStack(alignment: .leading, spacing: 6) {
                Text("You're practising for").font(.subheadline).foregroundStyle(.secondary)
                Text(summary).font(.title3.weight(.semibold))
            }
            .padding(.vertical, 4)
            if let selected, selected.canAddCompany, !app.companies.companies.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Want to prepare for a company near you?").font(.subheadline)
                    FlowLayout(spacing: 8) {
                        ForEach(app.companies.companies) { company in
                            companyChip(company)
                        }
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .listRowBackground(Theme.raised)
    }

    private var summary: String {
        guard let selected else { return "Pick a role or posting below" }
        if case let .posting(_, title, company) = selected {
            return "\(title) at \(company)"
        }
        if selected.canAddCompany, let slug = localCompany, let company = app.companies.name(for: slug) {
            return "\(selected.title) at \(company)"
        }
        return selected.title
    }

    private func companyChip(_ company: CompanySummary) -> some View {
        let isOn = localCompany == company.slug
        return Button {
            localCompany = isOn ? nil : company.slug
        } label: {
            Text(company.name)
                .font(.subheadline.weight(.medium))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .foregroundStyle(isOn ? Theme.onAction : Color.primary)
                .background(isOn ? Theme.action : Theme.chip, in: .capsule)
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: isOn)
    }

    private func section(_ title: String, _ targets: [InterviewTarget]) -> some View {
        Section(title) {
            if targets.isEmpty {
                Text("None yet").foregroundStyle(.tertiary)
            }
            ForEach(targets, id: \.self) { target in
                Button {
                    selected = target
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(target.title).foregroundStyle(.primary)
                            if let subtitle = target.subtitle {
                                Text(subtitle).font(.footnote).foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        if selected == target {
                            Image(systemName: "checkmark").foregroundStyle(Theme.action)
                        }
                    }
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
            }
        }
        .listRowBackground(Theme.raised)
    }

    private var footer: some View {
        VStack(spacing: 14) {
            DifficultyPicker(difficulty: $difficulty)
            Button(selected == nil ? "Pick one to start" : "Start interview", action: start)
                .buttonStyle(.raised)
                .disabled(selected == nil)
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .background(.bar)
    }

    private func preselect() {
        guard selected == nil else { return }
        selected = initial ?? lastChoice.flatMap { try? JSONDecoder().decode(InterviewTarget.self, from: $0) }
        if case let .other(text)? = selected {
            other = text
        }
    }

    private func start() {
        guard let selected else { return }
        lastChoice = try? JSONEncoder().encode(selected)
        onStart(selected.request(difficulty: difficulty, at: localCompany))
        dismiss()
    }
}

#if DEBUG
#Preview {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            InterviewTargetPicker(postings: [.sample], onStart: { _ in })
        }
        .environment(AppModel.preview(profile: Profile(targetRoles: ["Junior data analyst"])))
}
#endif
