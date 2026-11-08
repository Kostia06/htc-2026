import SkillitKit
import SwiftUI

/// The full-screen spoken session: the current question, one voice bar, and a way out.
struct VoiceSessionView: View {
    let model: VoiceSessionModel
    let onPracticeAgain: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Theme.ground.ignoresSafeArea()
            switch model.phase {
            case .live:
                live
            case .wrappingUp:
                SessionSummaryView(debrief: nil, onPracticeAgain: onPracticeAgain, onDone: { dismiss() })
            case let .finished(debrief):
                SessionSummaryView(debrief: debrief, onPracticeAgain: onPracticeAgain, onDone: { dismiss() })
            case .closed:
                Color.clear.onAppear { dismiss() }
            case let .failed(message):
                failure(message)
            }
        }
        .animation(.smooth, value: model.phase)
        .task { await model.run() }
        .sensoryFeedback(.impact(weight: .light), trigger: model.voiceState)
    }

    private var live: some View {
        VStack(spacing: 28) {
            HStack {
                scoredBadge
                Spacer()
                Button("End", action: end)
                    .buttonStyle(.glass)
            }
            if model.questionCount > 0 {
                InterviewProgress(number: model.questionNumber, total: model.questionCount)
                    .transition(.opacity)
            }
            Spacer()
            questionText
            VoiceBar(state: model.voiceState, level: model.level)
            Text(model.voiceState.label)
                .font(.footnote.weight(.medium))
                .foregroundStyle(.secondary)
            tipText
            Spacer()
        }
        .padding(24)
        .animation(.easeInOut(duration: 0.3), value: model.questionCount)
    }

    /// Quiet proof that scoring is happening without pulling attention from the question.
    private var scoredBadge: some View {
        Label("\(model.answersScored) scored", systemImage: "checkmark.circle.fill")
            .font(.caption.weight(.medium))
            .foregroundStyle(Theme.agent)
            .opacity(model.answersScored > 0 ? 1 : 0)
            .contentTransition(.numericText())
            .animation(.spring(duration: 0.4), value: model.answersScored)
            .sensoryFeedback(.success, trigger: model.answersScored)
    }

    private var questionText: some View {
        VStack(spacing: 10) {
            if let question = model.question, question.isReported {
                Label(reportedLabel, systemImage: "person.2.wave.2")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Theme.agent)
            }
            Text(model.question?.text ?? "")
                .font(.title.weight(.semibold))
                .multilineTextAlignment(.center)
                // nothing on this screen scrolls, so a long question at a large text size shrinks rather than clips
                .minimumScaleFactor(0.5)
                .contentTransition(.opacity)
        }
        .frame(maxWidth: .infinity, minHeight: 160, alignment: .bottom)
        .animation(.easeInOut(duration: 0.3), value: model.question)
    }

    private var reportedLabel: String {
        model.company.map { "Asked recently at \($0)" } ?? "Asked recently in real interviews"
    }

    private var tipText: some View {
        ZStack {
            if let tip = model.tip {
                Text(tip)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .transition(.opacity)
            }
        }
        .frame(minHeight: 60)
        .animation(.easeInOut(duration: 0.5), value: model.tip)
        .task(id: model.tip) {
            guard model.tip != nil else { return }
            try? await Task.sleep(for: .seconds(5))
            guard !Task.isCancelled else { return }
            model.dismissTip()
        }
    }

    private func failure(_ message: String) -> some View {
        ContentUnavailableView {
            Label("Practice stopped", systemImage: "waveform.slash")
        } description: {
            Text(message)
        } actions: {
            Button("Close") { dismiss() }
                .buttonStyle(.glassProminent)
        }
    }

    private func end() {
        if model.hasStarted {
            model.end()
        } else {
            dismiss()
        }
    }
}
