#if DEBUG
    import Foundation
    import SkillitKit

    /// A server stand-in for screenshots: a Quest 3 that is listening (or not), and an older headset seen days ago.
    nonisolated struct DemoHeadsetLink: HeadsetLinkService {
        var isConnected = true

        func headsetStatus() async throws(SkillitError) -> HeadsetStatus {
            HeadsetStatus(isConnected: isConnected, devices: [
                HeadsetDevice(
                    id: "quest-3", name: "Quest 3", createdAt: .now.addingTimeInterval(-6 * 86400),
                    lastSeenAt: isConnected ? .now : .now.addingTimeInterval(-2 * 3600), isConnected: isConnected,
                ),
                HeadsetDevice(
                    id: "quest-2", name: "Quest 2", createdAt: .now.addingTimeInterval(-30 * 86400),
                    lastSeenAt: .now.addingTimeInterval(-3 * 86400), isConnected: false,
                ),
            ])
        }

        func sendToHeadset(_: HeadsetLaunch) async throws(SkillitError) -> LaunchReceipt {
            LaunchReceipt(expiresAt: .now.addingTimeInterval(120), isConnected: isConnected)
        }

        func revokeHeadset(id _: String) async throws(SkillitError) {}
    }
#endif
