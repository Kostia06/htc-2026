import Foundation
@testable import RavenKit
import Synchronization
import Testing

/// Answers requests from a fixed table instead of the network.
final class StubProtocol: URLProtocol {
    static let routes = Mutex<[String: (Int, String)]>([:])
    static let lastAuthorization = Mutex<String?>(nil)
    /// Request bodies by route, so suites running in parallel don't read each other's.
    static let bodies = Mutex<[String: Data]>([:])

    override static func canInit(with _: URLRequest) -> Bool {
        true
    }

    override static func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        let key = "\(request.httpMethod ?? "") \(request.url?.path() ?? "")"
        Self.lastAuthorization.withLock { $0 = request.value(forHTTPHeaderField: "Authorization") }
        let sentBody = request.httpBody ?? request.httpBodyStream.map(Self.readAll)
        Self.bodies.withLock { $0[key] = sentBody }
        let (status, body) = Self.routes.withLock { $0[key] } ?? (404, #"{"error":"no route"}"#)
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    /// URLSession hands URLProtocol the body as a stream, not as httpBody
    private static func readAll(_ stream: InputStream) -> Data {
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            guard count > 0 else { break }
            data.append(buffer, count: count)
        }
        return data
    }
}

/// Hands out a new token each time, like a session that refreshes between requests.
final class TokenIssuer: Sendable {
    private let issued = Mutex(0)

    func next() -> String {
        let count = issued.withLock { count in
            count += 1
            return count
        }
        return "token-\(count)"
    }
}

/// Every suite that talks through `StubProtocol` lives in here: they share its static state, so they must not run in parallel.
@Suite(.serialized)
enum StubbedNetworkTests {}

extension StubbedNetworkTests {
    struct RavenClientTests {
        let client: RavenClient

        init() {
            client = Self.client(accessToken: { "t0k" })
        }

        static func client(accessToken: @escaping AccessTokenProvider) -> RavenClient {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.protocolClasses = [StubProtocol.self]
            let session = URLSession(configuration: configuration)
            return RavenClient(baseURL: URL(string: "https://api.test")!, accessToken: accessToken, session: session)
        }

        @Test func `sends the access token and decodes the profile`() async throws {
            StubProtocol.routes.withLock { $0["GET /api/me/profile"] = (200, #"{"profile":{"targetRoles":["Analyst"]}}"#) }
            let profile = try await client.profile()
            #expect(profile.targetRoles == ["Analyst"])
            #expect(StubProtocol.lastAuthorization.withLock { $0 } == "Bearer t0k")
        }

        @Test func `asks for a fresh token on every request`() async throws {
            StubProtocol.routes.withLock { $0["GET /api/me/profile"] = (200, #"{"profile":{}}"#) }
            let issuer = TokenIssuer()
            let client = Self.client(accessToken: { issuer.next() })
            _ = try await client.profile()
            _ = try await client.profile()
            #expect(StubProtocol.lastAuthorization.withLock { $0 } == "Bearer token-2")
        }

        @Test func `treats a missing session as unauthorized without calling the server`() async {
            StubProtocol.lastAuthorization.withLock { $0 = "untouched" }
            let client = Self.client(accessToken: { throw CancellationError() })
            await #expect(throws: RavenError.unauthorized) { try await client.profile() }
            #expect(StubProtocol.lastAuthorization.withLock { $0 } == "untouched")
        }

        @Test func `turns server refusals into readable errors`() async throws {
            StubProtocol.routes.withLock { $0["POST /api/pairing/offer"] = (503, #"{"error":"try again"}"#) }
            await #expect(throws: RavenError.rejected(status: 503, message: "try again")) {
                try await client.offerHeadsetCode()
            }
        }

        @Test func `reports an expired session as unauthorized`() async {
            StubProtocol.routes.withLock { $0["GET /api/me/profile"] = (401, #"{"error":"unauthorized"}"#) }
            await #expect(throws: RavenError.unauthorized) { try await client.profile() }
        }
    }
}
