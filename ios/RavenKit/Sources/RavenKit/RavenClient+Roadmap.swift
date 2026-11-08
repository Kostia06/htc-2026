import Foundation

public extension RavenClient {
    /// The first page with no cursor; after that, pass the page's `nextCursor`. The server generates units as you go.
    func roadmap(cursor: String? = nil) async throws(RavenError) -> RoadmapPage {
        try await send(roadmapRequest(cursor: cursor))
    }

    func setStatus(_ status: RoadmapStep.Status, ofStep stepId: String) async throws(RavenError) {
        let _: StepStatusResponse = try await send(authorized("POST", "api/roadmap/steps/\(stepId)", json: StepStatusBody(status: status)))
    }
}

extension RavenClient {
    func roadmapRequest(cursor: String?) async throws(RavenError) -> URLRequest {
        var request = try await authorized("GET", "api/roadmap")
        if let cursor {
            request.url = request.url?.appending(queryItems: [URLQueryItem(name: "cursor", value: cursor)])
        }
        return request
    }
}

private struct StepStatusBody: Encodable { let status: RoadmapStep.Status }
private struct StepStatusResponse: Decodable { let status: RoadmapStep.Status }
