import SkillitKit
import SwiftUI

/// The job postings near the person (For you's jobs) in the interview picker. Tapping one saves it as a posting, so the
/// interviewer asks about that posting's own responsibilities and requirements; it is then the picker's choice.
struct NearbyJobsSection: View {
    @Environment(AppModel.self) private var app
    @State private var jobs: [FeedCard]?
    @State private var savingId: String?
    @State private var failure: String?

    let onPicked: (InterviewTarget) -> Void

    var body: some View {
        Section {
            if let jobs {
                if jobs.isEmpty {
                    Text("No postings near you yet. Check For you in a little while.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                ForEach(jobs) { job in
                    Button { pick(job) } label: { row(job) }
                        .disabled(savingId != nil)
                }
            } else {
                ProgressView().frame(maxWidth: .infinity)
            }
            if let failure {
                Text(failure).font(.footnote).foregroundStyle(.red)
            }
        } header: {
            Text("Real jobs near you")
        }
        .task { await load() }
    }

    private func row(_ job: FeedCard) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "briefcase.fill").foregroundStyle(Theme.action)
            VStack(alignment: .leading, spacing: 2) {
                Text(job.title).font(.headline).foregroundStyle(.primary)
                Text([job.org, job.where].compactMap(\.self).joined(separator: " · "))
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            if savingId == job.id { ProgressView() }
        }
        .contentShape(Rectangle())
    }

    private func load() async {
        guard jobs == nil, let client = app.client else { return }
        do {
            jobs = try await client.feed(section: .jobs).items
        } catch {
            failure = error.message
            jobs = []
        }
    }

    private func pick(_ job: FeedCard) {
        guard let client = app.client else { return }
        savingId = job.id
        failure = nil
        Task {
            defer { savingId = nil }
            do {
                let posting = try await save(job, using: client)
                onPicked(.posting(id: posting.id, title: posting.title, company: posting.company))
            } catch {
                failure = "That posting couldn't be read. Try another one."
            }
        }
    }

    /// The listing's own page first; many job sites block reading, and the card's description is enough to interview from.
    private func save(_ job: FeedCard, using client: SkillitClient) async throws -> JobPosting {
        if let posting = try? await client.importPosting(PostingImportRequest(url: job.url)) { return posting }
        let text = ["\(job.title) at \(job.org)", job.where.map { "Location: \($0)" }, job.summary, job.level, job.format]
            .compactMap(\.self).joined(separator: "\n")
        return try await client.importPosting(PostingImportRequest(text: text))
    }
}
