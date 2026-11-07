import Foundation
import Observation
import RavenKit

@Observable
final class OnboardingModel {
    enum Step: Equatable {
        case choosing
        case reading(fileName: String)
        case reviewing
        case saving
    }

    private(set) var step: Step = .choosing
    var profile: Profile = .empty
    private(set) var missing: [String] = []
    private(set) var droppedClaims = 0
    var errorMessage: String?
    private var documentId: String?

    #if DEBUG
        static func preview(step: Step, draft: Profile, missing: [String]) -> OnboardingModel {
            let model = OnboardingModel()
            model.step = step
            model.profile = draft
            model.missing = missing
            model.droppedClaims = 1
            return model
        }
    #endif

    var canConfirm: Bool {
        !profile.isEmpty && step == .reviewing
    }

    func read(fileAt url: URL, using client: RavenClient) async {
        guard let file = Self.load(url) else {
            errorMessage = "Couldn't open that file. Try another one."
            return
        }
        step = .reading(fileName: file.name)
        do {
            let draft = try await client.uploadResume(file)
            documentId = draft.documentId
            profile = draft.draft
            missing = draft.missing
            droppedClaims = draft.droppedClaims
            step = .reviewing
        } catch {
            errorMessage = error.message
            step = .choosing
        }
    }

    func startFromScratch() {
        profile = .empty
        missing = ["Which role do you want next?"]
        step = .reviewing
    }

    func confirm(using client: RavenClient) async -> Profile? {
        step = .saving
        do {
            return try await client.confirmProfile(profile, documentId: documentId)
        } catch {
            errorMessage = error.message
            step = .reviewing
            return nil
        }
    }

    /// files from the picker live outside the sandbox until we ask for access
    private static func load(_ url: URL) -> ResumeFile? {
        let isScoped = url.startAccessingSecurityScopedResource()
        defer {
            if isScoped {
                url.stopAccessingSecurityScopedResource()
            }
        }
        guard let data = try? Data(contentsOf: url) else { return nil }
        return ResumeFile(name: url.lastPathComponent, data: data)
    }
}
