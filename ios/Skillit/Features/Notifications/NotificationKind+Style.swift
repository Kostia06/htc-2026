import SkillitKit
import SwiftUI

extension NotificationKind {
    var symbol: String {
        switch self {
        case .reportReady: "chart.bar.doc.horizontal"
        case .resumeReady: "doc.text"
        case .deadline: "calendar.badge.clock"
        case .roadNudge: "point.topleft.down.to.point.bottomright.curvepath"
        case .interviewQuestion: "questionmark.bubble"
        case .companyNews: "building.2"
        case .feedMatch: "rectangle.stack"
        case .other: "bell"
        }
    }

    /// Sand for what Skillit made, teal for something good that arrived, coral only for time running out.
    var tint: Color {
        switch self {
        case .reportReady, .resumeReady: Theme.agent
        case .feedMatch: Theme.positive
        case .deadline: Theme.negative
        case .roadNudge: Theme.action
        case .interviewQuestion, .companyNews, .other: .secondary
        }
    }

    /// The settings screen's label for the toggle.
    var settingTitle: String {
        switch self {
        case .reportReady: "Practice reports"
        case .resumeReady: "Tailored resumes"
        case .deadline: "Saved deadlines"
        case .roadNudge: "Road reminders"
        case .interviewQuestion: "New interview questions"
        case .companyNews: "Company research"
        case .feedMatch: "New matches"
        case .other: "Other"
        }
    }

    var settingDetail: String {
        switch self {
        case .reportReady: "When feedback on a practice session is ready."
        case .resumeReady: "When a resume tailored for a job is ready."
        case .deadline: "Three days before something you saved closes or starts."
        case .roadNudge: "When your next step has waited three days."
        case .interviewQuestion: "Questions people reported at companies you're going for."
        case .companyNews: "Fresh news and hiring at companies you're going for."
        case .feedMatch: "The best new items in For you."
        case .other: ""
        }
    }
}
