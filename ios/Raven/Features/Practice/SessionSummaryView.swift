import RavenKit
import SwiftUI

/// The debrief: one score, what worked, what to fix and how, question by question. `debrief` is nil while it's being written.
struct SessionSummaryView: View {
    let debrief: SessionDebrief?
    let onPracticeAgain: () -> Void
    let onDone: () -> Void

    @State private var expanded: Set<Int> = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                if let debrief {
                    header(debrief)
                    section("What worked") {
                        ForEach(debrief.strengths.indices, id: \.self) { StrengthCard(strength: debrief.strengths[$0]) }
                    }
                    section("What to change", detail: "Tap one to see the rewrite") {
                        ForEach(debrief.improvements.indices, id: \.self) { index in
                            ImprovementCard(improvement: debrief.improvements[index], isExpanded: binding(for: index))
                        }
                    }
                    if !debrief.perQuestion.isEmpty {
                        section("Question by question") { questionList(debrief.perQuestion) }
                    }
                    if !debrief.nextSteps.isEmpty {
                        section("Before the next one") { nextSteps(debrief.nextSteps) }
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

    private func header(_ debrief: SessionDebrief) -> some View {
        VStack(spacing: 20) {
            ScoreRing(score: debrief.overall)
            Text(debrief.verdict)
                .font(.title3.weight(.semibold))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 12)
    }

    private var writing: some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack(spacing: 14) {
                Circle()
                    .stroke(Color(white: 0.16), lineWidth: 12)
                    .frame(width: 148, height: 148)
                    .shimmering()
            }
            .frame(maxWidth: .infinity)
            Label("Reviewing what you said…", systemImage: "sparkles")
                .font(.footnote.weight(.medium))
                .foregroundStyle(Theme.agent)
            SkeletonLines().ravenCard()
            SkeletonLines(widths: [0.5, 0.9, 0.7], highlighted: 0).ravenCard()
            SkeletonLines(widths: [0.8, 0.6], highlighted: 1).ravenCard()
        }
    }

    private func section(_ title: String, detail: String? = nil, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                if let detail {
                    Text(detail).font(.caption).foregroundStyle(.secondary)
                }
            }
            content()
        }
    }

    private func questionList(_ results: [SessionDebrief.QuestionResult]) -> some View {
        VStack(spacing: 0) {
            ForEach(results.indices, id: \.self) { index in
                QuestionRow(result: results[index])
                if index < results.count - 1 {
                    Divider().overlay(Theme.hairline)
                }
            }
        }
        .ravenCard()
    }

    private func nextSteps(_ steps: [String]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(steps.indices, id: \.self) { index in
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "\(index + 1).circle.fill")
                        .foregroundStyle(Theme.action)
                    Text(steps[index]).font(.subheadline)
                }
            }
        }
        .ravenCard()
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

    private func binding(for index: Int) -> Binding<Bool> {
        Binding(
            get: { expanded.contains(index) },
            set: { isOpen in
                if isOpen { expanded.insert(index) } else { expanded.remove(index) }
            },
        )
    }
}
