import Foundation
import RavenKit

/// Where the resume comes from: the server in the app, sample data in previews and screenshots.
protocol ResumeService: Sendable {
    func resume() async throws(RavenError) -> SavedResume
    func saveResume(_ resume: Resume) async throws(RavenError) -> Resume
    func improveResume(section: Resume.Section?) async throws(RavenError) -> [ResumeSuggestion]
    func resumePDFData() async throws(RavenError) -> Data
}

extension RavenClient: ResumeService {
    func resumePDFData() async throws(RavenError) -> Data {
        try await resumePDF(using: .shared)
    }
}

/// Used only if the resume is shown before sign-in finished; every call reports the app as offline.
struct UnavailableResume: ResumeService {
    func resume() async throws(RavenError) -> SavedResume {
        throw .offline
    }

    func saveResume(_: Resume) async throws(RavenError) -> Resume {
        throw .offline
    }

    func improveResume(section _: Resume.Section?) async throws(RavenError) -> [ResumeSuggestion] {
        throw .offline
    }

    func resumePDFData() async throws(RavenError) -> Data {
        throw .offline
    }
}

enum ResumeLinks {
    /// The web resume builder a teammate is still building; swap in its real address when it ships.
    static let webBuilder = URL(string: "https://raven-vr.ilnkostia-dev.workers.dev/resume")!
}
