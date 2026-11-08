import Foundation
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

extension RoadmapStep {
    /// Interview steps start a spoken session in the app; everything else is marked done by hand.
    var isPractice: Bool {
        action != nil
    }

    var actionTitle: String {
        action == nil ? "Mark done" : "Start interview"
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

extension CompletedDay {
    /// "Today", "Yesterday", or a short date, from the server's `yyyy-MM-dd` key.
    var title: String {
        let today = RoadmapPage.dayKey(.now)
        if day == today {
            return "Today"
        }
        if let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: .now), day == RoadmapPage.dayKey(yesterday) {
            return "Yesterday"
        }
        guard let date = Self.parser.date(from: day) else { return day }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }

    private static let parser: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
