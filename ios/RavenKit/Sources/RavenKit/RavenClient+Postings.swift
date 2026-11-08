import Foundation

public extension RavenClient {
    /// Reads a posting from its link or text and sets the person up for it. A 422 means the site can't be read: send the text instead.
    func importPosting(_ request: PostingImportRequest) async throws(RavenError) -> JobPosting {
        try await send(authorized("POST", "api/postings", json: request))
    }

    func postings() async throws(RavenError) -> [JobPosting] {
        let response: PostingsResponse = try await send(authorized("GET", "api/postings"))
        return response.postings
    }

    func posting(id: String) async throws(RavenError) -> JobPosting {
        try await send(authorized("GET", "api/postings/\(id)"))
    }
}

public extension RavenError {
    /// The server could not read the posting's page and wants the text pasted instead.
    var needsPostingText: Bool {
        if case let .rejected(status, _) = self { return status == 422 }
        return false
    }
}

private struct PostingsResponse: Decodable { let postings: [JobPosting] }
