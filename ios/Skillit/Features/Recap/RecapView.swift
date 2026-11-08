import SkillitKit
import SwiftUI

/// "Tell Skillit how it went": a chat sheet where the person talks about a real interview, typed or spoken, and Skillit
/// pulls out the company, role, round and questions, asking at most two short questions. Present it as a sheet.
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
                    Button("Close", systemImage: "xmark") {
                        model?.stopVoice()
                        dismiss()
                    }
                }
            }
        }
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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
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
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .animation(.spring(duration: 0.4), value: model.messages)
            .animation(.spring(duration: 0.4), value: model.isThinking)
            .animation(.spring(duration: 0.4), value: model.result)
        }
        .defaultScrollAnchor(.bottom)
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom) {
            if model.isFinished {
                doneButton
            } else {
                composer
            }
        }
    }

    private var doneButton: some View {
        Button(action: onDone) {
            Text("Done")
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
        }
        .buttonStyle(.glassProminent)
        .controlSize(.large)
        .padding(20)
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
                TextField(model.isListening ? "Listening…" : "Type it, or tap the mic", text: $model.draft, axis: .vertical)
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

    private var micButton: some View {
        Button {
            if model.isListening {
                model.stopVoice()
            } else {
                isTyping.wrappedValue = false
                model.startVoice()
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
        .accessibilityLabel(model.isListening ? "Stop listening" : "Tell Skillit by voice")
    }
}
