import Foundation

/// The one way the app talks to the Raven server. Every call is scoped to the signed-in person by `token`.
public struct RavenClient: Sendable {
    public let baseURL: URL
    private let token: String
    private let session: URLSession

    public init(baseURL: URL, token: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.token = token
        self.session = session
    }

    public static func startSession(baseURL: URL, session: URLSession = .shared) async throws(RavenError) -> String {
        let request = Request(method: "POST", url: baseURL.appending(path: "api/session"))
        let response: TokenResponse = try await send(request.build(), with: session)
        return response.token
    }

    public func profile() async throws(RavenError) -> Profile {
        let response: ProfileResponse = try await send(authorized("GET", "api/me/profile"))
        return response.profile
    }

    public func uploadResume(_ file: ResumeFile) async throws(RavenError) -> ResumeDraft {
        var form = MultipartForm()
        form.addFile(field: "file", file: file)
        var request = authorized("POST", "api/onboarding/resume")
        request.setValue(form.contentType, forHTTPHeaderField: "Content-Type")
        request.httpBody = form.encoded()
        return try await send(request)
    }

    public func confirmProfile(_ profile: Profile, documentId: String?) async throws(RavenError) -> Profile {
        let body = ConfirmBody(documentId: documentId, profile: profile)
        let response: ProfileResponse = try await send(authorized("POST", "api/onboarding/confirm", json: body))
        return response.profile
    }

    public func approveHeadset(_ code: PairingCode) async throws(RavenError) {
        let _: PairedResponse = try await send(authorized("POST", "api/pairing/\(code.value)/approve"))
    }

    public func deleteProfile() async throws(RavenError) {
        try await sendExpectingNoContent(authorized("DELETE", "api/me/profile"))
    }

    private func authorized(_ method: String, _ path: String, json: (some Encodable)? = Never?.none) -> URLRequest {
        var request = Request(method: method, url: baseURL.appending(path: path)).build()
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let json, let data = try? JSONEncoder().encode(json) {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = data
        }
        return request
    }

    private func send<Response: Decodable>(_ request: URLRequest) async throws(RavenError) -> Response {
        try await Self.send(request, with: session)
    }

    private func sendExpectingNoContent(_ request: URLRequest) async throws(RavenError) {
        _ = try await Self.data(for: request, with: session)
    }

    private static func send<Response: Decodable>(_ request: URLRequest, with session: URLSession) async throws(RavenError) -> Response {
        let data = try await data(for: request, with: session)
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw .unreadableResponse
        }
    }

    private static func data(for request: URLRequest, with session: URLSession) async throws(RavenError) -> Data {
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
        default:
            let message = (try? JSONDecoder().decode(ErrorResponse.self, from: data))?.error
            throw .rejected(status: http.statusCode, message: message ?? "That didn't work. Try again.")
        }
    }
}

private struct Request {
    let method: String
    let url: URL

    func build() -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        // the agent can take a while to read a resume; the default 60s cuts it short on slow networks
        request.timeoutInterval = 120
        return request
    }
}

private struct TokenResponse: Decodable { let token: String }
private struct ProfileResponse: Decodable { let profile: Profile }
private struct PairedResponse: Decodable { let paired: Bool }
private struct ErrorResponse: Decodable { let error: String }
private struct ConfirmBody: Encodable {
    let documentId: String?
    let profile: Profile
}
