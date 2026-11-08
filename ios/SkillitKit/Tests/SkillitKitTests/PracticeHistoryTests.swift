import Foundation
@testable import SkillitKit
import Testing

struct PracticeHistoryTests {
    @Test func `decodes a replayed session with scored and unscored turns`() throws {
        let json = #"""
        {"id":"s1","mode":"interview","companySlug":"atb","status":"finished","createdAt":"2026-11-07T08:00:00.000Z",
         "turns":[{"idx":0,"question":"Q1","answer":"A1","scores":{"structure":4,"relevance":2},
                   "delivery":{"words":10,"fillerWords":1,"wordsPerMinute":120},"tip":"Slow down"},
                  {"idx":1,"question":"Q2","answer":"A2","scores":{},
                   "delivery":{"words":3,"fillerWords":0,"wordsPerMinute":null},"tip":"Keep going"}]}
        """#
        let detail = try JSONDecoder().decode(PracticeSessionDetail.self, from: Data(json.utf8))
        #expect(detail.turns.count == 2)
        // {4, 2} average 3 on the 1-5 ratings, which the report shows as 50 out of 100
        #expect(detail.turns[0].score == 50)
        #expect(detail.turns[1].score == nil)
        #expect(detail.turns[0].delivery?.fillerWords == 1)
    }

    @Test func `appending a page skips sessions already shown`() {
        var page = PracticeHistoryPage(sessions: [.sample(id: "a"), .sample(id: "b")], nextCursor: "c1")
        page.append(PracticeHistoryPage(sessions: [.sample(id: "b"), .sample(id: "c")], nextCursor: nil))
        #expect(page.sessions.map(\.id) == ["a", "b", "c"])
        #expect(page.nextCursor == nil)
    }
}

struct RelativeTimeTests {
    @Test func `parses both ISO forms the server uses`() {
        #expect(RelativeTime.date(from: "2026-11-07T08:00:00.000Z") != nil)
        #expect(RelativeTime.date(from: "2026-11-07T08:00:00Z") != nil)
        #expect(RelativeTime.date(from: "yesterday") == nil)
        #expect(RelativeTime.date(from: nil) == nil)
    }

    @Test func `phrases scale from seconds to days`() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        #expect(RelativeTime.phrase(for: now.addingTimeInterval(-10), now: now) == "just now")
        #expect(RelativeTime.phrase(for: now.addingTimeInterval(-300), now: now) == "5 min ago")
        #expect(RelativeTime.phrase(for: now.addingTimeInterval(-7200), now: now) == "2 h ago")
        #expect(RelativeTime.phrase(for: now.addingTimeInterval(-3 * 86400), now: now) == "3 d ago")
    }
}

extension StubbedNetworkTests {
    struct PracticeHistoryClientTests {
        let client = SkillitClientTests.client(accessToken: { "t0k" })

        @Test func `fetches the history page and passes the cursor along`() async throws {
            StubProtocol.routes.withLock {
                $0["GET /api/voice/history"] = (
                    200,
                    #"""
                    {"sessions":[{"id":"s1","mode":"interview","companySlug":null,"companyName":null,"status":"finished",
                                  "createdAt":"2026-11-07T08:00:00.000Z","finishedAt":null,"score":3.5,"turnCount":2}],
                     "nextCursor":"2026-11-07T08:00:00.000Z"}
                    """#,
                )
            }
            let page = try await client.practiceHistory(cursor: "2026-11-08T00:00:00.000Z")
            #expect(page.sessions.first?.score == 3.5)
            #expect(page.nextCursor == "2026-11-07T08:00:00.000Z")
        }
    }
}

private extension PracticeSessionSummary {
    static func sample(id: String) -> PracticeSessionSummary {
        PracticeSessionSummary(id: id, mode: .interview, status: .finished, createdAt: "2026-11-07T08:00:00.000Z", score: 3, turnCount: 1)
    }
}
