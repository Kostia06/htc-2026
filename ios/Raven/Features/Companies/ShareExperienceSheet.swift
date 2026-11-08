import RavenKit
import SwiftUI

/// A short form for someone who just interviewed here: role, round, the questions, an optional tip and outcome.
struct ShareExperienceSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var model: ShareExperienceModel
    @FocusState private var focusedQuestion: Int?

    private let companyName: String

    init(company: CompanyDetails, service: any CompanyService) {
        companyName = company.name
        _model = State(initialValue: ShareExperienceModel(companySlug: company.slug, service: service))
    }

    var body: some View {
        NavigationStack {
            Group {
                if model.phase == .sent {
                    sent
                } else {
                    form
                }
            }
            .background(Theme.ground)
            .navigationTitle("How it went at \(companyName)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(model.phase == .sent ? "Done" : "Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
        .presentationBackground(Theme.ground)
        .sensoryFeedback(.success, trigger: model.phase == .sent)
        .animation(.spring(duration: 0.4), value: model.phase)
    }

    private var form: some View {
        Form {
            Section {
                TextField("Role, like Junior data analyst", text: $model.role)
                    .textInputAutocapitalization(.sentences)
                Picker("Round", selection: $model.round) {
                    ForEach(ShareExperienceModel.Round.allCases) { Text($0.rawValue).tag($0) }
                }
            }
            Section("Questions you were asked") {
                ForEach(model.questions.indices, id: \.self) { index in
                    HStack {
                        TextField("Question \(index + 1)", text: $model.questions[index], axis: .vertical)
                            .focused($focusedQuestion, equals: index)
                        if model.questions.count > 1 {
                            Button {
                                withAnimation(.spring(duration: 0.3)) { model.removeQuestion(at: index) }
                            } label: {
                                Image(systemName: "minus.circle.fill").foregroundStyle(.secondary)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Remove question \(index + 1)")
                        }
                    }
                }
                Button {
                    withAnimation(.spring(duration: 0.3)) { model.addQuestion() }
                    focusedQuestion = model.questions.count - 1
                } label: {
                    Label("Add another question", systemImage: "plus.circle.fill")
                }
                .disabled(!model.canAddQuestion)
            }
            Section("Optional") {
                TextField("One tip for the next person", text: $model.tip, axis: .vertical)
                Picker("Outcome", selection: $model.outcome) {
                    ForEach(ShareExperienceModel.Outcome.allCases) { Text($0.rawValue).tag($0) }
                }
            }
            Section {
                Button {
                    Task { await model.send() }
                } label: {
                    if model.phase == .sending {
                        ProgressView().tint(.white)
                    } else {
                        Text("Share anonymously")
                    }
                }
                .buttonStyle(.raised)
                .disabled(!model.canSend)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
                if case let .failed(message) = model.phase {
                    Text(message).font(.footnote).foregroundStyle(Theme.action).listRowBackground(Color.clear)
                }
            } footer: {
                Label(
                    "Names and contact details are removed. It only shows once 3 people report similar questions.",
                    systemImage: "lock.shield",
                )
                .font(.footnote)
            }
        }
        .scrollContentBackground(.hidden)
        .scrollDismissesKeyboard(.interactively)
    }

    private var sent: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(Theme.action)
                .transition(.scale.combined(with: .opacity))
            Text("Thanks — this helps the next person").font(.title3.bold()).multilineTextAlignment(.center)
            Text("Your report is anonymous. It shows up here once two more people report similar questions.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Done") { dismiss() }
                .buttonStyle(.raised)
                .frame(maxWidth: 220)
                .padding(.top, 8)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
