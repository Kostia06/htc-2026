import Observation
import SkillitKit

/// Applies a profile edit on screen right away, then tells the server. A failed save resyncs from the server.
@Observable
final class ProfileEditor {
    /// Bumps once per confirmed save: drives the haptic and the "Saved" flash.
    private(set) var saveCount = 0
    private(set) var failure: String?
    /// A failed skills save is shown in the Skills section, next to what just rolled back, not as an alert.
    private(set) var skillsFailure: String?
    private var inFlight = 0

    var isSaving: Bool { inFlight > 0 }

    func apply(_ edit: ProfileEdit, to app: AppModel) {
        commit(to: app, failingInto: \.failure) { $0.apply(edit) }
    }

    /// Everything done in the skills editor goes out as one patch.
    func saveSkills(_ draft: SkillsDraft, to app: AppModel) {
        skillsFailure = nil
        commit(to: app, failingInto: \.skillsFailure) { $0.applySkills(draft) }
    }

    func dismissFailure() {
        failure = nil
    }

    private func commit(
        to app: AppModel,
        failingInto failureSlot: ReferenceWritableKeyPath<ProfileEditor, String?>,
        change: (inout Profile) -> ProfilePatch?,
    ) {
        let before = app.profile
        guard let patch = change(&app.profile) else { return }
        guard let client = app.client else {
            // screenshots and previews have no server; the edit still lands on screen
            saveCount += 1
            return
        }
        Task { await save(patch, using: client, app: app, revertingTo: before, failingInto: failureSlot) }
    }

    private func save(
        _ patch: ProfilePatch,
        using client: SkillitClient,
        app: AppModel,
        revertingTo before: Profile,
        failingInto failureSlot: ReferenceWritableKeyPath<ProfileEditor, String?>,
    ) async {
        inFlight += 1
        defer { inFlight -= 1 }
        do {
            _ = try await client.updateProfile(patch)
            saveCount += 1
        } catch {
            self[keyPath: failureSlot] = error.message
            // the server is the source of truth: take its copy, or what we had before the edit when it's unreachable
            app.profile = (try? await client.profile()) ?? before
        }
    }
}
