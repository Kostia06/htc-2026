import Foundation
import Observation
import RavenKit

/// Who is signed in and where they are in the app. Owned by the app, passed down through the environment.
@Observable
final class AppModel {
    enum Phase: Equatable {
        case starting
        case signedOut
        case onboarding
        case ready
        case failed(String)
    }

    private(set) var phase: Phase = .starting
    private(set) var client: RavenClient?
    var profile: Profile = .empty
    /// A headset code that arrived from the Camera app before the person reached the pairing screen.
    var pendingPairing: PairingCode?
    var feed = ForYouModel()

    let authenticator: Authenticator
    private let baseURL: URL

    init(baseURL: URL, authenticator: Authenticator) {
        self.baseURL = baseURL
        self.authenticator = authenticator
    }

    #if DEBUG
        /// A model for screenshots; nothing it holds ever reaches the server or the real Keychain session.
        static func preview(profile: Profile, phase: Phase = .ready) -> AppModel {
            let authenticator = Authenticator(projectURL: URL(filePath: "/preview"), publishableKey: "preview")
            let model = AppModel(baseURL: URL(filePath: "/"), authenticator: authenticator)
            model.profile = profile
            model.phase = phase
            return model
        }
    #endif

    func start() async {
        guard authenticator.isSignedIn else {
            phase = .signedOut
            return
        }
        let client = RavenClient(baseURL: baseURL, accessToken: authenticator.accessToken)
        // alongside the profile request, so the For you tab is fresh before anyone opens it
        Task { await feed.refresh(using: client) }
        do {
            profile = try await client.profile()
            self.client = client
            phase = profile.isEmpty ? .onboarding : .ready
        } catch .unauthorized {
            await signOut()
        } catch {
            phase = .failed(error.message)
        }
    }

    func signOut() async {
        await authenticator.signOut()
        client = nil
        feed.forget()
        profile = .empty
        phase = .signedOut
    }

    func finishOnboarding(with profile: Profile) {
        self.profile = profile
        phase = .ready
    }

    func handle(_ url: URL) {
        guard let code = PairingCode(link: url) else { return }
        pendingPairing = code
    }
}
