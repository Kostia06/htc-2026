import Foundation
import Observation
import SkillitKit

/// The tailored versions the person has saved, most recently changed first.
@Observable
final class TailoredResumesModel {
    private(set) var items: [TailoredResumeSummary] = []
    private(set) var hasLoaded = false
    private(set) var loadFailed = false

    let service: any TailoredResumeService

    init(service: any TailoredResumeService) {
        self.service = service
    }

    func load() async {
        do {
            items = try await service.tailoredResumes()
            loadFailed = false
        } catch {
            loadFailed = items.isEmpty
        }
        hasLoaded = true
    }
}
