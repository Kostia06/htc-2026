import Foundation
@testable import SkillitKit
import Testing

extension StubbedNetworkTests {
    struct NotificationsTests {
        let client = SkillitClientTests.client(accessToken: { "t0k" })

        private static let page = #"""
        {"items":[
        {"id":"nt_1","kind":"deadline","title":"Calgary Hacks is in 2 days","body":"You saved this","target":{"type":"feed","id":"hack"},
         "createdAt":"2026-11-08T18:00:00.000Z","readAt":null,"pushed":true},
        {"id":"nt_2","kind":"brand_new_kind","title":"New","body":"b","target":{"type":"company","slug":"shopify"},
         "createdAt":"2026-11-07T10:00:00.000Z","readAt":"2026-11-07T11:00:00.000Z","pushed":false}],
        "nextCursor":"2026-11-07T10:00:00.000Z|nt_2","unread":1,"quiet":false}
        """#

        @Test func `reads a page with targets, unknown kinds and the unread count`() async throws {
            StubProtocol.routes.withLock { $0["GET /api/notifications"] = (200, Self.page) }
            let page = try await client.notifications()
            #expect(page.unread == 1)
            #expect(page.items[0].kind == .deadline)
            #expect(page.items[0].target == .feed(id: "hack"))
            #expect(page.items[1].kind == .other)
            #expect(page.items[1].target == .company(slug: "shopify"))
            #expect(page.items[1].isRead)
        }

        @Test func `marks chosen ids read`() async throws {
            let route = "POST /api/notifications/read"
            StubProtocol.routes.withLock { $0[route] = (200, #"{"marked":1,"unread":0}"#) }
            let unread = try await client.markNotificationsRead(ids: ["nt_1"])
            #expect(unread == 0)
            let body = try #require(StubProtocol.bodies.withLock { $0[route] })
            #expect(String(bytes: body, encoding: .utf8) == #"{"ids":["nt_1"]}"#)
        }

        @Test func `sends the device token as lowercase hex`() async throws {
            let route = "POST /api/notifications/devices"
            StubProtocol.routes.withLock { $0[route] = (201, #"{"ok":true}"#) }
            try await client.registerPushDevice(token: Data([0x0F, 0xAB, 0x00]))
            let body = try #require(StubProtocol.bodies.withLock { $0[route] })
            let sent = try JSONDecoder().decode([String: String].self, from: body)
            #expect(sent == ["token": "0fab00", "platform": "ios"])
        }
    }
}

struct NotificationGroupingTests {
    private func item(_ id: String, at iso: String, read: Bool = false, pushed: Bool = false) -> SkillitNotification {
        SkillitNotification(id: id, kind: .feedMatch, title: id, body: "", target: .feed(id: id), createdAt: iso, readAt: read ? iso : nil, pushed: pushed)
    }

    @Test func `splits into Today and Earlier and drops empty groups`() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "America/Edmonton"))
        let now = try #require(RelativeTime.date(from: "2026-11-08T20:00:00.000Z"))
        let items = [item("a", at: "2026-11-08T18:00:00.000Z"), item("b", at: "2026-11-07T18:00:00.000Z")]
        let groups = items.groupedByDay(now: now, calendar: calendar)
        #expect(groups.map(\.title) == ["Today", "Earlier"])
        #expect(groups[0].items.map(\.id) == ["a"])
        #expect([item("b", at: "2026-11-07T18:00:00.000Z")].groupedByDay(now: now, calendar: calendar).map(\.title) == ["Earlier"])
    }

    @Test func `posts locally only what is unread, unseen here, and not already pushed`() {
        let items = [item("new", at: "x"), item("seen", at: "x"), item("read", at: "x", read: true), item("pushed", at: "x", pushed: true)]
        #expect(items.awaitingLocalDelivery(alreadyShown: ["seen"], receivesPush: true).map(\.id) == ["new"])
        #expect(items.awaitingLocalDelivery(alreadyShown: ["seen"], receivesPush: false).map(\.id) == ["new", "pushed"])
    }
}
