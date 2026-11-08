import Foundation
import Observation
import SkillitKit

/// One tailored version on screen: accepting or reverting a change goes to the server, which rebuilds the copy.
@Observable
final class TailoredResumeModel {
    private(set) var tailored: TailoredResume
    /// The change whose toggle is on its way, so only that row shows it's busy.
    private(set) var pendingChangeId: String?
    private(set) var errorMessage: String?

    private let service: any TailoredResumeService

    init(tailored: TailoredResume, service: any TailoredResumeService) {
        self.tailored = tailored
        self.service = service
    }

    var acceptedCount: Int {
        tailored.changes.count { $0.accepted }
    }

    func setChange(_ change: TailorChange, accepted: Bool) async {
        guard pendingChangeId == nil else { return }
        pendingChangeId = change.id
        defer { pendingChangeId = nil }
        do {
            tailored = try await service.setChange(change.id, accepted: accepted, in: tailored.id)
            errorMessage = nil
        } catch {
            errorMessage = error.message
        }
    }

    func file(_ format: ResumeFileFormat, template: ResumeTemplate) async throws(SkillitError) -> URL {
        let data = try await service.tailoredFileData(id: tailored.id, format, template: template)
        let url = URL.temporaryDirectory.appending(path: "Resume - \(tailored.company).\(format.fileExtension)")
        do {
            try data.write(to: url, options: .atomic)
        } catch {
            throw .unreadableResponse
        }
        return url
    }

    /// True once the server has let go of it, so the screen can close.
    func delete() async -> Bool {
        do {
            try await service.deleteTailoredResume(id: tailored.id)
            return true
        } catch {
            errorMessage = error.message
            return false
        }
    }
}
