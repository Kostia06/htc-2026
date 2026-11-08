import RavenKit
import SwiftUI

extension RoadmapStep.Kind {
    var symbol: String {
        switch self {
        case .project: "hammer.fill"
        case .course: "book.fill"
        case .hackathon: "bolt.fill"
        case .event: "calendar"
        case .networking: "person.2.fill"
        case .certification: "rosette"
        case .volunteering: "heart.fill"
        case .application: "paperplane.fill"
        case .interviewPractice: "mic.fill"
        }
    }

    var name: String {
        switch self {
        case .interviewPractice: "Interview practice"
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

/// Where a node sits on the winding path: a gentle S-curve, the same shape Duolingo's path makes.
enum PathCurve {
    private static let offsets: [CGFloat] = [0, 44, 72, 44, 0, -44, -72, -44]

    static func offset(at position: Int) -> CGFloat {
        offsets[position % offsets.count]
    }
}

/// How a node looks, from where it is relative to the person's current step.
enum NodeState {
    case done, current, upcoming, skipped

    init(step: RoadmapStep, currentID: String?) {
        if step.id == currentID {
            self = .current
        } else {
            switch step.status {
            case .done: self = .done
            case .skipped: self = .skipped
            case .todo, .started: self = .upcoming
            }
        }
    }
}
