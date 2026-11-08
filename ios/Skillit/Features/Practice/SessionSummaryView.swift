import SkillitKit
import SwiftUI

/// The debrief as one calm page: the score, what worked, what to fix next, and every answer behind a disclosure.
/// Both lists use the same plain row so the page reads as one list, not three widgets. `debrief` is nil while it's being written.
struct SessionSummaryView: View {
    let debrief: SessionDebrief?
    let onPracticeAgain: () -> Void
    let onDone: () -> Void
    /// Opens the recording with every moment marked; nil when there's no session to replay.
    var onReplay: (() -> Void)?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 36) {
                if let debrief {
                    ScoreHeadline(score: debrief.overall, verdict: debrief.verdict)
                    if let onReplay {
                        ReplayEntryRow(action: onReplay)
                    }
                    if !debrief.strengths.isEmpty {
                        section("What worked") {
                            ForEach(Array(debrief.strengths.prefix(2)), id: \.quote) { strength in
                                DebriefRow(systemImage: "checkmark", tint: Theme.positive, text: strength.why)
                            }
                        }
                    }
                    if !debrief.improvements.isEmpty {
                        section("Work on next") {
                            ForEach(Array(debrief.improvements.prefix(3).enumerated()), id: \.offset) { _, improvement in
                                DebriefRow(
                                    systemImage: "arrow.right", tint: .secondary,
                                    text: improvement.better, example: improvement.example,
                                )
                            }
                        }
                    }
                    if !debrief.perQuestion.isEmpty {
                        everyAnswer(debrief.perQuestion)
                    }
                } else {
                    writing
                }
            }
            .padding(24)
        }
        .scrollIndicators(.hidden)
        .safeAreaInset(edge: .bottom) { actions }
        .background(Theme.ground)
        .animation(.smooth, value: debrief == nil)
    }

    private func everyAnswer(_ results: [SessionDebrief.QuestionResult]) -> some View {
        DisclosureGroup {
            VStack(spacing: 0) {
                ForEach(results.indices, id: \.self) { index in
                    QuestionRow(result: results[index])
                    if index < results.count - 1 {
                        Divider().overlay(Theme.hairline)
                    }
                }
            }
            .padding(.top, 8)
        } label: {
            Text("Every answer")
                .font(.headline)
                .foregroundStyle(.secondary)
        }
        .tint(.secondary)
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(title)
                .font(.headline)
                .foregroundStyle(.secondary)
            content()
        }
    }

    private var writing: some View {
        VStack(alignment: .leading, spacing: 24) {
            RoundedRectangle(cornerRadius: 12)
                .fill(Theme.raised)
                .frame(width: 140, height: 72)
                .shimmering()
            Label("Reviewing what you said…", systemImage: "waveform")
                .font(.footnote.weight(.medium))
                .foregroundStyle(Theme.agent)
            SkeletonLines(widths: [0.9, 0.6], highlighted: -1)
            SkeletonLines(widths: [0.8, 0.5, 0.7], highlighted: -1)
        }
    }

    /// Done always works: the debrief waits on every answer being scored, and one slow request mustn't trap the person here.
    private var actions: some View {
        VStack(spacing: 12) {
            Button("Practice again", action: onPracticeAgain)
                .buttonStyle(.raised)
                .disabled(debrief == nil)
                .opacity(debrief == nil ? 0.4 : 1)
            Button("Done", action: onDone)
                .font(.headline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, minHeight: 44)
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
        .background(Theme.ground)
    }
}

#if DEBUG
#Preview {
    SessionSummaryView(debrief: .sample, onPracticeAgain: {}, onDone: {})
}
#endif
