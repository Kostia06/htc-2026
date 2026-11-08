import Foundation

public extension SkillitClient {
    /// The first page with no cursor; after that, pass the page's `nextCursor`. The server groups finished steps by day in `timeZone`.
    func roadmap(cursor: String? = nil, timeZone: TimeZone = .current) async throws(SkillitError) -> RoadmapPage {
        try await send(roadmapRequest(cursor: cursor, timeZone: timeZone))
    }

    /// Records a status and, when finishing, the person's own note about what they did. Returns the step as the server now has it.
    func update(step stepId: String, status: RoadmapStep.Status, note: String? = nil) async throws(SkillitError) -> RoadmapStep {
        try await send(authorized("POST", "api/roadmap/steps/\(stepId)", json: StepUpdateBody(status: status, note: note)))
    }
}

extension SkillitClient {
    func roadmapRequest(cursor: String?, timeZone: TimeZone) async throws(SkillitError) -> URLRequest {
        var request = try await authorized("GET", "api/roadmap")
        var items = [URLQueryItem(name: "tz", value: timeZone.identifier)]
        if let cursor {
            items.insert(URLQueryItem(name: "cursor", value: cursor), at: 0)
        }
        request.url = request.url?.appending(queryItems: items)
        return request
    }
}

private struct StepUpdateBody: Encodable {
    let status: RoadmapStep.Status
    let note: String?
}
