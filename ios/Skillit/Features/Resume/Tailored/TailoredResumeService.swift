import Foundation
import SkillitKit

/// Where tailored resumes come from: the server in the app, samples in previews.
protocol TailoredResumeService: Sendable {
    func tailoredResumes() async throws(SkillitError) -> [TailoredResumeSummary]
    func tailorResume(for source: TailorSource) async throws(SkillitError) -> TailoredResume
    func tailoredResume(id: String) async throws(SkillitError) -> TailoredResume
    func setChange(_ changeId: String, accepted: Bool, in tailoredId: String) async throws(SkillitError) -> TailoredResume
    func deleteTailoredResume(id: String) async throws(SkillitError)
    func tailoredPDFData(id: String) async throws(SkillitError) -> Data
    func postings() async throws(SkillitError) -> [JobPosting]
}

extension SkillitClient: TailoredResumeService {
    func tailoredPDFData(id: String) async throws(SkillitError) -> Data {
        try await tailoredResumePDF(id: id, using: .shared)
    }
}

/// Used only before sign-in finished; every call reports the app as offline.
struct UnavailableTailoredResumes: TailoredResumeService {
    func tailoredResumes() async throws(SkillitError) -> [TailoredResumeSummary] {
        throw .offline
    }

    func tailorResume(for _: TailorSource) async throws(SkillitError) -> TailoredResume {
        throw .offline
    }

    func tailoredResume(id _: String) async throws(SkillitError) -> TailoredResume {
        throw .offline
    }

    func setChange(_: String, accepted _: Bool, in _: String) async throws(SkillitError) -> TailoredResume {
        throw .offline
    }

    func deleteTailoredResume(id _: String) async throws(SkillitError) {
        throw .offline
    }

    func tailoredPDFData(id _: String) async throws(SkillitError) -> Data {
        throw .offline
    }

    func postings() async throws(SkillitError) -> [JobPosting] {
        throw .offline
    }
}

extension AppModel {
    /// The signed-in client, or samples in Debug so previews and screenshots have something to show.
    var tailoredResumeService: any TailoredResumeService {
        if let client {
            return client
        }
        #if DEBUG
            return SampleTailoredResumes()
        #else
            return UnavailableTailoredResumes()
        #endif
    }
}
