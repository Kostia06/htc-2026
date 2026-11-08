import Foundation
import SkillitKit

/// Where the resume comes from: the server in the app, sample data in previews and screenshots.
protocol ResumeService: Sendable {
    func resume() async throws(SkillitError) -> SavedResume
    func saveResume(_ resume: Resume) async throws(SkillitError) -> Resume
    func improveResume(section: Resume.Section?) async throws(SkillitError) -> [ResumeSuggestion]
    func resumeFileData(_ format: ResumeFileFormat, template: ResumeTemplate) async throws(SkillitError) -> Data
}

extension SkillitClient: ResumeService {
    func resumeFileData(_ format: ResumeFileFormat, template: ResumeTemplate) async throws(SkillitError) -> Data {
        try await resumeFile(format, template: template, using: .shared)
    }
}

/// Used only if the resume is shown before sign-in finished; every call reports the app as offline.
struct UnavailableResume: ResumeService {
    func resume() async throws(SkillitError) -> SavedResume {
        throw .offline
    }

    func saveResume(_: Resume) async throws(SkillitError) -> Resume {
        throw .offline
    }

    func improveResume(section _: Resume.Section?) async throws(SkillitError) -> [ResumeSuggestion] {
        throw .offline
    }

    func resumeFileData(_: ResumeFileFormat, template _: ResumeTemplate) async throws(SkillitError) -> Data {
        throw .offline
    }
}

enum ResumeLinks {
    /// The web app's resume builder (the `/resume` route in web/src/app/App.jsx).
    static let webBuilder = URL(string: "https://app.skillit.study/resume")!
}
