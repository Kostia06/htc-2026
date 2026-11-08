import Foundation

public extension SkillitClient {
    func tailoredResumes() async throws(SkillitError) -> [TailoredResumeSummary] {
        let response: TailoredListResponse = try await send(authorized("GET", "api/resume/tailored"))
        return response.tailored
    }

    /// One model call on the server, plus an import when the source is pasted text; the base resume is left as it is.
    func tailorResume(for source: TailorSource) async throws(SkillitError) -> TailoredResume {
        try await send(authorized("POST", "api/resume/tailored", json: TailorBody(source)))
    }

    func tailoredResume(id: String) async throws(SkillitError) -> TailoredResume {
        try await send(authorized("GET", "api/resume/tailored/\(id)"))
    }

    /// Accepts or reverts one change; the server rebuilds the copy from the base resume, so a revert is exact.
    func setChange(_ changeId: String, accepted: Bool, in tailoredId: String) async throws(SkillitError) -> TailoredResume {
        let body = ToggleBody(changes: [.init(id: changeId, accepted: accepted)])
        return try await send(authorized("PUT", "api/resume/tailored/\(tailoredId)", json: body))
    }

    func deleteTailoredResume(id: String) async throws(SkillitError) {
        let _: DeletedResponse = try await send(authorized("DELETE", "api/resume/tailored/\(id)"))
    }

    /// The tailored copy as a one-page PDF. Fetched through `session` so previews and tests can stub it.
    func tailoredResumePDF(id: String, using session: URLSession = .shared) async throws(SkillitError) -> Data {
        let request = try await authorized("GET", "api/resume/tailored/\(id)/pdf")
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

private struct TailorBody: Encodable {
    let postingId: String?
    let text: String?

    init(_ source: TailorSource) {
        switch source {
        case let .posting(id): (postingId, text) = (id, nil)
        case let .text(text): (postingId, self.text) = (nil, text)
        }
    }
}

private struct ToggleBody: Encodable {
    struct Toggle: Encodable {
        let id: String
        let accepted: Bool
    }

    let changes: [Toggle]
}

private struct TailoredListResponse: Decodable { let tailored: [TailoredResumeSummary] }
private struct DeletedResponse: Decodable { let deleted: Bool }
