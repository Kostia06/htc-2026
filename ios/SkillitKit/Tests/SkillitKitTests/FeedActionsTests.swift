import Foundation
@testable import SkillitKit
import Testing

extension StubbedNetworkTests {
    struct FeedActionsTests {
        let client = SkillitClientTests.client(accessToken: { "t0k" })

        private static let page = #"""
        {"items":[{"id":"event:calgary-ux-meetup","kind":"event","title":"Calgary UX monthly meetup","org":"Calgary UX",
        "when":"ongoing","where":"Calgary","why":"In your field: design","url":"https://www.meetup.com/calgaryux/",
        "source":"Curated","tags":["ux","design"],"saved":true},
        {"id":"hackathon:hacked-beta-2026","kind":"hackathon","title":"HackED Beta","org":"U of A","when":"2026-11-13",
        "where":"Edmonton, AB","why":"Coming up Nov 13","url":"https://hacked.compeclub.com/","source":"Curated"}],
        "nextCursor":null,"building":false,"builtAt":"2026-11-07T00:00:00Z","section":"events"}
        """#

        @Test func `asks for a section and reads saved flags, tags and day-only dates`() async throws {
            StubProtocol.routes.withLock { $0["GET /api/feed"] = (200, Self.page) }
            let page = try await client.feed(section: .events)
            #expect(page.section == .events)
            #expect(page.items[0].isSaved)
            #expect(page.items[0].tags == ["ux", "design"])
            #expect(page.items[0].date == nil)
            #expect(!page.items[1].isSaved)
            #expect(page.items[1].date != nil)
        }

        @Test func `posts a save or dismiss for one card`() async throws {
            let route = "POST /api/feed/items/event:calgary-ux-meetup"
            StubProtocol.routes.withLock { $0[route] = (200, #"{"id":"event:calgary-ux-meetup","action":"dismiss"}"#) }
            try await client.act(.dismiss, on: "event:calgary-ux-meetup")
            let body = try #require(StubProtocol.bodies.withLock { $0[route] })
            #expect(String(bytes: body, encoding: .utf8) == #"{"action":"dismiss"}"#)
        }
    }
}

struct FeedTimelineEditingTests {
    private func card(_ id: String, saved: Bool = false) -> FeedCard {
        FeedCard(
            id: id, kind: .event, title: id, org: "Org", why: "Open to everyone", url: URL(string: "https://example.org/\(id)")!,
            source: "Curated", saved: saved,
        )
    }

    @Test func `removing a card keeps the rest in order`() {
        var timeline = FeedTimeline(cards: [card("a"), card("b"), card("c")], nextCursor: "3")
        let removed = timeline.remove(id: "b")
        #expect(removed?.index == 1)
        #expect(timeline.cards.map(\.id) == ["a", "c"])
        #expect(timeline.remove(id: "zzz") == nil)
    }

    @Test func `a removed card can be put back where it was`() {
        var timeline = FeedTimeline(cards: [card("a"), card("c")], nextCursor: nil)
        timeline.insert(card("b"), at: 1)
        #expect(timeline.cards.map(\.id) == ["a", "b", "c"])
        timeline.insert(card("z"), at: 99)
        #expect(timeline.cards.last?.id == "z")
    }

    @Test func `marking saved flips only that card`() {
        var timeline = FeedTimeline(cards: [card("a"), card("b")], nextCursor: nil)
        timeline.mark(id: "a", saved: true)
        #expect(timeline.cards.map(\.isSaved) == [true, false])
        timeline.mark(id: "a", saved: false)
        #expect(timeline.cards.map(\.isSaved) == [false, false])
    }
}
