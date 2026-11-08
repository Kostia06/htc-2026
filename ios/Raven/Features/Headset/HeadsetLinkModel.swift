import Foundation
import Observation
import RavenKit

/// Whether a paired headset is listening right now, and the headsets this account remembers.
/// Polls only while `watch` runs: attach it to `.task` on a screen that shows the state, so it stops with the screen.
@Observable
final class HeadsetLinkModel {
    private(set) var status: HeadsetStatus?
    private(set) var failure: String?

    private let pollInterval: Duration = .seconds(2)

    var isConnected: Bool { status?.isConnected ?? false }
    var devices: [HeadsetDevice] { status?.devices ?? [] }
    /// "Quest 3" when one is listening; nil otherwise
    var connectedName: String? { devices.first(where: \.isConnected)?.name }

    func watch(using service: any HeadsetLinkService) async {
        while !Task.isCancelled {
            await refresh(using: service)
            try? await Task.sleep(for: pollInterval)
        }
    }

    func refresh(using service: any HeadsetLinkService) async {
        do throws(RavenError) {
            status = try await service.headsetStatus()
            failure = nil
        } catch {
            // the last good answer stays on screen; the next tick retries
            failure = error.message
        }
    }

    func send(_ launch: HeadsetLaunch, using service: any HeadsetLinkService) async throws(RavenError) -> LaunchReceipt {
        try await service.sendToHeadset(launch)
    }

    func revoke(_ device: HeadsetDevice, using service: any HeadsetLinkService) async {
        do throws(RavenError) {
            try await service.revokeHeadset(id: device.id)
        } catch {
            failure = error.message
        }
        await refresh(using: service)
    }
}
