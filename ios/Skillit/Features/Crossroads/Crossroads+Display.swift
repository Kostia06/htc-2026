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

    /// How a match names the person's item: "matches your struggle".
    var noun: String {
        switch self {
        case .goal: "goal"
        case .skill: "skill"
        case .weakness: "struggle"
        case .preference: "preference"
        case .note: "note"
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
        case .struggle: "Common struggle"
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

    /// Lived things get "That's me too"; things to do get "Add to my road".
    var isAddable: Bool {
        self == .tip || self == .interview
    }
}

extension RoadLine {
    /// Why the line is on screen: a real count, and what of the person's it matches. Examples never read as people.
    func reason(matching item: YourItem?) -> String {
        [countLine, item.map(\.matchLine)].compactMap(\.self).joined(separator: " · ")
    }

    private var countLine: String? {
        guard let people else { return nil }
        if example {
            return "\(people) said me too"
        }
        return switch kind {
        case .struggle: "\(people) people hit this"
        case .tip: "\(people) people say it worked"
        case .interview: "\(people) people were asked this"
        case .win: "\(people) people got in this way"
        }
    }
}

extension YourItem {
    /// "matches your struggle “Froze on SQL joins…”", short enough to sit on one line under a card.
    var matchLine: String {
        let words = text.split(separator: " ")
        let short = words.count > 5 ? words.prefix(5).joined(separator: " ") + "…" : text
        return "matches your \(kind.noun) \u{201C}\(short)\u{201D}"
    }

    /// The share sheet takes a stored memory; only `memory` items are ever shared.
    var asMemory: PrivateMemory {
        PrivateMemory(id: id, kind: kind, text: text, createdAt: "")
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

    func reason(matching item: YourItem?) -> String {
        ["Researched \(ageLine)", item.map(\.matchLine)].compactMap(\.self).joined(separator: " · ")
    }
}
