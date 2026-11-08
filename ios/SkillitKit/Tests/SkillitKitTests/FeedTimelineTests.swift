import Foundation
@testable import SkillitKit
import Testing

struct FeedTimelineTests {
    private func card(_ id: String) -> FeedCard {
        FeedCard(id: id, kind: .job, title: id, org: "Acme", why: "Fits", url: URL(string: "https://example.org/\(id)")!, source: "Adzuna")
    }

    @Test func `a refreshed first page replaces what was there`() {
        var timeline = FeedTimeline(cards: [card("old")], nextCursor: "20")
        timeline.apply(firstPage: FeedPage(items: [card("a"), card("b")], nextCursor: nil, building: false))
        #expect(timeline.cards.map(\.id) == ["a", "b"])
        #expect(timeline.nextCursor == nil)
    }

    @Test func `keeps the cached cards while the server is still building an empty feed`() {
        var timeline = FeedTimeline(cards: [card("cached")], nextCursor: nil)
        timeline.apply(firstPage: FeedPage(items: [], nextCursor: nil, building: true))
        #expect(timeline.cards.map(\.id) == ["cached"])
    }

    @Test func `appends the next page without repeating a card that moved between pages`() {
        var timeline = FeedTimeline(cards: [card("a"), card("b")], nextCursor: "2")
        timeline.apply(nextPage: FeedPage(items: [card("b"), card("c")], nextCursor: "4", building: false))
        #expect(timeline.cards.map(\.id) == ["a", "b", "c"])
        #expect(timeline.nextCursor == "4")
    }

    @Test func `survives a round trip through the disk cache`() {
        let file = FileManager.default.temporaryDirectory.appending(path: "feed-\(UUID()).json")
        let cache = FeedCache(file: file)
        #expect(cache.load() == nil)
        let timeline = FeedTimeline(cards: [card("a")], nextCursor: "20")
        cache.save(timeline)
        #expect(cache.load() == timeline)
        cache.clear()
        #expect(cache.load() == nil)
    }

    @Test func `saves only the first pages so the cache stays small`() {
        let file = FileManager.default.temporaryDirectory.appending(path: "feed-\(UUID()).json")
        let cache = FeedCache(file: file)
        cache.save(FeedTimeline(cards: (0 ..< 100).map { card("\($0)") }, nextCursor: "100"))
        let saved = cache.load()
        #expect(saved?.cards.count == FeedCache.maxCards)
        #expect(saved?.nextCursor == "\(FeedCache.maxCards)")
    }
}
