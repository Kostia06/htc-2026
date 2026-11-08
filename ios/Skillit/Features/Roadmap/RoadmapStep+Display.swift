import SkillitKit
import SwiftUI

extension RoadmapStep.Kind {
    var symbol: String {
        switch self {
        case .project: "hammer.fill"
        case .course: "book.fill"
        case .event: "calendar"
        case .certification: "rosette"
        case .volunteering: "heart.fill"
        case .application: "paperplane.fill"
        case .interviewPractice: "mic.fill"
        case .networkingPractice: "person.2.wave.2.fill"
        }
    }

    var name: String {
        switch self {
        case .interviewPractice: "Interview practice"
        case .networkingPractice: "Networking"
        default: rawValue.capitalized
        }
    }
}

extension RoadmapStep.Label {
    var text: String {
        switch self {
        case .readyNow: "Ready now"
        case .stretch: "Stretch"
        case .longTerm: "Long term"
        }
    }
}
