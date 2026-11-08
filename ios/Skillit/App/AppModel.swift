import Foundation
import Observation
import SkillitKit

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
    private(set) var client: SkillitClient?
    var profile: Profile = .empty
    var feed = ForYouModel()
    /// The companies Skillit has researched, so a job card or a step can open the company behind it.
    let companies = CompaniesModel()
    /// The bell: shared by the Road toolbar, the tab view that opens targets, and the app delegate.
    let notifications = NotificationsModel()
    /// Bumped whenever Skillit applied an update, so screens showing roadmap steps or postings read them again.
    private(set) var updatesApplied = 0

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
        let client = SkillitClient(baseURL: baseURL, accessToken: authenticator.accessToken)
        // alongside the profile request, so the For you tab and the known companies are fresh before anyone needs them
        Task { await feed.refresh(using: client) }
        Task { await companies.refresh(using: client) }
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
        notifications.forget()
        // delete-my-data finishes by signing out, so this covers both
        PracticeHistoryCache().clear()
        profile = .empty
        phase = .signedOut
    }

    func finishOnboarding(with profile: Profile) {
        self.profile = profile
        phase = .ready
        Task { await LocalNotifier.requestPermission() }
    }

    /// Everything Skillit changed is on the server already; this refreshes what the app holds in memory.
    func noteApplied(_ changes: [AppliedChange]) {
        updatesApplied += 1
        guard let client else { return }
        if changes.contains(where: \.touchesProfile) {
            Task { if let profile = try? await client.profile() { self.profile = profile } }
        }
        if changes.contains(where: { $0.type == "add_company" }) {
            Task { await companies.refresh(using: client) }
        }
    }
}
