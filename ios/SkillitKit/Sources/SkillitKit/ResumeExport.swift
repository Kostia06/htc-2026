import Foundation

/// The two layouts the server renders. `skillit` is the default look; `plain` is the bare page some postings ask for.
public enum ResumeTemplate: String, CaseIterable, Identifiable, Sendable {
    case skillit
    case plain

    public var id: String {
        rawValue
    }

    public var title: String {
        switch self {
        case .skillit: "Skillit"
        case .plain: "Plain (ATS)"
        }
    }
}

/// The file types a resume downloads as.
public enum ResumeFileFormat: String, CaseIterable, Identifiable, Sendable {
    case pdf
    case docx

    public var id: String {
        rawValue
    }

    public var title: String {
        switch self {
        case .pdf: "PDF"
        case .docx: "Word"
        }
    }

    public var fileExtension: String {
        rawValue
    }
}

public extension SkillitClient {
    /// The resume as a file in the chosen layout. Fetched through `session` so previews and tests can stub it.
    func resumeFile(
        _ format: ResumeFileFormat,
        template: ResumeTemplate,
        using session: URLSession = .shared
    ) async throws(SkillitError) -> Data {
        try await fileData("api/resume/\(format.rawValue)", template: template, using: session)
    }

    /// One tailored copy as a file; the layout is chosen per job.
    func tailoredResumeFile(
        id: String,
        _ format: ResumeFileFormat,
        template: ResumeTemplate,
        using session: URLSession = .shared
    ) async throws(SkillitError) -> Data {
        try await fileData("api/resume/tailored/\(id)/\(format.rawValue)", template: template, using: session)
    }

    private func fileData(_ path: String, template: ResumeTemplate, using session: URLSession) async throws(SkillitError) -> Data {
        var request = try await authorized("GET", path)
        // appending(path:) would escape a "?", so the query goes on separately
        request.url = request.url?.appending(queryItems: [URLQueryItem(name: "template", value: template.rawValue)])
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
        default: throw .rejected(status: http.statusCode, message: "The file couldn't be made. Try again.")
        }
    }
}
