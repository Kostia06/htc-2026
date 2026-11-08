#if DEBUG
    import Foundation
    import SkillitKit

    extension OnboardingModel {
        /// picks the screen from `-SkillitOnboardingStep <question id | finishing>`, for screenshots of each step
        static func debugPreview() -> OnboardingModel {
            let step = UserDefaults.standard.string(forKey: "RavenOnboardingStep") ?? "resume"
            let draft = ResumeDraft(documentId: "preview", draft: .sample)
            switch step {
            case "finishing": return .preview(at: "time", draft: draft, isFinishing: true)
            case "reading": return .preview(at: "situation", isReading: true)
            case "resume", "stage": return .preview(at: step)
            default: return .preview(at: step, draft: draft)
            }
        }
    }
#endif
