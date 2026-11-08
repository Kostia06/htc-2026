import Foundation

/// Hands out a current access token, refreshing it first when it's about to expire. Throws when no one is signed in.
public typealias AccessTokenProvider = @Sendable () async throws -> String

/// The one way the app talks to the Skillit server. Every call is scoped to the signed-in person by their access token.
public struct SkillitClient: Sendable {
    public let baseURL: URL
    private let accessToken: AccessTokenProvider
    private let session: URLSession

    public init(baseURL: URL, accessToken: @escaping AccessTokenProvider, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.accessToken = accessToken
        self.session = session
    }

    public func profile() async throws(SkillitError) -> Profile {
        let response: ProfileResponse = try await send(authorized("GET", "api/me/profile"))
        return response.profile
    }

    public func uploadResume(_ file: ResumeFile) async throws(SkillitError) -> ResumeDraft {
        var form = MultipartForm()
        form.addFile(field: "file", file: file)
        var request = try await authorized("POST", "api/onboarding/resume")
        request.setValue(form.contentType, forHTTPHeaderField: "Content-Type")
        request.httpBody = form.encoded()
        return try await send(request)
    }

    public func confirmProfile(_ profile: Profile, documentId: String?) async throws(SkillitError) -> Profile {
        let body = ConfirmBody(documentId: documentId, profile: profile)
        let response: ProfileResponse = try await send(authorized("POST", "api/onboarding/confirm", json: body))
        return response.profile
    }

    public func deleteProfile() async throws(SkillitError) {
        _ = try await responseData(for: authorized("DELETE", "api/me/profile"))
    }

    func authorized(
        _ method: String,
        _ path: String,
        json: (some Encodable)? = Never?.none,
    ) async throws(SkillitError) -> URLRequest {
        let token: String
        do {
            token = try await accessToken()
        } catch let error as SkillitError {
            // the provider says why: only a missing session means signed out, a busy sign-in service doesn't
            throw error
        } catch {
            throw .unauthorized
        }
        var request = Request(method: method, url: baseURL.appending(path: path)).build()
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let json, let data = try? JSONEncoder().encode(json) {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = data
        }
        return request
    }

    func send<Response: Decodable>(_ request: URLRequest) async throws(SkillitError) -> Response {
        let data = try await responseData(for: request)
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw .unreadableResponse
        }
    }

    func responseData(for request: URLRequest) async throws(SkillitError) -> Data {
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

private struct ProfileResponse: Decodable { let profile: Profile }
private struct ErrorResponse: Decodable { let error: String }
private struct ConfirmBody: Encodable {
    let documentId: String?
    let profile: Profile
}
