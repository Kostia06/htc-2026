import Foundation
import Observation
import SkillitKit

/// The companies Skillit has researched: opens on the last list from disk, then refreshes it quietly from the server.
/// Shared app-wide, so a job card or a roadmap step can tell whether the company behind it has a page to open.
@Observable
final class CompaniesModel {
    private(set) var companies: [CompanySummary]
    private(set) var errorMessage: String?

    private let cache: CompaniesCache

    init(cache: CompaniesCache = CompaniesCache()) {
        self.cache = cache
        companies = cache.load() ?? []
    }

    func refresh(using service: any CompanyService) async {
        do {
            companies = try await service.companies()
            errorMessage = nil
            cache.save(companies)
        } catch {
            errorMessage = error.message
        }
    }

    /// The slug of the company a listing names, when Skillit knows it; the match ignores case and surrounding spaces.
    func slug(matching name: String) -> String? {
        let wanted = Self.key(name)
        guard !wanted.isEmpty else { return nil }
        return companies.first { Self.key($0.name) == wanted || $0.slug == wanted }?.slug
    }

    func name(for slug: String) -> String? {
        companies.first { $0.slug == slug }?.name
    }

    private static func key(_ name: String) -> String {
        name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
