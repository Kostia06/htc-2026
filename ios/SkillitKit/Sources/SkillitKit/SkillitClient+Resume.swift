import Foundation

public extension SkillitClient {
    /// The saved resume, or the profile laid out as one when nothing has been saved yet.
    func resume() async throws(SkillitError) -> SavedResume {
        try await send(authorized("GET", "api/resume"))
    }

    /// Replaces the whole resume; the server answers with what it kept.
    func saveResume(_ resume: Resume) async throws(SkillitError) -> Resume {
        let saved: SavedResume = try await send(authorized("PUT", "api/resume", json: resume))
        return saved.resume
    }

    /// Asks the coach for rewrites of one section, or of everything. Nothing is applied until the person accepts.
    func improveResume(section: Resume.Section? = nil) async throws(SkillitError) -> [ResumeSuggestion] {
        let response: ImproveResponse = try await send(authorized("POST", "api/resume/improve", json: ImproveBody(section: section)))
        return response.suggestions
    }
}

private struct ImproveBody: Encodable { let section: Resume.Section? }
private struct ImproveResponse: Decodable { let suggestions: [ResumeSuggestion] }
