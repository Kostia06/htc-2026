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
                    QuickUpdateConversation(model: model, focusTitle: focusTitle, isTyping: $isTyping)
                        // focused once the field exists; setting it before the field is on screen does nothing
                        .task { isTyping = true }
                } else {
                    Color.clear
                }
            }
            .background(Theme.ground)
            .navigationTitle(focusTitle == nil ? "Update" : "Mark done")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
        }
        // a swipe down closes the sheet too, so dictation is dropped here rather than in the Close button
        .onDisappear { model?.cancelListening() }
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
    let focusTitle: String?
    var isTyping: FocusState<Bool>.Binding

    private var hasStarted: Bool {
        model.messages.count > 1 || model.isThinking
    }

    var body: some View {
        ChatScrollView(hasStarted: hasStarted) {
            intro
        } lines: {
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
        .animation(.spring(duration: 0.4), value: model.messages)
        .animation(.spring(duration: 0.4), value: model.isThinking)
        .safeAreaInset(edge: .bottom) {
            ChatComposerBar(model: model, placeholder: placeholder, error: model.error, isFocused: isTyping)
        }
    }

    @ViewBuilder
    private var intro: some View {
        if let focusTitle {
            ChatIntro(
                symbol: "checkmark.circle",
                title: focusTitle,
                message: "What did you do for it? One line is enough, and I'll mark it done.",
                onStarter: start,
            )
        } else {
            ChatIntro(
                symbol: "point.topleft.down.to.point.bottomright.curvepath",
                title: "What's new?",
                message: "One line is enough. I'll update your road and profile. You can paste a job posting too.",
                starters: ["I finished", "I applied to", "I started learning"],
                onStarter: start,
            )
        }
    }

    private var placeholder: String {
        focusTitle == nil ? "What's new?" : "What did you do?"
    }

    private func start(with starter: String) {
        model.draft = starter + " "
        isTyping.wrappedValue = true
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
