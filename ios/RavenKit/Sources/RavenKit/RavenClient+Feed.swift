import Foundation

public extension RavenClient {
    /// The precomputed feed, one page at a time. Pass the previous page's `nextCursor` for the next one.
    func feed(cursor: String? = nil) async throws(RavenError) -> FeedPage {
        var request = try await authorized("GET", "api/feed")
        if let cursor, let url = request.url {
            request.url = url.appending(queryItems: [URLQueryItem(name: "cursor", value: cursor)])
        }
        // the server only reads a table, so a slow answer means a bad network; fail fast and show the cached feed
        request.timeoutInterval = 15
        return try await send(request)
    }
}
