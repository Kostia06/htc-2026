import Foundation

public extension RavenClient {
    func companies() async throws(RavenError) -> [CompanySummary] {
        let response: CompaniesResponse = try await send(authorized("GET", "api/companies"))
        return response.companies
    }

    func companyInsights(slug: String) async throws(RavenError) -> CompanyInsights {
        try await send(authorized("GET", "api/memory/\(slug)"))
    }

    /// Runs the research agent now. The server answers 429 when the company was researched in the last half hour.
    func refreshResearch(slug: String) async throws(RavenError) -> ResearchRun {
        try await send(authorized("POST", "api/research/\(slug)"))
    }
}

private struct CompaniesResponse: Decodable { let companies: [CompanySummary] }
