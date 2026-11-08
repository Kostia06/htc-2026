import Foundation
import RavenKit

/// Where company research comes from: the server in the app, sample data in previews and screenshots.
protocol CompanyService: Sendable {
    func companies() async throws(RavenError) -> [CompanySummary]
    func companyInsights(slug: String) async throws(RavenError) -> CompanyInsights
    func refreshResearch(slug: String) async throws(RavenError) -> ResearchRun
    func submitExperience(_ report: ExperienceReport) async throws(RavenError)
}

extension RavenClient: CompanyService {}

/// Used only if a company screen is shown before sign-in finished; every call reports the app as offline.
struct UnavailableCompanies: CompanyService {
    func companies() async throws(RavenError) -> [CompanySummary] {
        throw .offline
    }

    func companyInsights(slug _: String) async throws(RavenError) -> CompanyInsights {
        throw .offline
    }

    func refreshResearch(slug _: String) async throws(RavenError) -> ResearchRun {
        throw .offline
    }

    func submitExperience(_: ExperienceReport) async throws(RavenError) {
        throw .offline
    }
}

extension AppModel {
    var companyService: any CompanyService {
        client ?? UnavailableCompanies()
    }
}

/// The companies list, kept on disk so the screen opens on the last list while the server answers.
struct CompaniesCache: Sendable {
    private let file: URL

    init(file: URL = URL.cachesDirectory.appending(path: "companies.json")) {
        self.file = file
    }

    func load() -> [CompanySummary]? {
        guard let data = try? Data(contentsOf: file) else { return nil }
        return try? JSONDecoder().decode([CompanySummary].self, from: data)
    }

    func save(_ companies: [CompanySummary]) {
        guard let data = try? JSONEncoder().encode(companies) else { return }
        try? data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
}
