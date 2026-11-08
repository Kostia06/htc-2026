import Foundation
@testable import RavenKit
import Testing

extension StubbedNetworkTests {
    struct FeedTests {
        let client = RavenClientTests.client(accessToken: { "t0k" })

        private static let page = #"""
        {"items":[{"id":"job:501","kind":"job","title":"Junior Developer","org":"Acme","when":"2026-11-01T10:00:00Z",
        "where":"Calgary, Alberta","why":"Fits your goal: Junior developer","url":"https://www.adzuna.ca/details/501",
        "source":"Adzuna","attribution":{"label":"Jobs by Adzuna","url":"https://www.adzuna.ca"}},
        {"id":"x","kind":"meetup","title":"Demo night","org":"Platform","why":"Near you","url":"https://example.org","source":"Other"}],
        "nextCursor":"20","building":false,"builtAt":"2026-11-07T00:00:00Z"}
        """#

        @Test func `decodes a page with Adzuna's attribution and the cursor`() async throws {
            StubProtocol.routes.withLock { $0["GET /api/feed"] = (200, Self.page) }
            let page = try await client.feed()
            #expect(page.nextCursor == "20")
            #expect(try page.items[0].attribution == .init(label: "Jobs by Adzuna", url: #require(URL(string: "https://www.adzuna.ca"))))
            #expect(page.items[0].where == "Calgary, Alberta")
            #expect(page.items[0].date != nil)
        }

        @Test func `reads an unknown kind as an event instead of failing the page`() async throws {
            StubProtocol.routes.withLock { $0["GET /api/feed"] = (200, Self.page) }
            let page = try await client.feed()
            #expect(page.items[1].kind == .event)
            #expect(page.items[1].when == nil)
        }

        @Test func `decodes the empty page sent while the first feed is built`() async throws {
            StubProtocol.routes.withLock { $0["GET /api/feed"] = (200, #"{"items":[],"nextCursor":null,"building":true,"builtAt":null}"#) }
            #expect(try await client.feed() == FeedPage(items: [], nextCursor: nil, building: true))
        }
    }
}

@Test func feedCardKeepsTheListingSummaryAndSalaryWhenTheServerSendsThem() throws {
    let json = Data(#"""
    {"id":"job:1","kind":"job","title":"Data analyst","org":"ATB","why":"Matches SQL","url":"https://adzuna.ca/1",
     "source":"Adzuna","summary":"Build dashboards in Power BI.","salary":"$55,000–$65,000"}
    """#.utf8)
    let card = try JSONDecoder().decode(FeedCard.self, from: json)
    #expect(card.summary == "Build dashboards in Power BI.")
    #expect(card.salary == "$55,000–$65,000")
    #expect(card.reasons == nil)
    #expect(card.level == nil)
}

@Test func feedCardDecodesTheReasonsAndWhatThePageSaidAboutTheItem() throws {
    let json = Data(#"""
    {"id":"hackathon:hacked","kind":"hackathon","title":"HackED Beta","org":"CompE Club","why":"Fits your goal: Junior developer",
     "reasons":["Fits your goal: Junior developer","Beginner friendly, good first hackathon","Uses AI like you do"],
     "summary":"A weekend hackathon for students new to hacking.","level":"beginner","format":"24-hour, in person",
     "highlights":["Free to enter","Prizes for top teams"],"url":"https://hacked.compeclub.com/","source":"Curated"}
    """#.utf8)
    let card = try JSONDecoder().decode(FeedCard.self, from: json)
    #expect(card.reasons?.count == 3)
    #expect(card.reasons?.first == card.why)
    #expect(card.level == "beginner")
    #expect(card.format == "24-hour, in person")
    #expect(card.highlights == ["Free to enter", "Prizes for top teams"])
    #expect(card.summary?.hasPrefix("A weekend hackathon") == true)
}
