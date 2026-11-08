import Foundation
import Observation
import SkillitKit

/// The "tailor for a job" flow: pick a saved posting or paste one, wait, then show the result.
@Observable
final class TailorJobModel {
    enum Phase {
        case choosing
        case tailoring
        case done(TailoredResumeModel)
        case failed(String)
    }

    /// Long enough to be a posting rather than a stray line; the server makes the real call.
    static let minimumPastedLength = 80

    private(set) var phase: Phase = .choosing
    private(set) var postings: [JobPosting] = []
    var selectedPostingId: String?
    var pastedText = ""

    let service: any TailoredResumeService

    init(service: any TailoredResumeService) {
        self.service = service
    }

    var source: TailorSource? {
        if let selectedPostingId { return .posting(id: selectedPostingId) }
        let text = pastedText.trimmingCharacters(in: .whitespacesAndNewlines)
        return text.count >= Self.minimumPastedLength ? .text(text) : nil
    }

    func loadPostings() async {
        postings = (try? await service.postings()) ?? []
    }

    func tailor(_ source: TailorSource) async -> TailoredResume? {
        phase = .tailoring
        do {
            let tailored = try await service.tailorResume(for: source)
            phase = .done(TailoredResumeModel(tailored: tailored, service: service))
            return tailored
        } catch {
            phase = .failed(error.message)
            return nil
        }
    }

    func startOver() {
        phase = .choosing
    }
}
