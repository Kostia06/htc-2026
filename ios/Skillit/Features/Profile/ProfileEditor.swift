import Observation
import SkillitKit

/// Applies a profile edit on screen right away, then tells the server. A failed save resyncs from the server.
@Observable
final class ProfileEditor {
    /// Bumps once per confirmed save: drives the haptic and the "Saved" flash.
    private(set) var saveCount = 0
    private(set) var failure: String?
    private var inFlight = 0

    var isSaving: Bool { inFlight > 0 }

    func apply(_ edit: ProfileEdit, to app: AppModel) {
        let before = app.profile
        guard let patch = app.profile.apply(edit) else { return }
        guard let client = app.client else {
            // screenshots and previews have no server; the edit still lands on screen
            saveCount += 1
            return
        }
        Task { await save(patch, using: client, app: app, revertingTo: before) }
    }

    func dismissFailure() {
        failure = nil
    }

    private func save(_ patch: ProfilePatch, using client: SkillitClient, app: AppModel, revertingTo before: Profile) async {
        inFlight += 1
        defer { inFlight -= 1 }
        do {
            _ = try await client.updateProfile(patch)
            saveCount += 1
        } catch {
            failure = error.message
            // the server is the source of truth: take its copy, or what we had before the edit when it's unreachable
            app.profile = (try? await client.profile()) ?? before
        }
    }
}
