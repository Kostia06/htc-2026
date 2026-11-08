import SkillitKit
import SwiftUI

extension PrivateMemory.Kind {
    var title: String {
        switch self {
        case .goal: "Goal"
        case .skill: "Skill"
        case .weakness: "Working on"
        case .preference: "Preference"
        case .note: "Note"
        }
    }

    var symbol: String {
        switch self {
        case .goal: "flag.fill"
        case .skill: "star.fill"
        case .weakness: "arrow.up.forward"
        case .preference: "slider.horizontal.3"
        case .note: "note.text"
        }
    }
}

extension RoadLine.Kind {
    var title: String {
        switch self {
        case .struggle: "Struggle"
        case .tip: "What worked"
        case .interview: "Asked in interviews"
        case .win: "Way in"
        }
    }

    var symbol: String {
        switch self {
        case .struggle: "exclamationmark.triangle.fill"
        case .tip: "lightbulb.fill"
        case .interview: "questionmark.bubble.fill"
        case .win: "door.left.hand.open"
        }
    }

    /// Struggles are the one place coral appears: they are the hard part of the road, not an error.
    var tint: Color {
        switch self {
        case .struggle: Theme.negative
        case .win: Theme.positive
        case .tip, .interview: Color.secondary
        }
    }
}

extension RoadLine {
    /// Small print under the line: a real count, or that it's an example. Examples never read as people.
    var whoLine: String {
        switch (example, people) {
        case let (true, people?): "Example · \(people) people said me too"
        case (true, nil): "Example"
        case let (false, people?): "\(people) people"
        case (false, nil): ""
        }
    }
}

extension ResearchFact {
    var ageLine: String {
        switch ageDays {
        case 0: "today"
        case 1: "yesterday"
        default: "\(ageDays) days ago"
        }
    }
}
