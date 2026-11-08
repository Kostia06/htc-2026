import SkillitKit
import SwiftUI

/// Tailor for a job: pick a saved posting or paste one, wait while Skillit works, then see how it was tailored.
/// Given a posting it starts right away, which is how the posting screen opens it.
struct TailorJobSheet: View {
    @State private var model: TailorJobModel
    private let startingPostingId: String?
    private let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss
    @FocusState private var isPasting: Bool

    init(service: any TailoredResumeService, postingId: String? = nil, onSaved: @escaping () -> Void = {}) {
        _model = State(initialValue: TailorJobModel(service: service))
        startingPostingId = postingId
        self.onSaved = onSaved
    }

    var body: some View {
        NavigationStack {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.ground)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") { dismiss() }
                    }
                }
        }
        .presentationBackground(Theme.ground)
        .task {
            if let startingPostingId {
                await tailor(.posting(id: startingPostingId))
            } else {
                await model.loadPostings()
            }
        }
    }

    @ViewBuilder private var content: some View {
        switch model.phase {
        case .choosing:
            TailorSourcePicker(model: model, isPasting: $isPasting) { source in
                Task { await tailor(source) }
            }
            .navigationTitle("Tailor for a job")
            .navigationBarTitleDisplayMode(.inline)
        case .tailoring:
            VStack(spacing: 12) {
                ProgressView()
                    .controlSize(.large)
                    .tint(Theme.agent)
                Text("Matching your resume to the posting…")
                    .font(.headline)
                Text("This takes about half a minute. Nothing is added that your resume doesn't already say.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(32)
        case let .done(result):
            TailoredResumeView(model: result) { onSaved() }
        case let .failed(message):
            ContentUnavailableView {
                Label("Couldn't tailor your resume", systemImage: "doc.text")
            } description: {
                Text(message)
            } actions: {
                Button("Try again") { model.startOver() }
                    .buttonStyle(.raised)
                    .frame(maxWidth: 220)
            }
        }
    }

    private func tailor(_ source: TailorSource) async {
        isPasting = false
        if await model.tailor(source) != nil {
            onSaved()
        }
    }
}

/// The choosing step: saved postings to tap, or a box to paste one into.
private struct TailorSourcePicker: View {
    @Bindable var model: TailorJobModel
    var isPasting: FocusState<Bool>.Binding
    let onTailor: (TailorSource) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if !model.postings.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Your saved postings")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        ForEach(model.postings) { posting in
                            postingRow(posting)
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text(model.postings.isEmpty ? "Paste the job posting" : "Or paste a posting")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    TextEditor(text: $model.pastedText)
                        .focused(isPasting)
                        .scrollContentBackground(.hidden)
                        .font(.subheadline)
                        .frame(minHeight: 160)
                        .padding(10)
                        .background(Theme.inset, in: .rect(cornerRadius: 14))
                        .onChange(of: model.pastedText) { _, text in
                            if !text.isEmpty { model.selectedPostingId = nil }
                        }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .safeAreaInset(edge: .bottom) {
            Button("Tailor my resume") {
                if let source = model.source { onTailor(source) }
            }
            .buttonStyle(.raised)
            .disabled(model.source == nil)
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .background(Theme.ground.opacity(0.92))
        }
    }

    private func postingRow(_ posting: JobPosting) -> some View {
        let isSelected = model.selectedPostingId == posting.id
        return Button {
            model.selectedPostingId = isSelected ? nil : posting.id
            isPasting.wrappedValue = false
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(posting.title).font(.headline)
                    Text(posting.company).font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isSelected ? Theme.action : Color.secondary)
                    .font(.title3)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.raised, in: .rect(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(isSelected ? Theme.action : Theme.hairline))
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .sensoryFeedback(.selection, trigger: isSelected)
    }
}

#if DEBUG
#Preview("Choosing") {
    Color.clear.sheet(isPresented: .constant(true)) {
        TailorJobSheet(service: SampleTailoredResumes())
    }
}

#Preview("From a posting") {
    Color.clear.sheet(isPresented: .constant(true)) {
        TailorJobSheet(service: SampleTailoredResumes(), postingId: JobPosting.sample.id)
    }
}
#endif
