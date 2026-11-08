import Foundation

/// Server timestamps as short, human phrases: "just now", "5 min ago", "2 h ago", "3 d ago", then a date.
public enum RelativeTime {
    private static let withFraction: Date.ISO8601FormatStyle = .iso8601.year().month().day().time(includingFractionalSeconds: true)
    private static let plain: Date.ISO8601FormatStyle = .iso8601

    /// Accepts the server's `toISOString()` form (fractional seconds) and the plain form.
    public static func date(from iso: String?) -> Date? {
        guard let iso else { return nil }
        return (try? withFraction.parse(iso)) ?? (try? plain.parse(iso))
    }

    public static func phrase(for date: Date, now: Date = .now) -> String {
        let seconds = Int(now.timeIntervalSince(date).rounded())
        switch seconds {
        case ..<60: return "just now"
        case ..<3600: return "\(seconds / 60) min ago"
        case ..<86400: return "\(seconds / 3600) h ago"
        case ..<(7 * 86400): return "\(seconds / 86400) d ago"
        default: return date.formatted(.dateTime.day().month(.abbreviated))
        }
    }

    public static func phrase(for iso: String?, now: Date = .now) -> String? {
        date(from: iso).map { phrase(for: $0, now: now) }
    }
}
