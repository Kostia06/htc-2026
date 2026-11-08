import Foundation

public extension SkillitClient {
    /// Takes a card back out of Saved. Unlike a dismissal it hides nothing and steers nothing; safe to repeat.
    func unsave(cardId: String) async throws(SkillitError) {
        var request = try await authorized("POST", "api/feed/items/\(cardId)", json: UnsaveBody())
        request.timeoutInterval = 15
        let _: UnsaveResponse = try await send(request)
    }

    /// The first page of a section, asking the server to search for new postings now; for pull to refresh only,
    /// since the server rebuilds behind the answer and the page that comes back still says `building`.
    func refreshedFeed(section: FeedSection = .all) async throws(SkillitError) -> FeedPage {
        var request = try await authorized("GET", "api/feed")
        request.url = request.url?.appending(queryItems: [
            URLQueryItem(name: "section", value: section.rawValue),
            URLQueryItem(name: "refresh", value: "1"),
        ])
        request.timeoutInterval = 15
        return try await send(request)
    }
}

private struct UnsaveBody: Encodable { let action = "unsave" }
private struct UnsaveResponse: Decodable { let action: String }
