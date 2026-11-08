import AuthenticationServices
import Foundation
import Observation
import SkillitKit
// WebAuthenticationSession lives in the AuthenticationServices + SwiftUI overlay
import SwiftUI

/// The "Bring your work" list's state. Each sign-in happens on the service's own page in a browser sheet; the app only ever
/// learns "connected" and the project summaries the server derived, never a token.
@Observable
final class WorkConnectionsModel {
    private(set) var connections: [WorkConnection] = []
    private(set) var isLoaded = false
    /// the service a sign-in or disconnect is running for
    private(set) var workingOn: String?
    var query = ""
    var errorMessage: String?

    private static let pollAttempts = 10

    var visible: [WorkConnection] {
        connections.matching(query)
    }

    var hasAnyConnected: Bool {
        connections.contains(where: \.isConnected)
    }

    func load(using client: SkillitClient) async {
        do {
            connections = try await client.workConnections()
        } catch {
            errorMessage = error.message
        }
        isLoaded = true
    }

    /// Opens the hosted sign-in, then checks with the server until the import has landed (or a short while has passed).
    func connect(_ connection: WorkConnection, using client: SkillitClient, session: WebAuthenticationSession) async {
        workingOn = connection.id
        defer { workingOn = nil }
        do {
            let url = try await client.connect(connection.id, returnTo: URL(string: "skillit://connections/\(connection.id)"))
            // a person who closes the sheet may still have finished signing in, so the status is checked either way
            _ = try? await session.authenticate(
                using: url, callback: .customScheme("skillit"), preferredBrowserSession: .shared, additionalHeaderFields: [:],
            )
            await waitForImport(of: connection.id, using: client)
        } catch {
            errorMessage = error.message
        }
    }

    func disconnect(_ connection: WorkConnection, using client: SkillitClient) async {
        workingOn = connection.id
        defer { workingOn = nil }
        do {
            replace(try await client.disconnect(connection.id))
        } catch {
            errorMessage = error.message
        }
    }

    private func replace(_ updated: WorkConnection) {
        guard let index = connections.firstIndex(where: { $0.id == updated.id }) else { return }
        connections[index] = updated
    }

    private func waitForImport(of id: String, using client: SkillitClient) async {
        for _ in 0 ..< Self.pollAttempts {
            guard let latest = try? await client.workConnections() else { return }
            connections = latest
            guard let current = latest.first(where: { $0.id == id }) else { return }
            if current.status == .notConnected || current.hasFinishedImport {
                return
            }
            try? await Task.sleep(for: .seconds(2))
        }
    }
}
