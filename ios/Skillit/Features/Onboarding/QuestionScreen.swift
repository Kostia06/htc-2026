import SkillitKit
import SwiftUI

/// One question: its title and hint, a purple tag when the resume answered it, and the way to answer.
struct QuestionScreen: View {
    let question: OnboardingQuestion
    let answer: OnboardingAnswer?
    let isFromResume: Bool
    let onChange: (OnboardingAnswer) -> Void
    let pickResume: () -> Void
    let skipResume: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    if isFromResume {
                        FromResumeTag()
                    }
                    Text(question.title)
                        .font(.title2.bold())
                        .accessibilityAddTraits(.isHeader)
                    Text(question.hint)
                        .font(.body)
                        .foregroundStyle(.secondary)
                }
                answerArea
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 16)
            .animation(.smooth, value: isFromResume)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    @ViewBuilder private var answerArea: some View {
        switch question.kind {
        case .resume:
            ResumeChoice(pick: pickResume, skip: skipResume)
        case let .text(fields):
            TextFieldsQuestion(fields: fields, answer: answer, onChange: onChange)
        case .single, .multi:
            ChoiceQuestion(question: question, answer: answer, onChange: onChange)
        }
    }
}

private struct FromResumeTag: View {
    var body: some View {
        Label("From your resume", systemImage: "doc.text")
            .font(.footnote.weight(.semibold))
            .foregroundStyle(Theme.agent)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Theme.agent.opacity(0.16), in: .capsule)
            .transition(.opacity.combined(with: .scale(scale: 0.9)))
    }
}

private struct ResumeChoice: View {
    let pick: () -> Void
    let skip: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Button(action: pick) {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Yes, upload my resume")
                        Text("PDF, Word or a photo")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                } icon: {
                    Image(systemName: "doc.badge.arrow.up")
                        .foregroundStyle(Theme.action)
                }
            }
            .buttonStyle(OptionButtonStyle(isSelected: false))
            Button(action: skip) {
                Label("No, I'll answer a few questions", systemImage: "list.bullet")
            }
            .buttonStyle(OptionButtonStyle(isSelected: false))
        }
    }
}

private struct TextFieldsQuestion: View {
    let fields: [OnboardingQuestion.Field]
    let answer: OnboardingAnswer?
    let onChange: (OnboardingAnswer) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(fields) { field in
                VStack(alignment: .leading, spacing: 6) {
                    Text(field.label)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                    TextField(field.placeholder, text: binding(for: field.id))
                        .textContentType(field.id == "school" ? .organizationName : nil)
                        .padding(.horizontal, 16)
                        .frame(minHeight: 52)
                        .background(Theme.raised, in: .rect(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Theme.hairline))
                }
            }
        }
    }

    private var values: [String: String] {
        if case let .fields(values) = answer {
            return values
        }
        return [:]
    }

    private func binding(for id: String) -> Binding<String> {
        Binding(
            get: { values[id] ?? "" },
            set: { newValue in
                var updated = values
                updated[id] = String(newValue.prefix(120))
                onChange(.fields(updated))
            },
        )
    }
}
