import Foundation
import Observation
import RavenKit

/// The researched companies: opens on the last list from disk, then refreshes it quietly from the server.
@Observable
final class CompaniesModel {
    private(set) var companies: [CompanySummary]
    /// Only true before anything has ever loaded on this device; that is the one time skeletons show.
    private(set) var hasLoaded: Bool
    private(set) var isRefreshing = false
    private(set) var errorMessage: String?

    private let service: any CompanyService
    private let cache: CompaniesCache

    init(service: any CompanyService, cache: CompaniesCache = CompaniesCache()) {
        self.service = service
        self.cache = cache
        let saved = cache.load()
        companies = saved ?? []
        hasLoaded = saved != nil
    }

    func refresh() async {
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            companies = try await service.companies()
            hasLoaded = true
            errorMessage = nil
            cache.save(companies)
        } catch {
            errorMessage = error.message
        }
    }
}
