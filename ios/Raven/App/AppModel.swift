import Foundation
import Observation
import RavenKit

/// Who is signed in and where they are in the app. Owned by the app, passed down through the environment.
@Observable
final class AppModel {
    enum Phase: Equatable {
        case starting
        case onboarding
        case ready
        case failed(String)
    }

    private(set) var phase: Phase = .starting
    private(set) var client: RavenClient?
    var profile: Profile = .empty
    /// A headset code that arrived from the Camera app before the person reached the pairing screen.
    var pendingPairing: PairingCode?

    private let baseURL: URL
    private let sessions = SessionStore()

    init(baseURL: URL) {
        self.baseURL = baseURL
    }

    func start() async {
        do {
            let client = try await signedInClient()
            self.client = client
            profile = try await client.profile()
            phase = profile.isEmpty ? .onboarding : .ready
        } catch .unauthorized {
            sessions.clear()
            await start()
        } catch {
            phase = .failed(error.message)
        }
    }

    func finishOnboarding(with profile: Profile) {
        self.profile = profile
        phase = .ready
    }

    func handle(_ url: URL) {
        guard let code = PairingCode(link: url) else { return }
        pendingPairing = code
    }

    private func signedInClient() async throws(RavenError) -> RavenClient {
        if let token = sessions.load() {
            return RavenClient(baseURL: baseURL, token: token)
        }
        let token = try await RavenClient.startSession(baseURL: baseURL)
        sessions.save(token)
        return RavenClient(baseURL: baseURL, token: token)
    }
}
