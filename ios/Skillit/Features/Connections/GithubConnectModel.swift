import AuthenticationServices
import Foundation
import Observation
import SkillitKit
// WebAuthenticationSession lives in the AuthenticationServices + SwiftUI overlay
import SwiftUI

/// The GitHub row's state. The sign-in happens on GitHub's own page in a browser sheet; the app only ever learns
/// "connected" and the project summaries the server derived, never a token.
@Observable
final class GithubConnectModel {
    private(set) var github = GithubConnection.unknown
    private(set) var isLoaded = false
    private(set) var isWorking = false
    var errorMessage: String?

    /// brings the browser sheet back to the app; the server only accepts our own scheme here
    static let returnURL = URL(string: "skillit://connections/github")
    private static let pollAttempts = 10

    var isConnected: Bool {
        github.status == .connected
    }

    func load(using client: SkillitClient) async {
        do {
            github = try await client.githubConnection()
        } catch {
            errorMessage = error.message
        }
        isLoaded = true
    }

    /// Opens the hosted sign-in, then checks with the server until the import has landed (or a short while has passed).
    func connect(using client: SkillitClient, session: WebAuthenticationSession) async {
        isWorking = true
        defer { isWorking = false }
        do {
            let url = try await client.connectGithub(returnTo: Self.returnURL)
            // a person who closes the sheet may still have finished on GitHub, so the status is checked either way
            _ = try? await session.authenticate(
                using: url, callback: .customScheme("skillit"), preferredBrowserSession: .shared, additionalHeaderFields: [:],
            )
            await waitForImport(using: client)
        } catch {
            errorMessage = error.message
        }
    }

    func disconnect(using client: SkillitClient) async {
        isWorking = true
        defer { isWorking = false }
        do {
            github = try await client.disconnectGithub()
        } catch {
            errorMessage = error.message
        }
    }

    private func waitForImport(using client: SkillitClient) async {
        for _ in 0 ..< Self.pollAttempts {
            guard let latest = try? await client.githubConnection() else { return }
            github = latest
            let isDone = latest.status == .notConnected || (latest.status == .connected && !latest.importing && !latest.projects.isEmpty)
            if isDone {
                return
            }
            try? await Task.sleep(for: .seconds(2))
        }
    }
}
