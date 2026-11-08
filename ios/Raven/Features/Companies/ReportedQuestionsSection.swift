import RavenKit
import SwiftUI

/// Questions people say they were asked here. Real ones surface only once three people report them; seeded ones are marked as examples.
struct ReportedQuestionsSection: View {
    static let minimumReports = 3

    let questions: [ReportedQuestion]
    let reportCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Asked recently here", systemImage: "quote.bubble")
                .font(.headline)
                .foregroundStyle(.secondary)
                .padding(.leading, 4)
            VStack(alignment: .leading, spacing: 14) {
                if questions.isEmpty {
                    Text("No questions yet.").font(.body)
                }
                ForEach(questions) { question in
                    QuestionRow(question: question)
                }
                if reportCount < Self.minimumReports {
                    Text(waitingNote)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .ravenCard()
        }
    }

    private var waitingNote: String {
        let remaining = Self.minimumReports - reportCount
        let soFar = reportCount == 0 ? "" : " \(reportCount) so far."
        return "Real reports appear once \(Self.minimumReports) people share similar questions.\(soFar) \(remaining) more to go."
    }
}

private struct QuestionRow: View {
    let question: ReportedQuestion

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(question.text).font(.body)
            HStack(spacing: 8) {
                if question.isExample {
                    Text("Example")
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color(white: 0.18), in: .capsule)
                        .foregroundStyle(.secondary)
                } else {
                    Text("Reported \(question.count)×")
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Theme.action.opacity(0.14), in: .capsule)
                        .foregroundStyle(Theme.action)
                    if let month = monthLabel {
                        Text(month).font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// "2026-10" as "Oct 2026": the server gives the month only, on purpose.
    private var monthLabel: String? {
        guard let raw = question.lastReportedMonth, let date = try? Date.ISO8601FormatStyle().year().month().parse(raw) else { return nil }
        return date.formatted(.dateTime.month(.abbreviated).year())
    }
}
