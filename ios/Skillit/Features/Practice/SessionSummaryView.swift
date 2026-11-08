import SkillitKit
import SwiftUI

/// The debrief as one calm page: the score, two things that worked, up to three things to fix, two buttons.
/// Question-by-question detail waits behind one disclosure at the bottom. `debrief` is nil while it's being written.
struct SessionSummaryView: View {
    let debrief: SessionDebrief?
    let onPracticeAgain: () -> Void
    let onDone: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 40) {
                if let debrief {
                    ScoreHeadline(score: debrief.overall, verdict: debrief.verdict)
                    if !debrief.strengths.isEmpty {
                        wentWell(debrief.strengths.prefix(2))
                    }
                    if !debrief.improvements.isEmpty {
                        workOnNext(debrief.improvements.prefix(3))
                    }
                    if !debrief.perQuestion.isEmpty {
                        everyAnswer(debrief.perQuestion)
                    }
                } else {
                    writing
                }
            }
            .padding(24)
            .padding(.bottom, 120)
        }
        .scrollIndicators(.hidden)
        .safeAreaInset(edge: .bottom) { actions }
        .background(Theme.ground)
        .animation(.smooth, value: debrief == nil)
    }

    private func wentWell(_ strengths: ArraySlice<SessionDebrief.Strength>) -> some View {
        section("What went well") {
            ForEach(Array(strengths), id: \.quote) { strength in
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Image(systemName: "checkmark")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(Theme.action)
                    Text(strength.why)
                        .font(.body)
                }
            }
        }
    }

    private func workOnNext(_ improvements: ArraySlice<SessionDebrief.Improvement>) -> some View {
        section("Work on next") {
            ForEach(Array(improvements.enumerated()), id: \.offset) { index, improvement in
                ImprovementRow(number: index + 1, improvement: improvement)
            }
        }
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
            Text("See every answer")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.secondary)
        }
        .tint(.secondary)
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 16) {
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

    private var actions: some View {
        VStack(spacing: 12) {
            Button("Practice again", action: onPracticeAgain)
                .buttonStyle(.raised)
            Button("Done", action: onDone)
                .font(.headline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, minHeight: 44)
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
        .background(Theme.ground)
        .disabled(debrief == nil)
        .opacity(debrief == nil ? 0.4 : 1)
    }
}
