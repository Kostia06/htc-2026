import Foundation
@testable import SkillitKit
import Testing

extension StubbedNetworkTests {
    struct HeadsetLinkTests {
        let client = SkillitClientTests.client(accessToken: { "t0k" })

        @Test func `reads whether a headset is connected and which ones are remembered`() async throws {
            StubProtocol.routes.withLock {
                $0["GET /api/headset/status"] = (200, #"""
                {"connected":true,"devices":[{"id":"dev-1","name":"Quest 3","createdAt":"2026-11-01T09:00:00.000Z",
                "lastSeenAt":"2026-11-07T12:00:00.000Z","connected":true}]}
                """#)
            }
            let status = try await client.headsetStatus()
            #expect(status.isConnected)
            #expect(status.devices.count == 1)
            #expect(status.devices.first?.name == "Quest 3")
            #expect(status.devices.first?.isConnected == true)
            #expect(abs((status.devices.first?.lastSeenAt.timeIntervalSince1970 ?? 0) - 1_794_052_800) < 0.001)
            #expect(StubProtocol.lastAuthorization.withLock { $0 } == "Bearer t0k")
        }

        @Test func `sends a launch with the same fields a voice session takes, plus the step`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/headset/launch"] = (201, #"{"expiresAt":"2026-11-07T12:02:00.000Z","connected":false}"#)
            }
            let launch = HeadsetLaunch(mode: .interview, companySlug: "atb", role: "Junior data analyst", stepID: "step-3")
            let receipt = try await client.sendToHeadset(launch)
            #expect(!receipt.isConnected)
            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/headset/launch"] })
            let sent = try #require(JSONSerialization.jsonObject(with: body) as? [String: String])
            #expect(sent == ["mode": "interview", "companySlug": "atb", "role": "Junior data analyst", "stepId": "step-3"])
        }

        @Test func `sends the interview picked on the phone, with its difficulty and length`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/headset/launch"] = (201, #"{"expiresAt":"2026-11-07T12:02:00.000Z","connected":true}"#)
            }
            let request = VoiceSessionRequest(mode: .interview, difficulty: .hard, postingId: "p-1", length: .quick)
            _ = try await client.sendToHeadset(HeadsetLaunch(request))
            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/headset/launch"] })
            let sent = try #require(JSONSerialization.jsonObject(with: body) as? [String: String])
            #expect(sent == ["mode": "interview", "postingId": "p-1", "difficulty": "hard", "length": "quick"])
        }

        @Test func `leaves out what the launch doesn't say`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/headset/launch"] = (201, #"{"expiresAt":"2026-11-07T12:02:00.000Z","connected":true}"#)
            }
            _ = try await client.sendToHeadset(HeadsetLaunch(mode: .interview))
            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/headset/launch"] })
            #expect(try JSONSerialization.jsonObject(with: body) as? [String: String] == ["mode": "interview"])
        }

        @Test func `forgets a headset`() async throws {
            StubProtocol.routes.withLock { $0["DELETE /api/headset/devices/dev-1"] = (200, #"{"revoked":true}"#) }
            try await client.revokeHeadset(id: "dev-1")
            StubProtocol.routes.withLock { $0["DELETE /api/headset/devices/dev-9"] = (404, #"{"error":"no such headset"}"#) }
            await #expect(throws: SkillitError.rejected(status: 404, message: "no such headset")) {
                try await client.revokeHeadset(id: "dev-9")
            }
        }
    }
}
