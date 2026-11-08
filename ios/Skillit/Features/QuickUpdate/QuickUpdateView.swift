import SkillitKit
import SwiftUI

/// "What's new?": a sheet where the person types or says one update in plain words and Skillit applies it,
/// asking one question only when it can't be applied otherwise. Present it as a sheet from the roadmap.
struct QuickUpdateView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var model: QuickUpdateModel?
    @FocusState private var isTyping: Bool

    /// Set when marking one roadmap step done, so the chat starts by asking about that step.
    var focusTitle: String?
    /// Called after every reply that changed something, so the parent can reload what it shows.
    let onApplied: ([AppliedChange]) -> Void

    var body: some View {
        NavigationStack {
            Group {
                if let model {
                    QuickUpdateConversation(model: model, isTyping: $isTyping)
                } else {
                    Color.clear
                }
            }
            .background(Theme.ground)
            .navigationTitle(focusTitle == nil ? "Update" : "Mark done")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") {
                        model?.stopListening()
                        dismiss()
                    }
                }
            }
        }
        .task {
            guard model == nil else { return }
            // screenshots and previews run without a signed-in client; they get the offline service and a scripted mic
            if let client = app.client {
                model = QuickUpdateModel(service: client, dictation: SpeechDictation(), focusTitle: focusTitle, onApplied: applied)
            } else {
                model = QuickUpdateModel(
                    service: OfflineQuickUpdateService(), dictation: ScriptedDictation(), focusTitle: focusTitle, onApplied: applied,
                )
            }
            isTyping = true
        }
    }

    /// The app model refreshes what it holds; the parent reloads what it shows.
    private func applied(_ changes: [AppliedChange]) {
        app.noteApplied(changes)
        onApplied(changes)
    }
}

private struct QuickUpdateConversation: View {
    @Bindable var model: QuickUpdateModel
    var isTyping: FocusState<Bool>.Binding

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(model.messages) { message in
                    RecapBubble(message: message)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                    if let changes = model.appliedAfter[message.id] {
                        AppliedCard(changes: changes)
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                }
                if model.isThinking {
                    TypingIndicator()
                        .transition(.opacity)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .animation(.spring(duration: 0.4), value: model.messages)
            .animation(.spring(duration: 0.4), value: model.isThinking)
        }
        .defaultScrollAnchor(.bottom)
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom) { composer }
    }

    private var composer: some View {
        VStack(spacing: 10) {
            if let error = model.error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(Theme.action)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            HStack(alignment: .bottom, spacing: 10) {
                micButton
                TextField(model.isListening ? "Listening…" : "Say what's new", text: $model.draft, axis: .vertical)
                    .lineLimit(1 ... 4)
                    .focused(isTyping)
                    .disabled(model.isListening)
                    .submitLabel(.send)
                    .onSubmit { Task { await model.sendDraft() } }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 13)
                    .background(Theme.raised, in: .rect(cornerRadius: 24))
                    .overlay(RoundedRectangle(cornerRadius: 24).strokeBorder(Theme.hairline))
                Button {
                    Task { await model.sendDraft() }
                } label: {
                    Image(systemName: "arrow.up")
                        .font(.body.weight(.bold))
                        .frame(width: 48, height: 48)
                }
                .buttonStyle(.glassProminent)
                .buttonBorderShape(.circle)
                .tint(Theme.action)
                .disabled(!model.canSend)
                .accessibilityLabel("Send")
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.bar)
    }

    /// Tap to talk, tap again to stop; what was heard goes out as the update.
    private var micButton: some View {
        Button {
            if model.isListening {
                model.stopListening()
            } else {
                isTyping.wrappedValue = false
                model.startListening()
            }
        } label: {
            Image(systemName: model.isListening ? "stop.fill" : "mic.fill")
                .font(.title3.weight(.semibold))
                .frame(width: 56, height: 56)
                .contentTransition(.symbolEffect(.replace))
        }
        .buttonStyle(.glassProminent)
        .buttonBorderShape(.circle)
        .tint(Theme.agent)
        .disabled(model.isThinking)
        .symbolEffect(.pulse, isActive: model.isListening)
        .accessibilityLabel(model.isListening ? "Stop and send" : "Say it instead")
    }
}

#if DEBUG
    #Preview {
        Color.clear
            .sheet(isPresented: .constant(true)) {
                QuickUpdateView(onApplied: { _ in })
            }
            .environment(AppModel.preview(profile: .empty))
    }
#endif
