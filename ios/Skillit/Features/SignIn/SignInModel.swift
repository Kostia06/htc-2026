import AuthenticationServices
import Foundation
import Observation
import SkillitKit

/// Drives the sign-in screen: Sign in with Apple, or an emailed one-time code as the fallback.
@Observable
final class SignInModel {
    enum Step: Equatable {
        case choosing
        case enteringEmail
        case enteringCode(EmailAddress)
    }

    enum PasswordMode: String, CaseIterable {
        case signIn = "Sign in"
        case signUp = "Create account"
    }

    // Supabase's own minimum; asking for more on sign-in would lock out people with older passwords
    static let minimumNewPassword = 8

    var step: Step = .choosing
    var typedEmail = ""
    var typedCode = ""
    var typedPassword = ""
    var passwordMode = PasswordMode.signIn
    private(set) var isWorking = false
    var errorMessage: String?
    /// Not an error: e.g. "check your inbox to confirm" after creating an account.
    var notice: String?

    /// Kept between the Apple request and its completion; Supabase needs the unhashed half.
    private var pendingNonce: SignInNonce?

    init(step: Step = .choosing) {
        self.step = step
    }

    var canSendCode: Bool {
        EmailAddress(typed: typedEmail) != nil && !isWorking
    }

    var canVerifyCode: Bool {
        OneTimeCode(typed: typedCode) != nil && !isWorking
    }

    var canSubmitPassword: Bool {
        let needed = passwordMode == .signUp ? Self.minimumNewPassword : 1
        return EmailAddress(typed: typedEmail) != nil && typedPassword.count >= needed && !isWorking
    }

    /// True when the person is signed in; creating an account that needs email confirmation returns false with a notice.
    func submitPassword(with authenticator: Authenticator) async -> Bool {
        guard let email = EmailAddress(typed: typedEmail) else { return false }
        let password = typedPassword
        switch passwordMode {
        case .signIn:
            return await attempt(orSay: "That email and password don't match. Try again, or get a code instead.") {
                try await authenticator.signIn(email: email, password: password)
            }
        case .signUp:
            var hasSession = false
            let worked = await attempt(orSay: "Skillit couldn't create that account. It may already exist; try signing in.") {
                hasSession = try await authenticator.signUp(email: email, password: password)
            }
            guard worked else { return false }
            if !hasSession {
                notice = "Check \(email.value) for a confirmation link, then sign in here."
                passwordMode = .signIn
                typedPassword = ""
            }
            return hasSession
        }
    }

    func prepare(_ request: ASAuthorizationAppleIDRequest) {
        let nonce = SignInNonce()
        pendingNonce = nonce
        request.requestedScopes = [.email]
        request.nonce = nonce.hashed
    }

    func completeApple(_ result: Result<ASAuthorization, any Error>, with authenticator: Authenticator) async -> Bool {
        switch result {
        case let .failure(error):
            // closing the Apple sheet is a choice, not an error worth an alert
            if (error as? ASAuthorizationError)?.code != .canceled {
                errorMessage = "Sign in with Apple didn't finish. Try again or use your email."
            }
            return false
        case let .success(authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8),
                  let nonce = pendingNonce
            else {
                errorMessage = "Apple didn't send what Skillit needs to sign you in. Try again."
                return false
            }
            return await attempt(orSay: "Skillit couldn't sign you in with Apple. Try again or use your email.") {
                try await authenticator.signInWithApple(idToken: idToken, nonce: nonce)
            }
        }
    }

    func sendCode(with authenticator: Authenticator) async {
        guard let email = EmailAddress(typed: typedEmail) else { return }
        if await attempt(orSay: "Skillit couldn't send a code to that address. Try again in a minute.", {
            try await authenticator.sendCode(to: email)
        }) {
            typedCode = ""
            step = .enteringCode(email)
        }
    }

    func verifyCode(with authenticator: Authenticator) async -> Bool {
        guard case let .enteringCode(email) = step, let code = OneTimeCode(typed: typedCode) else { return false }
        return await attempt(orSay: "That code didn't work. Check it, or ask for a new one.") {
            try await authenticator.signIn(email: email, code: code)
        }
    }

    private func attempt(orSay failureMessage: String, _ work: () async throws -> Void) async -> Bool {
        isWorking = true
        defer { isWorking = false }
        do {
            try await work()
            return true
        } catch {
            errorMessage = error is URLError ? "You're offline. Check your connection and try again." : failureMessage
            return false
        }
    }
}
