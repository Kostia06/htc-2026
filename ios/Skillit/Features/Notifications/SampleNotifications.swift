#if DEBUG
    import Foundation
    import SkillitKit

    extension SkillitNotification {
        /// Previews and screenshots only.
        static let samples: [SkillitNotification] = {
            let now = Date.now
            let ago = { (minutes: Double) in now.addingTimeInterval(-minutes * 60).ISO8601Format() }
            return [
                SkillitNotification(
                    id: "nt_1", kind: .reportReady, title: "Your practice report is ready",
                    body: "Feedback on your practice interview for Shopify. You scored 78.", target: .report(id: "vs_1"), createdAt: ago(4),
                ),
                SkillitNotification(
                    id: "nt_2", kind: .deadline, title: "Calgary Hacks is in 2 days",
                    body: "You saved this from Calgary Hacks. Worth a look before it passes.",
                    target: .feed(id: "hackathon:calgary-hacks"), createdAt: ago(90),
                ),
                SkillitNotification(
                    id: "nt_3", kind: .interviewQuestion, title: "New interview question at Shopify",
                    body: "Data analyst: “Walk me through a messy join”", target: .company(slug: "shopify"), createdAt: ago(60 * 26),
                    readAt: ago(60 * 20),
                ),
                SkillitNotification(
                    id: "nt_4", kind: .roadNudge, title: "Next on your Road: Build a SQL dashboard",
                    body: "About 2 hours. A small step keeps the streak going.", target: .step(id: "st_1"), createdAt: ago(60 * 50),
                    readAt: ago(60 * 40),
                ),
            ]
        }()
    }
#endif
