import Foundation

public extension RavenClient {
    /// The saved resume, or the profile laid out as one when nothing has been saved yet.
    func resume() async throws(RavenError) -> SavedResume {
        try await send(authorized("GET", "api/resume"))
    }

    /// Replaces the whole resume; the server answers with what it kept.
    func saveResume(_ resume: Resume) async throws(RavenError) -> Resume {
        let saved: SavedResume = try await send(authorized("PUT", "api/resume", json: resume))
        return saved.resume
    }

    /// Asks the coach for rewrites of one section, or of everything. Nothing is applied until the person accepts.
    func improveResume(section: Resume.Section? = nil) async throws(RavenError) -> [ResumeSuggestion] {
        let response: ImproveResponse = try await send(authorized("POST", "api/resume/improve", json: ImproveBody(section: section)))
        return response.suggestions
    }

    /// The one-page PDF as bytes. Fetched through `session` so previews and tests can stub it.
    func resumePDF(using session: URLSession = .shared) async throws(RavenError) -> Data {
        let request = try await authorized("GET", "api/resume/pdf")
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw .offline
        }
        guard let http = response as? HTTPURLResponse else { throw .unreadableResponse }
        switch http.statusCode {
        case 200 ..< 300: return data
        case 401: throw .unauthorized
        default: throw .rejected(status: http.statusCode, message: "The PDF couldn't be made. Try again.")
        }
    }
}

private struct ImproveBody: Encodable { let section: Resume.Section? }
private struct ImproveResponse: Decodable { let suggestions: [ResumeSuggestion] }
