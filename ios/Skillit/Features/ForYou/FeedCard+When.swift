import Foundation
import SkillitKit

/// How a card's date reads, shared by the card and its detail sheet so the two never disagree.
extension FeedCard {
    /// The day it happens or was posted ("Nov 16"); a label such as "ongoing" is shown as the source gave it.
    var dayText: String? {
        guard let date else { return when?.capitalized }
        // a day-only date ("2027-01-26") is parsed as UTC midnight; showing it in local time would say the day before
        let isDayOnly = when?.count == 10
        return date.formatted(Date.FormatStyle(timeZone: isDayOnly ? .gmt : .current).month(.abbreviated).day())
    }

    /// The short form on a card: a job's freshness ("Posted 2 d ago"), otherwise the day.
    var cardWhenText: String? {
        guard kind == .job, let date else { return dayText }
        return "Posted \(RelativeTime.phrase(for: date))"
    }
}
