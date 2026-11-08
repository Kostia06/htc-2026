import SkillitKit
import SwiftUI

/// How a resume was tailored for one job: the match at the top, then every change as before → after with its reason.
struct TailoredResumeView: View {
    let model: TailoredResumeModel
    var onDeleted: () -> Void = {}
    @Environment(\.dismiss) private var dismiss
    @State private var isExporting = false
    @State private var isConfirmingDelete = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                TailorMatchCard(match: model.tailored.match)
                    .animation(.spring(duration: 0.4), value: model.tailored.match)
                changes
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .background(Theme.ground)
        .navigationTitle("Tailored resume")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu("More", systemImage: "ellipsis") {
                    Button("Delete this version", systemImage: "trash", role: .destructive) { isConfirmingDelete = true }
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            Button("Export", systemImage: "square.and.arrow.up") { isExporting = true }
                .buttonStyle(.raised)
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .background(Theme.ground.opacity(0.92))
        }
        // the layout is remembered per job: some postings want the plain page
        .sheet(isPresented: $isExporting) {
            ResumeExportView(templateKey: "resume.template.\(model.tailored.id)") { format, template async throws(SkillitError) -> URL in
                try await model.file(format, template: template)
            }
        }
        .confirmationDialog("Delete this tailored resume?", isPresented: $isConfirmingDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) { Task { await delete() } }
        } message: {
            Text("Your base resume stays as it is.")
        }
        .sensoryFeedback(.selection, trigger: model.acceptedCount)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(model.tailored.title)
                .font(.title2.bold())
                .fixedSize(horizontal: false, vertical: true)
            Text(model.tailored.company)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder private var changes: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("How it was tailored")
                .font(.headline)
            Text(changesNote)
                .font(.footnote)
                .foregroundStyle(.secondary)
            if let error = model.errorMessage {
                Label(error, systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(Theme.negative)
            }
            ForEach(model.tailored.changes) { change in
                TailorChangeRow(change: change, isBusy: model.pendingChangeId == change.id, isLocked: model.tailored.editedByHand) {
                    Task { await model.setChange(change, accepted: !change.accepted) }
                }
            }
        }
        .animation(.spring(duration: 0.35), value: model.tailored.changes)
    }

    private var changesNote: String {
        if model.tailored.changes.isEmpty {
            return "Your resume already reads well for this job, so nothing was changed."
        }
        if model.tailored.editedByHand {
            return "You edited this version by hand, so these changes are kept as a record."
        }
        return "Every change only rewords, reorders or trims what your resume already says. Revert any you don't want."
    }

    private func delete() async {
        guard await model.delete() else { return }
        onDeleted()
        dismiss()
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        TailoredResumeView(model: TailoredResumeModel(tailored: SampleTailoredResumes.tailored, service: SampleTailoredResumes()))
    }
}
#endif
