import Foundation
import Observation
import RavenKit

/// The form behind "share how it went": what the person types, and whether it has been sent.
@Observable
final class ShareExperienceModel {
    enum Round: String, CaseIterable, Identifiable {
        case phoneScreen = "Phone screen", technical = "Technical", behavioural = "Behavioural", final = "Final", other = "Other"
        var id: String {
            rawValue
        }
    }

    enum Outcome: String, CaseIterable, Identifiable {
        case unsaid = "Prefer not to say", offer = "Got an offer", noOffer = "No offer", waiting = "Still waiting"
        var id: String {
            rawValue
        }
    }

    enum Phase: Equatable {
        case editing
        case sending
        case sent
        case failed(String)
    }

    var role = ""
    var round: Round = .technical
    var questions = [""]
    var tip = ""
    var outcome: Outcome = .unsaid
    private(set) var phase: Phase = .editing

    let companySlug: String
    private let service: any CompanyService

    init(companySlug: String, service: any CompanyService) {
        self.companySlug = companySlug
        self.service = service
    }

    var report: ExperienceReport {
        ExperienceReport(
            companySlug: companySlug,
            role: role,
            questions: questions,
            format: round.rawValue.lowercased(),
            outcome: outcome == .unsaid ? nil : outcome.rawValue,
            tips: tip,
        )
    }

    var canSend: Bool {
        report.isComplete && phase != .sending
    }

    var canAddQuestion: Bool {
        questions.count < ExperienceReport.maxQuestions && !(questions.last ?? "").trimmingCharacters(in: .whitespaces).isEmpty
    }

    func addQuestion() {
        guard canAddQuestion else { return }
        questions.append("")
    }

    func removeQuestion(at index: Int) {
        guard questions.count > 1, questions.indices.contains(index) else { return }
        questions.remove(at: index)
    }

    func send() async {
        guard canSend else { return }
        phase = .sending
        do {
            try await service.submitExperience(report)
            phase = .sent
        } catch let .rejected(status, message) where status == 429 {
            phase = .failed(message.isEmpty ? "You've shared a lot in the last hour. Try again later." : message)
        } catch {
            phase = .failed(error.message)
        }
    }
}
