import Foundation

public extension SkillitClient {
    /// Where GitHub stands. Checking right after the sign-in also starts the import on the server.
    func githubConnection() async throws(SkillitError) -> GithubConnection {
        let response: ConnectionsResponse = try await send(authorized("GET", "api/connections"))
        return response.github
    }

    /// The hosted, read-only GitHub sign-in to open. `returnTo` brings the browser back to the app when it's done.
    func connectGithub(returnTo: URL?) async throws(SkillitError) -> URL {
        let body = ConnectBody(returnTo: returnTo?.absoluteString)
        let response: LinkResponse = try await send(authorized("POST", "api/connections/github", json: body))
        guard let url = URL(string: response.url), url.scheme == "https" else { throw .unreadableResponse }
        return url
    }

    /// Reads the repos again now.
    func importGithub() async throws(SkillitError) -> GithubConnection {
        let response: ConnectionsResponse = try await send(authorized("POST", "api/connections/github/import"))
        return response.github
    }

    /// Disconnects at GitHub and removes every project and note the import added.
    func disconnectGithub() async throws(SkillitError) -> GithubConnection {
        let response: ConnectionsResponse = try await send(authorized("DELETE", "api/connections/github"))
        return response.github
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

private struct ConnectionsResponse: Decodable { let github: GithubConnection }
private struct LinkResponse: Decodable { let url: String }
private struct ConnectBody: Encodable { let returnTo: String? }
