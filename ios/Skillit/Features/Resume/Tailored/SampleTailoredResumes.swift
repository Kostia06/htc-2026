#if DEBUG
    import Foundation
    import SkillitKit

    /// A tailored version of the sample resume for previews and screenshots; never talks to the server.
    struct SampleTailoredResumes: TailoredResumeService {
        static let changes = [
            TailorChange(
                id: "c1", kind: .reword, section: "experience", basedOn: "experience[0].bullets[1]",
                before: "Wrote SQL reports in Postgres for the lending team",
                after: "Wrote the lending team's SQL reports in Postgres",
                why: "Puts SQL first, the posting's first requirement.", requirement: "SQL"
            ),
            TailorChange(
                id: "c2", kind: .trim, section: "experience", basedOn: "experience[0].bullets[2]",
                before: "Helped with code reviews and testing", after: "",
                why: "Says little about data work, so the SQL and Python lines stand out.", requirement: nil
            ),
            TailorChange(
                id: "c3", kind: .reorder, section: "skills", basedOn: "skills",
                before: "Python, SQL, Flask, Postgres, SwiftUI, Git", after: "SQL, Python, Flask, Postgres, SwiftUI, Git",
                why: "Moves SQL, Python to the front, since the posting asks for them.", requirement: "SQL"
            ),
        ]

        static let tailored = TailoredResume(
            id: "tr_sample", postingId: JobPosting.sample.id, title: JobPosting.sample.title, company: JobPosting.sample.company,
            resume: SampleResume.resume, changes: changes,
            match: TailorMatch(
                covered: [
                    .init(text: "SQL", topic: "SQL", required: true),
                    .init(text: "Python for data work", topic: "Python", required: true),
                ],
                missing: [
                    .init(text: "Experience with Tableau", topic: "Tableau", required: true),
                    .init(text: "dbt is a plus", topic: "dbt", required: false),
                ],
                coveredBefore: 2
            ),
            updatedAt: ISO8601DateFormatter().string(from: .now.addingTimeInterval(-7200))
        )

        func tailoredResumes() async throws(SkillitError) -> [TailoredResumeSummary] {
            let item = Self.tailored
            return [.init(
                id: item.id, postingId: item.postingId, title: item.title, company: item.company,
                covered: 2, total: 4, updatedAt: item.updatedAt
            )]
        }

        func tailorResume(for _: TailorSource) async throws(SkillitError) -> TailoredResume {
            try? await Task.sleep(for: .seconds(1.5))
            return Self.tailored
        }

        func tailoredResume(id _: String) async throws(SkillitError) -> TailoredResume {
            Self.tailored
        }

        func setChange(_ changeId: String, accepted: Bool, in _: String) async throws(SkillitError) -> TailoredResume {
            let item = Self.tailored
            let changes = item.changes.map { change in
                var change = change
                if change.id == changeId { change.accepted = accepted }
                return change
            }
            return TailoredResume(
                id: item.id, postingId: item.postingId, title: item.title, company: item.company, resume: item.resume,
                changes: changes, match: item.match, updatedAt: item.updatedAt
            )
        }

        func deleteTailoredResume(id _: String) async throws(SkillitError) {}

        func tailoredPDFData(id _: String) async throws(SkillitError) -> Data {
            try await SampleResume().resumePDFData()
        }

        func postings() async throws(SkillitError) -> [JobPosting] {
            [.sample]
        }
    }
#endif
