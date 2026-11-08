import Foundation
import Observation
import RavenKit

/// One question per screen, like the web onboarding. A picked resume is read in the background and
/// fills in whatever the person hasn't answered yet, so nothing ever waits on it.
@Observable
final class OnboardingModel {
    enum ResumeState: Equatable {
        case none
        case reading(fileName: String)
        case ready(ResumeDraft)
        case failed
    }

    enum Direction { case forward, back }

    private(set) var answers = OnboardingAnswers()
    /// answers that came from the resume and haven't been touched since
    private(set) var fromResume: Set<String> = []
    private(set) var position = 0
    private(set) var direction = Direction.forward
    private(set) var resume = ResumeState.none
    private(set) var isFinishing = false
    var errorMessage: String?
    private var reading: Task<Void, Never>?

    var questions: [OnboardingQuestion] {
        OnboardingQuestion.visible(for: answers)
    }

    var question: OnboardingQuestion {
        questions[min(position, questions.count - 1)]
    }

    var progress: Double {
        Double(position + 1) / Double(questions.count)
    }

    var isLast: Bool {
        position >= questions.count - 1
    }

    var isAnswered: Bool {
        answers.isAnswered(question.id)
    }

    var canSkip: Bool {
        !question.isRequired && !isAnswered
    }

    var isReadingResume: Bool {
        if case .reading = resume {
            return true
        }
        return false
    }

    var isWaitingForResume: Bool {
        isFinishing && isReadingResume
    }

    func answer(_ value: OnboardingAnswer) {
        answers[question.id] = value
        fromResume.remove(question.id)
    }

    /// starts reading and moves on straight away; the draft lands whenever the server is done
    func read(_ file: ResumeFile, using client: RavenClient) {
        resume = .reading(fileName: file.name)
        reading = Task {
            do {
                let draft = try await client.uploadResume(file)
                apply(draft)
            } catch {
                resume = .failed
            }
        }
        goForward()
    }

    func apply(_ draft: ResumeDraft) {
        resume = .ready(draft)
        let filled = OnboardingAnswers.prefill(from: draft.draft)
        for id in filled.answeredIDs where !answers.isAnswered(id) {
            answers[id] = filled[id]
            fromResume.insert(id)
        }
    }

    func goForward() {
        guard !isLast else { return }
        direction = .forward
        position += 1
    }

    /// moves on only if the person is still on that question, so a delayed auto-advance never skips one
    func goForward(from questionID: String) {
        guard question.id == questionID else { return }
        goForward()
    }

    func goBack() {
        guard position > 0 else { return }
        direction = .back
        position -= 1
    }

    func finish(using client: RavenClient) async -> Profile? {
        isFinishing = true
        await reading?.value
        let draft = if case let .ready(draft) = resume {
            draft
        } else {
            ResumeDraft?.none
        }
        do {
            return try await client.confirmProfile(answers.profile(resume: draft?.draft), documentId: draft?.documentId)
        } catch {
            errorMessage = error.message
            isFinishing = false
            return nil
        }
    }

    /// files from the picker live outside the sandbox until we ask for access
    static func load(_ url: URL) -> ResumeFile? {
        let isScoped = url.startAccessingSecurityScopedResource()
        defer {
            if isScoped {
                url.stopAccessingSecurityScopedResource()
            }
        }
        guard let data = try? Data(contentsOf: url) else { return nil }
        return ResumeFile(name: url.lastPathComponent, data: data)
    }

    #if DEBUG
        /// jumps straight to a question for screenshots, with an optional draft already applied
        static func preview(
            at questionID: String,
            draft: ResumeDraft? = nil,
            isReading: Bool = false,
            isFinishing: Bool = false,
        ) -> OnboardingModel {
            let model = OnboardingModel()
            if !["resume", "stage"].contains(questionID) {
                model.answers["stage"] = .choice("University or college")
            }
            if let draft {
                model.apply(draft)
            }
            model.position = model.questions.firstIndex { $0.id == questionID } ?? 0
            if isReading || isFinishing {
                model.resume = .reading(fileName: "Jordan_Lee_Resume.pdf")
            }
            model.isFinishing = isFinishing
            return model
        }
    #endif
}
