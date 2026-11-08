import RavenKit
import SwiftUI

/// Questions people say they were asked here, count first. Real ones surface only once three people report them;
/// seeded ones are marked as examples.
struct ReportedQuestionsSection: View {
    static let minimumReports = 3

    let questions: [ReportedQuestion]
    let reportCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if reportCount < Self.minimumReports {
                unlockProgress
            }
            if questions.isEmpty {
                Text("No questions yet.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(questions.enumerated()), id: \.element.id) { index, question in
                        ReportedQuestionRow(question: question)
                        if index < questions.count - 1 {
                            Divider().overlay(Theme.hairline).padding(.vertical, 10)
                        }
                    }
                }
                .ravenCard()
            }
        }
    }

    private var unlockProgress: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(reportCount) of \(Self.minimumReports) reports to unlock real questions")
                .font(.caption)
                .foregroundStyle(.secondary)
            ThinProgressBar(fraction: Double(reportCount) / Double(Self.minimumReports), tint: Theme.positive)
        }
        .padding(.horizontal, 4)
    }
}

private struct ReportedQuestionRow: View {
    let question: ReportedQuestion

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            count
                .frame(width: 40, alignment: .leading)
            VStack(alignment: .leading, spacing: 3) {
                Text(question.text).font(.subheadline)
                if let caption {
                    Text(caption).font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private var count: some View {
        if question.isExample {
            Image(systemName: "text.quote")
                .font(.title3)
                .foregroundStyle(.tertiary)
        } else {
            Text("\(question.count)×")
                .font(.title3.weight(.semibold).monospacedDigit())
        }
    }

    private var caption: String? {
        question.isExample ? "Example" : monthLabel
    }

    /// "2026-10" as "Oct 2026": the server gives the month only, on purpose.
    private var monthLabel: String? {
        guard let raw = question.lastReportedMonth, let date = try? Date.ISO8601FormatStyle().year().month().parse(raw) else { return nil }
        return date.formatted(.dateTime.month(.abbreviated).year())
    }
}
