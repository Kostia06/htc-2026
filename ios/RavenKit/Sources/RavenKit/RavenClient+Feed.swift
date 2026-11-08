import Foundation

public extension RavenClient {
    /// One page of a section of the precomputed feed. Pass the previous page's `nextCursor` for the next one.
    func feed(section: FeedSection = .all, cursor: String? = nil) async throws(RavenError) -> FeedPage {
        var request = try await authorized("GET", "api/feed")
        var query = [URLQueryItem(name: "section", value: section.rawValue)]
        if let cursor {
            query.append(URLQueryItem(name: "cursor", value: cursor))
        }
        request.url = request.url?.appending(queryItems: query)
        // the server only reads a table, so a slow answer means a bad network; fail fast and show the cached feed
        request.timeoutInterval = 15
        return try await send(request)
    }

    /// Saves or dismisses one card. Dismissed cards never come back and steer the next build away from their tags.
    func act(_ action: FeedCardAction, on cardId: String) async throws(RavenError) {
        var request = try await authorized("POST", "api/feed/items/\(cardId)", json: ActionBody(action: action))
        request.timeoutInterval = 15
        let _: ActionResponse = try await send(request)
    }
}

private struct ActionBody: Encodable { let action: FeedCardAction }
private struct ActionResponse: Decodable { let action: FeedCardAction }
