import RavenKit
import SwiftUI

/// Big tiles for a single pick, wrapping chips for several, and an optional line to type your own.
struct ChoiceQuestion: View {
    let question: OnboardingQuestion
    let answer: OnboardingAnswer?
    let onChange: (OnboardingAnswer) -> Void

    @State private var custom = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if isMulti {
                FlowLayout { tiles(isFullWidth: false) }
            } else {
                VStack(spacing: 6) { tiles(isFullWidth: true) }
            }
            if question.allowsOther {
                OtherField(text: $custom, prompt: isMulti ? "Add your own" : "Or type your own", isDisabled: isFull, add: addCustom)
            }
        }
    }

    private func tiles(isFullWidth: Bool) -> some View {
        ForEach(options, id: \.self) { option in
            let isOn = selected.contains(option)
            Button(option) { toggle(option) }
                .buttonStyle(OptionButtonStyle(isSelected: isOn, isFullWidth: isFullWidth))
                .disabled(!isOn && isFull)
                .accessibilityAddTraits(isOn ? .isSelected : [])
        }
    }

    private var isMulti: Bool {
        if case .multi = question.kind {
            return true
        }
        return false
    }

    private var limit: Int {
        if case let .multi(_, max) = question.kind {
            return max
        }
        return 1
    }

    private var selected: [String] {
        switch answer {
        case let .choice(value): [value]
        case let .choices(values): values
        default: []
        }
    }

    /// typed answers show up as tiles too, so they can be seen and taken back
    private var options: [String] {
        question.options + selected.filter { !question.options.contains($0) }
    }

    private var isFull: Bool {
        isMulti && selected.count >= limit
    }

    private func toggle(_ option: String) {
        guard isMulti else { return onChange(.choice(option)) }
        if selected.contains(option) {
            onChange(.choices(selected.filter { $0 != option }))
        } else if !isFull {
            onChange(.choices(selected + [option]))
        }
    }

    private func addCustom() {
        let text = custom.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        custom = ""
        if isMulti {
            if !selected.contains(text), !isFull {
                onChange(.choices(selected + [text]))
            }
        } else {
            onChange(.choice(text))
        }
    }
}

private struct OtherField: View {
    @Binding var text: String
    let prompt: String
    let isDisabled: Bool
    let add: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            TextField(prompt, text: $text)
                .textInputAutocapitalization(.sentences)
                .submitLabel(.done)
                .onSubmit(add)
                .padding(.horizontal, 16)
                .frame(minHeight: 52)
                .background(Theme.raised, in: .rect(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Theme.hairline))
            Button("Add", action: add)
                .font(.headline)
                .foregroundStyle(Theme.action)
                .padding(.horizontal, 8)
                .disabled(isDisabled || text.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .onChange(of: text) { _, newValue in
            if newValue.count > 80 {
                text = String(newValue.prefix(80))
            }
        }
    }
}
