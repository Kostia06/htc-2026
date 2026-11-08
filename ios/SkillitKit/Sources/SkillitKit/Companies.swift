import Foundation

/// One row of the companies list: enough to pick a company, not the facts themselves.
public struct CompanySummary: Codable, Equatable, Sendable, Identifiable {
    public let slug: String
    public let name: String
    public let factCount: Int
    public let reportedCount: Int
    public let lastResearchedAt: String?

    public var id: String {
        slug
    }

    public init(slug: String, name: String, factCount: Int, reportedCount: Int, lastResearchedAt: String?) {
        self.slug = slug
        self.name = name
        self.factCount = factCount
        self.reportedCount = reportedCount
        self.lastResearchedAt = lastResearchedAt
    }
}

/// The company itself, as the insights payload names it.
public struct CompanyDetails: Decodable, Equatable, Sendable {
    public let slug: String
    public let name: String
    public let website: String?
    public let lastResearchedAt: String?

    public init(slug: String, name: String, website: String? = nil, lastResearchedAt: String? = nil) {
        self.slug = slug
        self.name = name
        self.website = website
        self.lastResearchedAt = lastResearchedAt
    }

    private enum CodingKeys: String, CodingKey {
        case slug, name, website
        case lastResearchedAt = "last_researched_at"
    }
}

/// Everything Skillit has learned about one company, as `GET /api/memory/:slug` returns it.
public struct CompanyInsights: Decodable, Equatable, Sendable {
    public let company: CompanyDetails
    public let facts: [CompanyFact]
    /// Real reports from people; they only surface as questions once there are three.
    public let reportCount: Int
    public let questions: [ReportedQuestion]

    public init(company: CompanyDetails, facts: [CompanyFact], reportCount: Int, questions: [ReportedQuestion]) {
        self.company = company
        self.facts = facts
        self.reportCount = reportCount
        self.questions = questions
    }
}

public struct CompanyFact: Decodable, Equatable, Sendable, Identifiable, Hashable {
    public enum Kind: String, Decodable, Sendable, CaseIterable {
        case about, hiring, interview, interviewProcess = "interview_process", tech, news
    }

    public let kind: Kind
    public let text: String
    public let sourceURL: String
    public let fetchedAt: String?

    public var id: String {
        "\(kind.rawValue):\(text)"
    }

    public init(kind: Kind, text: String, sourceURL: String, fetchedAt: String? = nil) {
        self.kind = kind
        self.text = text
        self.sourceURL = sourceURL
        self.fetchedAt = fetchedAt
    }

    private enum CodingKeys: String, CodingKey {
        case kind, text
        case sourceURL = "source_url"
        case fetchedAt = "fetched_at"
    }
}

/// A question people were asked at this company. `isExample` ones were seeded, not reported.
public struct ReportedQuestion: Decodable, Equatable, Sendable, Identifiable {
    public let text: String
    public let count: Int
    public let isExample: Bool
    /// Month only, like "2026-10": the server never gives a day, so one report can't be traced back.
    public let lastReportedMonth: String?

    public var id: String {
        text
    }

    public init(text: String, count: Int, isExample: Bool, lastReportedMonth: String? = nil) {
        self.text = text
        self.count = count
        self.isExample = isExample
        self.lastReportedMonth = lastReportedMonth
    }

    private enum CodingKeys: String, CodingKey {
        case text, count
        case isExample = "example"
        case lastReportedMonth = "last_reported_at"
    }
}

/// What `POST /api/research/:slug` reports once the research agent has finished.
public struct ResearchRun: Decodable, Equatable, Sendable {
    public let status: String
    /// New facts saved this run.
    public let added: Int
    public let summary: String

    public init(status: String, added: Int, summary: String) {
        self.status = status
        self.added = added
        self.summary = summary
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "done"
        added = try container.decodeIfPresent(Int.self, forKey: .added) ?? 0
        summary = try container.decodeIfPresent(String.self, forKey: .summary) ?? ""
    }

    private enum CodingKeys: String, CodingKey { case status, added, summary }
}
