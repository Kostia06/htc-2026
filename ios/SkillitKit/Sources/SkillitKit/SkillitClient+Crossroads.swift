import Foundation

public extension SkillitClient {
    /// Everything the Crossroads screen shows. Opening it also finishes the person's Crossroads step on their road.
    func crossroads() async throws(SkillitError) -> Crossroads {
        try await send(authorized("GET", "api/crossroads"))
    }

    /// One question about how the person's notes line up with their road; the conversation so far goes back each time.
    func askCrossroads(_ request: QuickUpdateRequest) async throws(SkillitError) -> CrossroadsAnswer {
        try await send(authorized("POST", "api/crossroads/ask", json: request))
    }

    /// "That's me too", or taking it back. The line comes back nil while it is still under three people.
    func standBehind(lineID: String, _ behind: Bool) async throws(SkillitError) -> RoadLine? {
        let response: MeTooResponse = try await send(authorized(behind ? "POST" : "DELETE", "api/crossroads/lines/\(lineID)/me-too"))
        return response.line
    }
}

private struct MeTooResponse: Decodable {
    let line: RoadLine?
}
