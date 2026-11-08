import RavenKit
import SwiftUI

/// "Interview for what?": a saved posting, a target role, a company Skillit knows, or anything typed in.
/// Remembers the last choice, so the next session is one tap. The caller starts the session once this sheet is gone.
struct InterviewTargetPicker: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @AppStorage(PracticeDifficulty.storageKey) private var difficulty: PracticeDifficulty = .standard
    @AppStorage(InterviewTargetPicker.lastChoiceKey) private var lastChoice: Data?
    @State private var selected: InterviewTarget?
    @State private var other = ""

    static let lastChoiceKey = "interviewTarget"

    let postings: [JobPosting]
    /// Preselected by the caller, like the roadmap step that opened the picker; otherwise the last choice.
    var initial: InterviewTarget?
    let onStart: (VoiceSessionRequest) -> Void

    var body: some View {
        NavigationStack {
            List {
                if !postings.isEmpty {
                    section("Your postings", postings.map { InterviewTarget.posting(id: $0.id, title: $0.title, company: $0.company) })
                }
                section("Target roles", app.profile.targetRoles.map(InterviewTarget.role))
                section("Companies", app.companies.companies.map { InterviewTarget.company(slug: $0.slug, name: $0.name) })
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
            Button(selected.map { "Start: \($0.title)" } ?? "Pick one to start", action: start)
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
        onStart(selected.request(difficulty: difficulty))
        dismiss()
    }
}

#Preview {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            InterviewTargetPicker(postings: [.sample], onStart: { _ in })
        }
        .environment(AppModel.preview(profile: Profile(targetRoles: ["Junior data analyst"])))
}
