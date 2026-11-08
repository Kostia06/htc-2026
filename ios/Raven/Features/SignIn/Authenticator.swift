import Auth
import Foundation
import RavenKit

/// The person's Supabase session: signing in and out, and a fresh access token for every server call.
/// The SDK keeps the session in the Keychain and refreshes it before it expires.
final class Authenticator: Sendable {
    private let auth: AuthClient

    init(projectURL: URL, publishableKey: String) {
        auth = AuthClient(
            url: projectURL.appending(path: "auth/v1"),
            headers: ["apikey": publishableKey],
            storageKey: "raven-auth-\(projectURL.host() ?? "project")",
            localStorage: KeychainLocalStorage(),
            emitLocalSessionAsInitialSession: true,
        )
    }

    var isSignedIn: Bool {
        auth.currentSession != nil
    }

    /// What to show for the account: the email when there is one; Apple can hide it, so the provider is the fallback.
    var accountLabel: String {
        guard let user = auth.currentSession?.user else { return "Not signed in" }
        if let email = user.email { return email }
        return user.appMetadata["provider"]?.stringValue == "apple" ? "Apple ID" : "Signed in"
    }

    var accessToken: AccessTokenProvider {
        { [auth] in try await auth.session.accessToken }
    }

    func signInWithApple(idToken: String, nonce: SignInNonce) async throws {
        try await auth.signInWithIdToken(credentials: .init(provider: .apple, idToken: idToken, nonce: nonce.raw))
    }

    func sendCode(to email: EmailAddress) async throws {
        try await auth.signInWithOTP(email: email.value)
    }

    func signIn(email: EmailAddress, code: OneTimeCode) async throws {
        try await auth.verifyOTP(email: email.value, token: code.value, type: .email)
    }

    /// Ends the session on this device only; a paired headset keeps its own token.
    func signOut() async {
        // the local session is cleared even when the server can't be reached
        try? await auth.signOut(scope: .local)
    }
}

extension Authenticator {
    /// Built from the Info.plist keys project.yml fills in; a missing key is a broken build, not a runtime state.
    static func fromInfoPlist(_ bundle: Bundle = .main) -> Authenticator {
        guard let urlString = bundle.object(forInfoDictionaryKey: "SupabaseURL") as? String,
              let url = URL(string: urlString),
              let key = bundle.object(forInfoDictionaryKey: "SupabasePublishableKey") as? String
        else {
            preconditionFailure("SupabaseURL or SupabasePublishableKey is missing from Info.plist")
        }
        return Authenticator(projectURL: url, publishableKey: key)
    }
}
