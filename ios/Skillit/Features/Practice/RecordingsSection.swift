import SkillitKit
import SwiftUI

/// The latest finished interviews, one tap from their replay. Everything older lives in the full history.
struct RecordingsSection: View {
    let sessions: [PracticeSessionSummary]
    let onOpen: (PracticeSessionSummary) -> Void
    let onSeeAll: () -> Void

    private static let shown = 4

    private var recordings: [PracticeSessionSummary] {
        Array(sessions.filter { $0.status == .finished }.prefix(Self.shown))
    }

    var body: some View {
        if !recordings.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Recordings").font(.headline)
                    Spacer()
                    Button("See all", action: onSeeAll)
                        .font(.subheadline)
                        .foregroundStyle(Theme.action)
                }
                .padding(.top, 8)
                ForEach(recordings) { session in
                    Button { onOpen(session) } label: { row(session) }
                        .buttonStyle(.plain)
                        .accessibilityHint("Plays the recording with its marked moments")
                }
            }
        }
    }

    private func row(_ session: PracticeSessionSummary) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "play.circle.fill")
                .font(.title2)
                .foregroundStyle(Theme.agent)
            VStack(alignment: .leading, spacing: 2) {
                Text(session.companyName.map { "Interview at \($0)" } ?? "Practice interview")
                    .font(.subheadline.weight(.semibold))
                Text(detail(session))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if let score = session.score {
                Text("\(Int(score.rounded()))")
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(score >= 60 ? Theme.positive : Theme.negative)
            }
        }
        .contentShape(.rect)
        .skillitCard()
    }

    private func detail(_ session: PracticeSessionSummary) -> String {
        let answers = "\(session.turnCount) answer\(session.turnCount == 1 ? "" : "s")"
        let stamp = session.finishedAt ?? session.createdAt
        guard let date = ISO8601DateFormatter.flexible.date(from: stamp) ?? ISO8601DateFormatter().date(from: stamp) else {
            return answers
        }
        return "\(date.formatted(.relative(presentation: .named))) · \(answers)"
    }
}

private extension ISO8601DateFormatter {
    /// Server timestamps sometimes carry fractional seconds and sometimes don't.
    static let flexible: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
