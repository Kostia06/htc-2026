import Foundation
import Observation
import RavenKit

/// The For you feed: opens on the last feed from disk, then refreshes it quietly from the server.
@Observable
final class ForYouModel {
    private(set) var timeline: FeedTimeline
    /// The server is assembling a fresher feed; shown as a calm row, never as a spinner over the cards.
    private(set) var isBuilding = false
    private(set) var isLoadingMore = false
    /// Only true before anything has ever loaded on this device; that is the one time skeletons show.
    private(set) var hasLoaded: Bool
    private(set) var errorMessage: String?

    private let cache: FeedCache
    private var refreshTask: Task<Void, Never>?

    private static let buildPollInterval: Duration = .seconds(2)
    private static let maxBuildPolls = 15

    init(cache: FeedCache = .standard) {
        self.cache = cache
        let saved = cache.load()
        timeline = saved ?? FeedTimeline()
        hasLoaded = saved != nil
    }

    var cards: [FeedCard] {
        timeline.cards
    }

    /// Joins a refresh already in flight, so the prefetch at launch and the tab appearing don't fetch twice.
    func refresh(using client: RavenClient) async {
        if let refreshTask {
            return await refreshTask.value
        }
        let task = Task { await fetchFirstPage(using: client) }
        refreshTask = task
        await task.value
        refreshTask = nil
    }

    func loadMore(using client: RavenClient) async {
        guard let cursor = timeline.nextCursor, !isLoadingMore, refreshTask == nil else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        guard let page = try? await client.feed(cursor: cursor) else { return }
        timeline.apply(nextPage: page)
        cache.save(timeline)
    }

    /// Sign-out: the next person on this phone must not see this feed.
    func forget() {
        refreshTask?.cancel()
        cache.clear()
        timeline = FeedTimeline()
        hasLoaded = false
        isBuilding = false
    }

    /// While the server builds, ask again every couple of seconds until the new feed lands.
    private func fetchFirstPage(using client: RavenClient) async {
        for _ in 0 ..< Self.maxBuildPolls {
            do {
                let page = try await client.feed()
                show(page)
                guard page.building else { return }
            } catch {
                // with cards on screen a failed refresh stays silent; the cached feed is still useful
                if timeline.cards.isEmpty {
                    errorMessage = error.message
                }
                isBuilding = false
                return
            }
            try? await Task.sleep(for: Self.buildPollInterval)
            if Task.isCancelled {
                return
            }
        }
        isBuilding = false
    }

    private func show(_ page: FeedPage) {
        timeline.apply(firstPage: page)
        isBuilding = page.building
        errorMessage = nil
        if !page.building || !page.items.isEmpty {
            hasLoaded = true
            cache.save(timeline)
        }
    }
}

#if DEBUG
    extension ForYouModel {
        /// A model for screenshots that never touches the disk cache or the network.
        static func preview(cards: [FeedCard], isBuilding: Bool = false) -> ForYouModel {
            let file = URL.temporaryDirectory.appending(path: "for-you-preview-\(UUID()).json")
            let model = ForYouModel(cache: FeedCache(file: file))
            model.timeline = FeedTimeline(cards: cards)
            model.hasLoaded = !cards.isEmpty
            model.isBuilding = isBuilding
            return model
        }
    }
#endif
