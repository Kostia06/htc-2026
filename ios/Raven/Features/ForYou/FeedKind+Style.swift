import RavenKit
import SwiftUI

/// Each kind of card gets its own symbol and a quiet glyph colour, so a scroll of the feed reads at a glance.
extension FeedCard.Kind {
    var tint: Color {
        switch self {
        // pastels to sit beside the action and agent tints, never louder than them
        case .job: Color(red: 0.66, green: 0.80, blue: 1.0)
        case .event: Color(red: 1.0, green: 0.80, blue: 0.68)
        case .hackathon: Color(red: 1.0, green: 0.73, blue: 0.86)
        case .course: Color(red: 1.0, green: 0.92, blue: 0.64)
        }
    }

    var symbol: String {
        switch self {
        case .job: "briefcase.fill"
        case .hackathon: "trophy.fill"
        case .course: "book.closed.fill"
        case .event: "person.3.fill"
        }
    }

    var name: String {
        switch self {
        case .job: "Job"
        case .hackathon: "Hackathon"
        case .course: "Course"
        case .event: "Event"
        }
    }
}

/// A neutral disc with the kind's glyph; the tint lives only in the glyph so the card itself stays grey.
struct KindBadge: View {
    let kind: FeedCard.Kind
    @ScaledMetric(relativeTo: .headline) private var size: CGFloat = 44

    var body: some View {
        Image(systemName: kind.symbol)
            .font(.headline.weight(.semibold))
            .foregroundStyle(kind.tint)
            .frame(width: size, height: size)
            .background(Theme.chip, in: .circle)
            .accessibilityLabel(kind.name)
    }
}
