import Foundation
import Observation
import SkillitKit

/// The For you feed by section: opens on the last For you page from disk, then refreshes each section quietly as it's shown.
@MainActor
@Observable
final class ForYouModel {
    private(set) var section: FeedSection = .all
    private(set) var timelines: [FeedSection: FeedTimeline] = [:]
    // kept per section: the For you poll keeps running after you switch to Jobs, and its state must not leak there
    private var buildingSections: Set<FeedSection> = []
    private var loadingMoreSections: Set<FeedSection> = []
    private var errors: [FeedSection: String] = [:]
    /// Bumps once per dismissed card, so the view plays one haptic per swipe.
    private(set) var dismissals = 0

    private let cache: FeedCache
    private var refreshTasks: [FeedSection: Task<Void, Never>] = [:]

    private static let buildPollInterval: Duration = .seconds(2)
    private static let maxBuildPolls = 15

    init(cache: FeedCache = .standard) {
        self.cache = cache
        if let saved = cache.load() {
            timelines[.all] = saved
        }
    }

    var cards: [FeedCard] {
        timelines[section]?.cards ?? []
    }

    /// False only before this section has ever loaded on this device; that is the one time skeletons show.
    var hasLoaded: Bool {
        timelines[section] != nil
    }

    /// The server is assembling a fresher feed for this section; shown as a calm row, never as a spinner over the cards.
    var isBuilding: Bool {
        buildingSections.contains(section)
    }

    var isLoadingMore: Bool {
        loadingMoreSections.contains(section)
    }

    var errorMessage: String? {
        errors[section]
    }

    func show(_ section: FeedSection) {
        self.section = section
    }

    /// Joins a refresh already in flight, so the prefetch at launch and the tab appearing don't fetch twice.
    func refresh(using client: SkillitClient) async {
        let section = section
        if let running = refreshTasks[section] {
            return await running.value
        }
        // a retry shows skeletons (or the cards) again rather than the old error while it waits
        errors[section] = nil
        let task = Task { await fetchFirstPage(of: section, using: client) }
        refreshTasks[section] = task
        await task.value
        refreshTasks[section] = nil
    }

    func loadMore(using client: SkillitClient) async {
        let section = section
        guard let cursor = timelines[section]?.nextCursor, !loadingMoreSections.contains(section), refreshTasks[section] == nil else {
            return
        }
        loadingMoreSections.insert(section)
        defer { loadingMoreSections.remove(section) }
        guard let page = try? await client.feed(section: section, cursor: cursor) else { return }
        timelines[section]?.apply(nextPage: page)
        persist(section)
    }

    /// Fills the bookmark everywhere at once and puts the card at the top of Saved; the server call follows.
    func save(_ card: FeedCard, using client: SkillitClient) {
        guard !card.isSaved else { return }
        for key in timelines.keys {
            timelines[key]?.mark(id: card.id, saved: true)
        }
        var kept = card
        kept.saved = true
        timelines[.saved, default: FeedTimeline()].insert(kept, at: 0)
        persist(.all)
        Task {
            await send(.save, for: card, using: client) {
                for key in timelines.keys {
                    timelines[key]?.mark(id: card.id, saved: false)
                }
                timelines[.saved]?.remove(id: card.id)
            }
        }
    }

    /// The card leaves every section right away; if the server refuses, it slides back where it was.
    func dismiss(_ card: FeedCard, using client: SkillitClient) {
        var removed: [FeedSection: Int] = [:]
        for key in timelines.keys {
            if let gone = timelines[key]?.remove(id: card.id) {
                removed[key] = gone.index
            }
        }
        dismissals += 1
        persist(.all)
        Task {
            await send(.dismiss, for: card, using: client) {
                for (key, index) in removed {
                    timelines[key]?.insert(card, at: index)
                }
            }
        }
    }

    /// Sign-out: the next person on this phone must not see this feed.
    func forget() {
        refreshTasks.values.forEach { $0.cancel() }
        refreshTasks = [:]
        cache.clear()
        timelines = [:]
        section = .all
        buildingSections = []
        loadingMoreSections = []
        errors = [:]
    }

    private func send(_ action: FeedCardAction, for card: FeedCard, using client: SkillitClient, orRevert revert: () -> Void) async {
        do {
            try await client.act(action, on: card.id)
        } catch {
            revert()
            persist(.all)
        }
    }

    /// While the server builds, ask again every couple of seconds until the new feed lands.
    private func fetchFirstPage(of section: FeedSection, using client: SkillitClient) async {
        for _ in 0 ..< Self.maxBuildPolls {
            do {
                let page = try await client.feed(section: section)
                apply(page, to: section)
                guard page.building else { return }
            } catch {
                // with cards on screen a failed refresh stays silent; the cached feed is still useful
                if timelines[section]?.cards.isEmpty ?? true {
                    errors[section] = error.message
                }
                buildingSections.remove(section)
                return
            }
            try? await Task.sleep(for: Self.buildPollInterval)
            if Task.isCancelled {
                return
            }
        }
        buildingSections.remove(section)
        // still building after every poll: show the empty state rather than skeletons that never end
        if timelines[section] == nil {
            timelines[section] = FeedTimeline()
        }
    }

    private func apply(_ page: FeedPage, to section: FeedSection) {
        var timeline = timelines[section] ?? FeedTimeline()
        timeline.apply(firstPage: page)
        if page.building {
            buildingSections.insert(section)
        } else {
            buildingSections.remove(section)
        }
        errors[section] = nil
        if !page.building || !page.items.isEmpty {
            timelines[section] = timeline
            persist(section)
        }
    }

    /// Only For you is kept on disk; it is what the tab opens on.
    private func persist(_ section: FeedSection) {
        guard section == .all, let timeline = timelines[.all] else { return }
        cache.save(timeline)
    }
}

#if DEBUG
    extension ForYouModel {
        /// A model for screenshots that never touches the disk cache or the network.
        static func preview(cards: [FeedCard], isBuilding: Bool = false, section: FeedSection = .all) -> ForYouModel {
            let file = URL.temporaryDirectory.appending(path: "for-you-preview-\(UUID()).json")
            let model = ForYouModel(cache: FeedCache(file: file))
            if !cards.isEmpty {
                let byKind: [FeedSection: FeedCard.Kind] = [.jobs: .job, .events: .event, .hackathons: .hackathon, .courses: .course]
                model.timelines[.all] = FeedTimeline(cards: cards)
                for (key, kind) in byKind {
                    model.timelines[key] = FeedTimeline(cards: cards.filter { $0.kind == kind })
                }
                model.timelines[.saved] = FeedTimeline(cards: cards.filter(\.isSaved))
            }
            model.section = section
            if isBuilding {
                model.buildingSections.insert(section)
            }
            return model
        }
    }
#endif
