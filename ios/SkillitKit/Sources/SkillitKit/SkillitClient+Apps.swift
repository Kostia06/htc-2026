import Foundation

public extension SkillitClient {
    /// The person's other connected (or still connecting) apps.
    func connectedApps() async throws(SkillitError) -> [ConnectedApp] {
        let response: AppsResponse = try await send(authorized("GET", "api/connections"))
        return response.apps ?? []
    }

    /// One page of Composio's catalog matching `query`; pass the previous page's `next` for the one after it.
    func searchApps(_ query: String, cursor: String? = nil) async throws(SkillitError) -> AppCatalogPage {
        var request = try await authorized("GET", "api/connections/catalog")
        var items = [URLQueryItem(name: "q", value: query)]
        if let cursor { items.append(URLQueryItem(name: "cursor", value: cursor)) }
        request.url = request.url?.appending(queryItems: items)
        return try await send(request)
    }

    /// The hosted sign-in for one app. The server sets the app up with Composio the first time anyone connects it.
    func connectApp(_ slug: String, returnTo: URL?) async throws(SkillitError) -> URL {
        let body = AppConnectBody(returnTo: returnTo?.absoluteString)
        let response: AppLinkResponse = try await send(authorized("POST", try appPath(slug), json: body))
        guard let url = URL(string: response.url), url.scheme == "https" else { throw .unreadableResponse }
        return url
    }

    /// Disconnects at the app, revoking Skillit's access, and answers with the apps left.
    func disconnectApp(_ slug: String) async throws(SkillitError) -> [ConnectedApp] {
        let response: AppsResponse = try await send(authorized("DELETE", try appPath(slug)))
        return response.apps ?? []
    }
}

// slugs come from the server, but they still go into a path: anything but a toolkit slug is refused
func appPath(_ slug: String) throws(SkillitError) -> String {
    let allowed = slug.allSatisfy { $0.isASCII && ($0.isLowercase || $0.isNumber || $0 == "_" || $0 == "-") }
    guard (1 ... 60).contains(slug.count), allowed else { throw .unreadableResponse }
    return "api/connections/apps/\(slug)"
}

private struct AppsResponse: Decodable { let apps: [ConnectedApp]? }
private struct AppLinkResponse: Decodable { let url: String }
private struct AppConnectBody: Encodable { let returnTo: String? }
