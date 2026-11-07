import Foundation
import Observation
import RavenKit

@Observable
final class PairingModel {
    enum State: Equatable {
        case idle
        case confirming(PairingCode)
        case pairing
        case paired
        case failed(String)
    }

    var state: State = .idle
    var typedCode = ""

    var typedPairingCode: PairingCode? {
        PairingCode(typed: typedCode)
    }

    func found(_ code: PairingCode) {
        guard state == .idle || state.isFailure else { return }
        state = .confirming(code)
    }

    func approve(_ code: PairingCode, using client: RavenClient) async {
        state = .pairing
        do {
            try await client.approveHeadset(code)
            state = .paired
            typedCode = ""
        } catch {
            state = .failed(error.message)
        }
    }

    func reset() {
        state = .idle
    }
}

private extension PairingModel.State {
    var isFailure: Bool {
        if case .failed = self {
            true
        } else {
            false
        }
    }
}
