import Foundation
import SkillitKit

/// The server calls a quick update makes, so the bar and the sheet can also run with no account for screenshots and previews.
protocol QuickUpdateService {
    func quickUpdate(_ request: QuickUpdateRequest) async throws(SkillitError) -> QuickUpdateReply
    func importPosting(_ request: PostingImportRequest) async throws(SkillitError) -> JobPosting
}

extension SkillitClient: QuickUpdateService {}

/// No server: asks one question when the update is vague, otherwise pretends to mark a step done; a posting comes back ready.
struct OfflineQuickUpdateService: QuickUpdateService {
    func quickUpdate(_ request: QuickUpdateRequest) async throws(SkillitError) -> QuickUpdateReply {
        try? await Task.sleep(for: .milliseconds(700))
        if request.conversation.isEmpty, request.message.split(separator: " ").count < 4 {
            return QuickUpdateReply(reply: "Which one: the Flask dashboard or the portfolio site?", needsAnswer: true)
        }
        return QuickUpdateReply(
            reply: "Nice, the Flask dashboard is done.",
            needsAnswer: false,
            applied: [AppliedChange(type: "complete_step", summary: "Marked \"Build a Flask dashboard\" done")]
        )
    }

    func importPosting(_: PostingImportRequest) async throws(SkillitError) -> JobPosting {
        try? await Task.sleep(for: .milliseconds(900))
        return .sample
    }
}

extension JobPosting {
    static let sample = JobPosting(
        id: "po_sample", title: "Junior Data Analyst", company: "Acme Analytics", companySlug: "acme-analytics",
        location: "Calgary, hybrid", seniority: "Junior",
        requirements: [
            PostingRequirement(text: "SQL", topic: "SQL", required: true, have: true, evidence: "Skill: SQL"),
            PostingRequirement(text: "Python for data work", topic: "Python", required: true, have: true, evidence: "Skill: Python"),
            PostingRequirement(text: "Experience with Tableau", topic: "Tableau", required: true, have: false),
            PostingRequirement(text: "dbt is a plus", topic: "dbt", required: false, have: false),
        ],
        responsibilities: ["Build dashboards for the lending team", "Clean and load data"],
        skills: ["SQL", "Python", "Tableau", "dbt"],
        prefilled: PostingPrefill(
            targetRole: "Junior Data Analyst",
            company: .init(slug: "acme-analytics", name: "Acme Analytics", researchQueued: true),
            steps: ["Build up Tableau", "Build up dbt", "Practice the Junior Data Analyst interview"],
        ),
    )
}
