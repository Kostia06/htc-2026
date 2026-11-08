import Foundation

extension SkillitClient: HeadsetLinkService {
    public func headsetStatus() async throws(SkillitError) -> HeadsetStatus {
        let response: StatusResponse = try await send(authorized("GET", "api/headset/status"))
        let devices = try response.devices.map { (device) throws(SkillitError) -> HeadsetDevice in
            guard let createdAt = Self.headsetDate(device.createdAt), let lastSeenAt = Self.headsetDate(device.lastSeenAt) else {
                throw .unreadableResponse
            }
            return HeadsetDevice(
                id: device.id, name: device.name, createdAt: createdAt, lastSeenAt: lastSeenAt, isConnected: device.connected,
            )
        }
        return HeadsetStatus(isConnected: response.connected, devices: devices)
    }

    public func sendToHeadset(_ launch: HeadsetLaunch) async throws(SkillitError) -> LaunchReceipt {
        let response: LaunchResponse = try await send(authorized("POST", "api/headset/launch", json: launch))
        guard let expiresAt = Self.headsetDate(response.expiresAt) else { throw .unreadableResponse }
        return LaunchReceipt(expiresAt: expiresAt, isConnected: response.connected)
    }

    public func revokeHeadset(id: String) async throws(SkillitError) {
        let _: RevokeResponse = try await send(authorized("DELETE", "api/headset/devices/\(id)"))
    }

    /// The server writes `toISOString()`, which always has milliseconds; plain seconds are accepted too.
    private static func headsetDate(_ text: String) -> Date? {
        (try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(text))
            ?? (try? Date.ISO8601FormatStyle().parse(text))
    }
}

private struct StatusResponse: Decodable {
    struct Device: Decodable {
        let id: String
        let name: String
        let createdAt: String
        let lastSeenAt: String
        let connected: Bool
    }

    let connected: Bool
    let devices: [Device]
}

private struct RevokeResponse: Decodable { let revoked: Bool }

private struct LaunchResponse: Decodable {
    let expiresAt: String
    let connected: Bool
}
