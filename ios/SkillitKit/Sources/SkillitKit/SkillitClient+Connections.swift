import Foundation

public extension SkillitClient {
    /// Every service the person can bring work from, and where each stands. Checking right after a sign-in also starts
    /// that service's import on the server.
    func workConnections() async throws(SkillitError) -> [WorkConnection] {
        let response: ListResponse = try await send(authorized("GET", "api/connections"))
        return response.connections
    }

    /// The hosted, read-only sign-in to open. `returnTo` brings the browser back to the app when it's done.
    func connect(_ provider: String, returnTo: URL?) async throws(SkillitError) -> URL {
        let body = ConnectBody(returnTo: returnTo?.absoluteString)
        let response: LinkResponse = try await send(authorized("POST", try path(provider), json: body))
        guard let url = URL(string: response.url), url.scheme == "https" else { throw .unreadableResponse }
        return url
    }

    /// Reads the service again now.
    func importConnection(_ provider: String) async throws(SkillitError) -> WorkConnection {
        let response: OneResponse = try await send(authorized("POST", try path(provider) + "/import"))
        return response.connection
    }

    /// Disconnects at the service and removes every project and note its import added. Other services' work stays.
    func disconnect(_ provider: String) async throws(SkillitError) -> WorkConnection {
        let response: OneResponse = try await send(authorized("DELETE", try path(provider)))
        return response.connection
    }

    /// Reviews LinkedIn's "Save to PDF" export against the target role. The server keeps neither the file nor its text.
    func reviewLinkedin(_ file: ResumeFile) async throws(SkillitError) -> LinkedinReview {
        var form = MultipartForm()
        form.addFile(field: "file", file: file)
        var request = try await authorized("POST", "api/resume/linkedin")
        request.setValue(form.contentType, forHTTPHeaderField: "Content-Type")
        request.httpBody = form.encoded()
        return try await send(request)
    }
}

// provider ids come from the server, but they still go into a path: anything but a plain slug is refused
private func path(_ provider: String) throws(SkillitError) -> String {
    guard !provider.isEmpty, provider.allSatisfy({ $0.isASCII && ($0.isLowercase || $0.isNumber) }) else { throw .unreadableResponse }
    return "api/connections/\(provider)"
}

private struct ListResponse: Decodable { let connections: [WorkConnection] }
private struct OneResponse: Decodable { let connection: WorkConnection }
private struct LinkResponse: Decodable { let url: String }
private struct ConnectBody: Encodable { let returnTo: String? }
