import Foundation
import Observation
import SkillitKit

/// The resume on screen, the coach's pending suggestions, and the quiet saves that follow every edit.
@Observable
final class ResumeModel {
    enum Phase: Equatable {
        case loading
        case ready
        case failed(String)
    }

    private(set) var phase: Phase = .loading
    var resume: Resume = .empty
    /// False while the resume is only the profile laid out as one; true once the person has saved an edit.
    private(set) var isSaved = false
    private(set) var suggestions: [ResumeSuggestion] = []
    private(set) var isImproving = false
    /// What the coach had to say when it came back with nothing, or why it couldn't run.
    private(set) var coachNote: String?
    private(set) var acceptedCount = 0
    private(set) var saveFailed = false

    private let service: any ResumeService
    private var saveTask: Task<Void, Never>?

    init(service: any ResumeService) {
        self.service = service
    }

    func load() async {
        if resume.isEmpty {
            phase = .loading
        }
        do {
            let saved = try await service.resume()
            resume = saved.resume
            isSaved = saved.saved
            phase = .ready
        } catch {
            phase = resume.isEmpty ? .failed(error.message) : .ready
        }
    }

    /// Called when a section sheet closes, however it closed (Done or a swipe down), so no edit is left unsaved.
    func finishEditing(from before: Resume) {
        resume.dropEmptyBullets()
        guard resume != before else { return }
        commit()
    }

    /// The edit is already on screen; this sends it along behind the scenes, one save after another.
    func commit() {
        saveFailed = false
        let snapshot = resume
        saveTask = Task { [previous = saveTask] in
            await previous?.value
            await save(snapshot)
        }
    }

    private func save(_ snapshot: Resume) async {
        do {
            let saved = try await service.saveResume(snapshot)
            isSaved = true
            // only the server's timestamp changes; newer local edits must not be rolled back
            resume.updatedAt = saved.updatedAt
        } catch {
            saveFailed = true
        }
    }

    func improve(section: Resume.Section? = nil) async {
        guard !isImproving else { return }
        isImproving = true
        coachNote = nil
        defer { isImproving = false }
        do {
            let fresh = try await service.improveResume(section: section)
            suggestions = fresh.filter { resume.text(at: $0.path) != nil }
            if suggestions.isEmpty {
                coachNote = "Skillit read it through and has nothing to tighten up right now."
            }
        } catch {
            coachNote = error.message
        }
    }

    func accept(_ suggestion: ResumeSuggestion) {
        guard resume.apply(suggestion) else {
            skip(suggestion)
            return
        }
        acceptedCount += 1
        suggestions.removeAll { $0.id == suggestion.id }
        commit()
    }

    func skip(_ suggestion: ResumeSuggestion) {
        suggestions.removeAll { $0.id == suggestion.id }
    }

    /// Downloads the PDF to a temp file the share sheet can hand on.
    func pdfFile() async throws(SkillitError) -> URL {
        let data = try await service.resumePDFData()
        let url = URL.temporaryDirectory.appending(path: "Resume.pdf")
        do {
            try data.write(to: url, options: .atomic)
        } catch {
            throw .unreadableResponse
        }
        return url
    }
}

private extension Resume {
    /// "Add bullet" leaves a blank field behind if the person never typed in it; it shouldn't reach the PDF.
    mutating func dropEmptyBullets() {
        for index in experience.indices {
            experience[index].bullets.removeAll(where: \.isBlank)
        }
        for index in projects.indices {
            projects[index].bullets.removeAll(where: \.isBlank)
        }
    }
}

private extension String {
    var isBlank: Bool {
        trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}
