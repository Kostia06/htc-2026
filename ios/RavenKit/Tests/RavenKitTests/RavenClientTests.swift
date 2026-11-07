import Foundation
@testable import RavenKit
import Synchronization
import Testing

/// Answers requests from a fixed table instead of the network.
final class StubProtocol: URLProtocol {
    static let routes = Mutex<[String: (Int, String)]>([:])
    static let lastAuthorization = Mutex<String?>(nil)

    override static func canInit(with _: URLRequest) -> Bool {
        true
    }

    override static func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        let key = "\(request.httpMethod ?? "") \(request.url?.path() ?? "")"
        Self.lastAuthorization.withLock { $0 = request.value(forHTTPHeaderField: "Authorization") }
        let (status, body) = Self.routes.withLock { $0[key] } ?? (404, #"{"error":"no route"}"#)
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

@Suite(.serialized)
struct RavenClientTests {
    let client: RavenClient

    init() {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubProtocol.self]
        client = RavenClient(baseURL: URL(string: "https://api.test")!, token: "t0k", session: URLSession(configuration: configuration))
    }

    @Test func `sends the session token and decodes the profile`() async throws {
        StubProtocol.routes.withLock { $0["GET /api/me/profile"] = (200, #"{"profile":{"targetRoles":["Analyst"]}}"#) }
        let profile = try await client.profile()
        #expect(profile.targetRoles == ["Analyst"])
        #expect(StubProtocol.lastAuthorization.withLock { $0 } == "Bearer t0k")
    }

    @Test func `turns server refusals into readable errors`() async throws {
        StubProtocol.routes.withLock { $0["POST /api/pairing/K7M2Q9XD/approve"] = (410, #"{"error":"that code expired"}"#) }
        let code = try #require(PairingCode(typed: "K7M2Q9XD"))
        await #expect(throws: RavenError.rejected(status: 410, message: "that code expired")) {
            try await client.approveHeadset(code)
        }
    }

    @Test func `reports an expired session as unauthorized`() async {
        StubProtocol.routes.withLock { $0["GET /api/me/profile"] = (401, #"{"error":"unauthorized"}"#) }
        await #expect(throws: RavenError.unauthorized) { try await client.profile() }
    }
}
