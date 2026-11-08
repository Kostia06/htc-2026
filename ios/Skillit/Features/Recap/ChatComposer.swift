import SwiftUI

/// What the shared composer needs from a chat: the draft, whether it's busy, and how to send or talk.
protocol ChatDraftModel: AnyObject, Observable {
    var draft: String { get set }
    var isListening: Bool { get }
    var isThinking: Bool { get }
    var canSend: Bool { get }
    func sendDraft() async
    /// Starts listening, or stops and sends what was heard.
    func toggleListening()
}

/// One wide field with a single small button inside it: the mic while the field is empty, send once there's text,
/// stop while listening. Draws no surface, so the sheets and the glass Ask bar can each put it on their own.
struct ChatComposer<Model: ChatDraftModel>: View {
    @Bindable var model: Model
    let placeholder: String
    var isFocused: FocusState<Bool>.Binding

    var body: some View {
        HStack(alignment: .bottom, spacing: 4) {
            TextField(model.isListening ? "Listening…" : placeholder, text: $model.draft, axis: .vertical)
                .lineLimit(1 ... 5)
                .focused(isFocused)
                .disabled(model.isListening)
                .submitLabel(.send)
                .padding(.leading, 16)
                .padding(.vertical, 13)
                // a vertical field turns Return into a newline instead of calling onSubmit, so a typed Return sends here;
                // a paste adds more than one character at once and keeps its line breaks
                .onChange(of: model.draft) { old, new in
                    guard new == old + "\n" else { return }
                    model.draft = old
                    send()
                }
            trailingButton
                .padding(4)
        }
        .frame(minHeight: 48)
    }

    @ViewBuilder
    private var trailingButton: some View {
        if model.isListening {
            ComposerButton(symbol: "stop.fill", fill: Theme.agent, label: "Stop and send") { model.toggleListening() }
                .symbolEffect(.pulse, isActive: true)
        } else if model.draft.isEmpty {
            ComposerButton(symbol: "mic.fill", fill: nil, label: "Say it instead") {
                isFocused.wrappedValue = false
                model.toggleListening()
            }
            .disabled(model.isThinking)
        } else {
            ComposerButton(symbol: "arrow.up", fill: Theme.action, label: "Send", action: send)
                .disabled(!model.canSend)
                .opacity(model.canSend ? 1 : 0.4)
        }
    }

    private func send() {
        guard model.canSend else { return }
        Task { await model.sendDraft() }
    }
}

/// A 32-point circle inside a 40-point tap area, so the field keeps nearly all the width.
private struct ComposerButton: View {
    let symbol: String
    let fill: Color?
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(fill == nil ? Theme.agent : Theme.onAction)
                .frame(width: 32, height: 32)
                .background(fill ?? .clear, in: .circle)
                .frame(width: 40, height: 40)
                .contentShape(.circle)
                .contentTransition(.symbolEffect(.replace))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// The composer as it sits at the bottom of a chat sheet: the last error above a raised field.
struct ChatComposerBar<Model: ChatDraftModel>: View {
    let model: Model
    let placeholder: String
    let error: String?
    var isFocused: FocusState<Bool>.Binding

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let error {
                Label(error, systemImage: "exclamationmark.circle")
                    .font(.footnote)
                    .foregroundStyle(Theme.negative)
                    .padding(.horizontal, 8)
            }
            ChatComposer(model: model, placeholder: placeholder, isFocused: isFocused)
                .background(Theme.raised, in: .rect(cornerRadius: 24))
                .overlay(RoundedRectangle(cornerRadius: 24).strokeBorder(Theme.hairline))
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 12)
        .background(Theme.ground)
    }
}
