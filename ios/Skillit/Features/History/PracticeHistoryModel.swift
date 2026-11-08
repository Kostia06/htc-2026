import Foundation
import Observation
import SkillitKit

/// Past practice sessions, newest first, with the scores that feed the trend at the top.
@Observable
final class PracticeHistoryModel {
    private(set) var page: PracticeHistoryPage
    /// Only true before anything has ever loaded on this device; that is the one time skeletons show.
    private(set) var hasLoaded: Bool
    private(set) var isLoadingMore = false
    private(set) var errorMessage: String?

    private let service: any PracticeHistoryService
    private let cache: PracticeHistoryCache

    init(service: any PracticeHistoryService, cache: PracticeHistoryCache = PracticeHistoryCache()) {
        self.service = service
        self.cache = cache
        let saved = cache.load()
        page = saved ?? PracticeHistoryPage()
        hasLoaded = saved != nil
    }

    var sessions: [PracticeSessionSummary] {
        page.sessions
    }

    /// Scores of finished sessions, oldest first, so the sparkline reads left to right in time.
    var scoreTrend: [Double] {
        sessions.reversed().compactMap { $0.status == .finished ? $0.score : nil }
    }

    func refresh() async {
        do {
            page = try await service.practiceHistory(cursor: nil)
            hasLoaded = true
            errorMessage = nil
            cache.save(page)
        } catch {
            errorMessage = error.message
        }
    }

    func loadMore() async {
        guard let cursor = page.nextCursor, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        guard let next = try? await service.practiceHistory(cursor: cursor) else { return }
        page.append(next)
    }
}
