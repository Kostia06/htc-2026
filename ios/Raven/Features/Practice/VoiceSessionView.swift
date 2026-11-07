import RavenKit
import SwiftUI

/// The full-screen spoken session: the current question, one voice bar, and a way out.
struct VoiceSessionView: View {
    let model: VoiceSessionModel

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Theme.ground.ignoresSafeArea()
            switch model.phase {
            case .live:
                live
            case .wrappingUp:
                SessionSummaryView(summary: nil, onDone: { dismiss() })
            case let .finished(summary):
                SessionSummaryView(summary: summary, onDone: { dismiss() })
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
                if let notice = model.notice {
                    Text(notice)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("End", action: end)
                    .buttonStyle(.glass)
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
