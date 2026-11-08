import SkillitKit
import SwiftUI

/// The Resume screen's list of versions made for specific jobs, and the way to make another.
struct TailoredResumesSection: View {
    @State private var model: TailoredResumesModel
    @State private var isTailoring = false
    @State private var opened: TailoredResumeModel?

    init(service: any TailoredResumeService) {
        _model = State(initialValue: TailoredResumesModel(service: service))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Your resumes")
                .font(.headline)
            Text("One per job, each ready as PDF or Word. Your base resume stays as it is.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            if model.loadFailed {
                Text("Couldn't load your tailored resumes. Pull to refresh.")
                    .font(.footnote)
                    .foregroundStyle(Theme.negative)
            }
            ForEach(model.items) { item in
                Button { Task { await open(item) } } label: { TailoredResumeRow(item: item) }
                    .buttonStyle(.plain)
            }
            Button("Tailor for a job", systemImage: "plus") { isTailoring = true }
                .buttonStyle(.raised(Theme.secondaryButton, foreground: .white))
        }
        .task { await model.load() }
        .sheet(isPresented: $isTailoring, onDismiss: reload) {
            TailorJobSheet(service: model.service, onSaved: reload)
        }
        .navigationDestination(isPresented: isOpen) {
            if let opened {
                TailoredResumeView(model: opened, onDeleted: reload)
            }
        }
    }

    // coming back may follow a revert, which changes the row's match count
    private var isOpen: Binding<Bool> {
        Binding {
            opened != nil
        } set: { isPresented in
            guard !isPresented else { return }
            opened = nil
            reload()
        }
    }

    private func open(_ item: TailoredResumeSummary) async {
        guard let tailored = try? await model.service.tailoredResume(id: item.id) else { return }
        opened = TailoredResumeModel(tailored: tailored, service: model.service)
    }

    private func reload() {
        Task { await model.load() }
    }
}

/// Job title, company, how much of the posting it shows, and when it last changed.
private struct TailoredResumeRow: View {
    let item: TailoredResumeSummary

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(item.title)
                    .font(.headline)
                Text(item.company)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text(details)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .skillitCard()
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }

    private var details: String {
        let updated = RelativeTime.phrase(for: item.updatedAt).map { " · Updated \($0)" } ?? ""
        return item.matchLine + updated
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        ScrollView {
            TailoredResumesSection(service: SampleTailoredResumes())
                .padding(20)
        }
        .background(Theme.ground)
    }
}
#endif
