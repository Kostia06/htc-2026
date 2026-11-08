import Foundation
@testable import SkillitKit
import Testing

extension StubbedNetworkTests {
    struct HeadsetPairingTests {
        let client = SkillitClientTests.client(accessToken: { "t0k" })

        @Test func `asks for a code as the signed-in person and reads when it expires`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/pairing/offer"] = (201, #"{"code":"0482","expiresAt":"2026-11-07T12:02:00.123Z"}"#)
            }
            let code = try await client.offerHeadsetCode()
            #expect(code.digits == "0482")
            #expect(abs(code.expiresAt.timeIntervalSince1970 - 1_794_052_920.123) < 0.001)
            #expect(StubProtocol.lastAuthorization.withLock { $0 } == "Bearer t0k")
        }

        @Test(arguments: [("waiting", HeadsetCodeStatus.waiting), ("claimed", .claimed), ("expired", .expired)])
        func `reads whether the headset has used the code`(status: String, expected: HeadsetCodeStatus) async throws {
            StubProtocol.routes.withLock { $0["GET /api/pairing/offer/0482"] = (200, #"{"status":"\#(status)"}"#) }
            let code = HeadsetCode(digits: "0482", expiresAt: .now)
            #expect(try await client.headsetCodeStatus(code) == expected)
        }

        @Test func `refuses an answer without a readable expiry`() async {
            StubProtocol.routes.withLock { $0["POST /api/pairing/offer"] = (201, #"{"code":"0482","expiresAt":"soon"}"#) }
            await #expect(throws: SkillitError.unreadableResponse) { try await client.offerHeadsetCode() }
        }
    }
}
