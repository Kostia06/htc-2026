import Foundation
import Observation
import RavenKit

/// Keeps a fresh 4-digit code on screen until the headset types it in.
@Observable
final class HeadsetPairingModel {
    enum State: Equatable {
        case loading
        case showing(HeadsetCode)
        case connected
        case failed(String)
    }

    private(set) var state: State = .loading

    private let pollInterval: Duration = .milliseconds(1500)
    private let retryDelay: Duration = .seconds(3)

    /// Runs until the headset connects or the task is cancelled; an expired code is replaced without asking.
    func run(using issuer: any HeadsetCodeIssuer) async {
        state = .loading
        while !Task.isCancelled {
            let code: HeadsetCode
            do throws(RavenError) {
                code = try await issuer.offerHeadsetCode()
            } catch {
                state = .failed(error.message)
                try? await Task.sleep(for: retryDelay)
                continue
            }
            state = .showing(code)
            if await waitForClaim(of: code, using: issuer) {
                state = .connected
                return
            }
        }
    }

    /// True once the headset used the code; false when it expired. A failed poll is retried on the next tick
    /// rather than shown, since the code on screen is still good.
    private func waitForClaim(of code: HeadsetCode, using issuer: any HeadsetCodeIssuer) async -> Bool {
        while !Task.isCancelled {
            try? await Task.sleep(for: pollInterval)
            guard let status = try? await issuer.headsetCodeStatus(code) else {
                if Date.now >= code.expiresAt {
                    return false
                }
                continue
            }
            switch status {
            case .claimed: return true
            case .expired: return false
            case .waiting: continue
            }
        }
        return false
    }
}
