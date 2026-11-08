import Foundation

/// An interview report someone shares after the fact. Names and contact details are stripped on the server before anything is stored.
public struct ExperienceReport: Encodable, Equatable, Sendable {
    public static let maxQuestions = 15
    public static let maxTextLength = 500

    public var companySlug: String
    public var role: String
    public var questions: [String]
    /// The round, like "phone screen" or "technical".
    public var format: String?
    public var outcome: String?
    public var tips: String?

    public init(
        companySlug: String, role: String, questions: [String], format: String? = nil, outcome: String? = nil, tips: String? = nil,
    ) {
        self.companySlug = companySlug
        self.role = role
        self.questions = questions
        self.format = format
        self.outcome = outcome
        self.tips = tips
    }

    /// Blank lines dropped, whitespace trimmed, empty optionals left out, so the server sees exactly what the person meant.
    public var cleaned: ExperienceReport {
        let trimmed = { (text: String?) -> String? in
            let value = text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return value.isEmpty ? nil : value
        }
        return ExperienceReport(
            companySlug: companySlug,
            role: role.trimmingCharacters(in: .whitespacesAndNewlines),
            questions: questions.compactMap(trimmed),
            format: trimmed(format),
            outcome: trimmed(outcome),
            tips: trimmed(tips),
        )
    }

    /// True when the cleaned report has a role and at least one question, each within the server's limits.
    public var isComplete: Bool {
        let report = cleaned
        let texts = [report.role] + report.questions + [report.tips ?? "", report.outcome ?? ""]
        let withinLimits = texts.allSatisfy { $0.count <= Self.maxTextLength }
        return !report.role.isEmpty && !report.questions.isEmpty && report.questions.count <= Self.maxQuestions && withinLimits
    }
}

public extension SkillitClient {
    func submitExperience(_ report: ExperienceReport) async throws(SkillitError) {
        let _: [String: Bool] = try await send(authorized("POST", "api/experiences", json: report.cleaned))
    }
}
