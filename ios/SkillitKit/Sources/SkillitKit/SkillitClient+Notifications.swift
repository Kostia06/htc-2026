import Foundation

public extension SkillitClient {
    /// The first page also asks the server to look for anything new; the timezone keeps its quiet hours right.
    func notifications(cursor: String? = nil, timeZone: TimeZone = .current) async throws(SkillitError) -> NotificationPage {
        var request = try await authorized("GET", "api/notifications")
        var query = [URLQueryItem(name: "tz", value: timeZone.identifier)]
        if let cursor { query.append(URLQueryItem(name: "cursor", value: cursor)) }
        request.url = request.url?.appending(queryItems: query)
        request.timeoutInterval = 20
        return try await send(request)
    }

    /// Returns how many are still unread afterwards.
    @discardableResult
    func markNotificationsRead(ids: [String]) async throws(SkillitError) -> Int {
        let response: ReadResponse = try await send(authorized("POST", "api/notifications/read", json: ReadBody(ids: ids, all: nil)))
        return response.unread
    }

    @discardableResult
    func markAllNotificationsRead() async throws(SkillitError) -> Int {
        let response: ReadResponse = try await send(authorized("POST", "api/notifications/read", json: ReadBody(ids: nil, all: true)))
        return response.unread
    }

    func notificationPreferences() async throws(SkillitError) -> NotificationPreferences {
        try await send(authorized("GET", "api/notifications/settings"))
    }

    func setNotification(_ kind: NotificationKind, isOn: Bool) async throws(SkillitError) -> NotificationPreferences {
        try await send(authorized("PUT", "api/notifications/settings", json: PreferencesBody(kinds: [kind.rawValue: isOn])))
    }

    /// The APNs token as hex, exactly as Apple handed it over.
    func registerPushDevice(token: Data) async throws(SkillitError) {
        let hex = token.map { String(format: "%02x", $0) }.joined()
        let _: DeviceResponse = try await send(authorized("POST", "api/notifications/devices", json: DeviceBody(token: hex, platform: "ios")))
    }

    /// A card from the person's feed by id, for a notification that points at it.
    func feedCard(id: String) async throws(SkillitError) -> FeedCard {
        try await send(authorized("GET", "api/feed/items/\(id)"))
    }
}

private struct ReadBody: Encodable {
    let ids: [String]?
    let all: Bool?
}

private struct ReadResponse: Decodable { let unread: Int }
private struct PreferencesBody: Encodable { let kinds: [String: Bool] }
private struct DeviceBody: Encodable {
    let token: String
    let platform: String
}

private struct DeviceResponse: Decodable { let ok: Bool }
