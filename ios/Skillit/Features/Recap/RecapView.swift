import SkillitKit
import SwiftUI

/// "Tell Skillit how it went": a chat sheet where the person talks about a real interview, typed or spoken, and Skillit
/// pulls out the company, role, round and questions, asking back only when something essential is missing. Present it as a sheet.
///
/// Entry points are the parent's: the company page, the roadmap step after a real interview, and the Practice tab.
public struct RecapView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var model: RecapModel?
    @FocusState private var isTyping: Bool

    private let companySlug: String?
    private let voice: any RecapVoice

    /// `companySlug` is the company the person interviewed at, when the screen already knows it; Skillit then never asks.
    /// `voice` is the engine for the mic button; the parent passes the ElevenLabs adapter, the default only ends the call.
    public init(companySlug: String?, voice: any RecapVoice = ScriptedRecapVoice.unavailable) {
        self.companySlug = companySlug
        self.voice = voice
    }

    init(model: RecapModel) {
        companySlug = model.companySlug
        voice = ScriptedRecapVoice.unavailable
        _model = State(initialValue: model)
    }

    public var body: some View {
        NavigationStack {
            Group {
                if let model {
                    RecapConversation(model: model, isTyping: $isTyping, onDone: { dismiss() })
                } else {
                    Color.clear
                }
            }
            .background(Theme.ground)
            .navigationTitle("How it went")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
        }
        // a swipe down closes the sheet too, so the voice call is ended here rather than in the Close button
        .onDisappear { model?.stopVoice() }
        .task {
            guard model == nil else { return }
            // screenshots and previews run without a signed-in client; they get the offline recap instead of the server
            let service: any RecapService = if let client = app.client {
                client
            } else {
                OfflineRecapService()
            }
            model = RecapModel(companySlug: companySlug, service: service, voice: voice)
        }
    }
}

private struct RecapConversation: View {
    @Bindable var model: RecapModel
    var isTyping: FocusState<Bool>.Binding
    let onDone: () -> Void

    private var hasStarted: Bool {
        model.messages.count > 1 || model.isThinking || model.isListening
    }

    var body: some View {
        ChatScrollView(hasStarted: hasStarted) {
            ChatIntro(
                symbol: "text.bubble",
                title: "How did it go?",
                message: "Tell me like you'd tell a friend: where it was, which round, what they asked. "
                    + "Type it, or tap the mic and just talk.",
                starters: ["It was the technical round at", "They asked me about", "I think it went well because"],
                onStarter: { starter in
                    model.draft = starter + " "
                    isTyping.wrappedValue = true
                },
            )
        } lines: {
            ForEach(model.messages) { message in
                RecapBubble(message: message)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            if model.isThinking {
                TypingIndicator()
                    .transition(.opacity)
            }
            if let result = model.result {
                RecapSharedCard(reply: result)
                    .padding(.top, 12)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(duration: 0.4), value: model.messages)
        .animation(.spring(duration: 0.4), value: model.isThinking)
        .animation(.spring(duration: 0.4), value: model.result)
        .safeAreaInset(edge: .bottom) {
            if model.isFinished {
                doneButton
            } else {
                ChatComposerBar(model: model, placeholder: "Tell me how it went", error: model.error, isFocused: isTyping)
            }
        }
    }

    private var doneButton: some View {
        Button(action: onDone) {
            Text("Done")
                .foregroundStyle(Theme.onAction)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
        }
        .buttonStyle(.glassProminent)
        .controlSize(.large)
        .tint(Theme.action)
        .padding(20)
    }
}
