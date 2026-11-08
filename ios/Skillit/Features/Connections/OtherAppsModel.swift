import AuthenticationServices
import Foundation
import Observation
import SkillitKit
// WebAuthenticationSession lives in the AuthenticationServices + SwiftUI overlay
import SwiftUI

/// "More apps": the person's other connected apps, and a server-side search of Composio's whole catalog. These connect
/// but import nothing; the curated services above keep their own rows.
@Observable
final class OtherAppsModel {
    private(set) var connected: [ConnectedApp] = []
    private(set) var results: AppCatalogPage?
    /// the app a sign-in or disconnect is running for, or "more" while the next page loads
    private(set) var workingOn: String?
    var query = ""
    var errorMessage: String?

    private static let pollAttempts = 30
    private static let debounce = Duration.milliseconds(300)

    /// the catalog with each app's own status filled in; with nothing typed, connected apps first, then every other app
    var rows: [ConnectedApp] {
        guard let results else { return connected }
        let statuses = Dictionary(connected.map { ($0.slug, $0.status) }, uniquingKeysWith: { first, _ in first })
        let listed = results.apps.filter { !$0.isCurated }.map { app in
            var app = app
            app.status = statuses[app.slug] ?? .notConnected
            return app
        }
        if isSearching { return listed }
        return connected + listed.filter { statuses[$0.slug] == nil }
    }

    var isSearching: Bool {
        !trimmedQuery.isEmpty
    }

    var hasMore: Bool {
        results?.next != nil
    }

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func load(using client: SkillitClient) async {
        connected = await (try? client.connectedApps()) ?? connected
    }

    /// Called from `.task(id: query)`, so a newer keystroke cancels this one during the pause.
    func search(using client: SkillitClient) async {
        let needle = trimmedQuery
        // nothing typed lists the whole catalog at once; typing waits for a pause first
        // cancelled during the pause: a newer search is already on its way
        if !needle.isEmpty, (try? await Task.sleep(for: Self.debounce)) == nil { return }
        do {
            let page = try await client.searchApps(needle)
            guard needle == trimmedQuery else { return }
            results = page
        } catch {
            errorMessage = error.message
        }
    }

    func loadMore(using client: SkillitClient) async {
        guard let current = results, let cursor = current.next else { return }
        let needle = trimmedQuery
        workingOn = "more"
        defer { workingOn = nil }
        do {
            let page = try await client.searchApps(needle, cursor: cursor)
            guard needle == trimmedQuery else { return }
            results = AppCatalogPage(apps: current.apps + page.apps, next: page.next)
        } catch {
            errorMessage = error.message
        }
    }

    /// Opens the hosted sign-in, then checks with the server until it lands (or a short while has passed).
    func connect(_ app: ConnectedApp, using client: SkillitClient, session: WebAuthenticationSession) async {
        workingOn = app.slug
        defer { workingOn = nil }
        do {
            let url = try await client.connectApp(app.slug, returnTo: URL(string: "skillit://connections"))
            // a person who closes the sheet may still have finished signing in, so the status is checked either way
            _ = try? await session.authenticate(
                using: url, callback: .customScheme("skillit"), preferredBrowserSession: .shared, additionalHeaderFields: [:],
            )
            await waitForSignIn(of: app.slug, using: client)
        } catch {
            errorMessage = error.message
        }
    }

    func disconnect(_ app: ConnectedApp, using client: SkillitClient) async {
        workingOn = app.slug
        defer { workingOn = nil }
        do {
            connected = try await client.disconnectApp(app.slug)
        } catch {
            errorMessage = error.message
        }
    }

    private func waitForSignIn(of slug: String, using client: SkillitClient) async {
        for _ in 0 ..< Self.pollAttempts {
            guard let latest = try? await client.connectedApps() else { return }
            connected = latest
            guard let current = latest.first(where: { $0.slug == slug }), current.status == .pending else { return }
            try? await Task.sleep(for: .seconds(2))
        }
    }
}
