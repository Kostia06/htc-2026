import RavenKit
import SwiftUI

/// Each kind of card gets its own colour and symbol, so a scroll of the feed reads at a glance.
extension FeedCard.Kind {
    var tint: Color {
        switch self {
        case .job: Color(red: 0.30, green: 0.62, blue: 1.0)
        case .event: Color(red: 0.25, green: 0.80, blue: 0.55)
        case .hackathon: Theme.agent
        case .course: Color(red: 1.0, green: 0.78, blue: 0.25)
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

struct KindBadge: View {
    let kind: FeedCard.Kind
    var size: CGFloat = 44

    var body: some View {
        Image(systemName: kind.symbol)
            .font(.system(size: size * 0.4, weight: .semibold))
            .foregroundStyle(kind.tint)
            .frame(width: size, height: size)
            .background(kind.tint.opacity(0.16), in: .circle)
            .accessibilityLabel(kind.name)
    }
}
