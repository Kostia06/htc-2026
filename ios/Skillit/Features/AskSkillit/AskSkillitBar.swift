import SkillitKit
import SwiftUI

/// The bottom bar: four tabs in one glass capsule and the "Ask Skillit" button beside them. Tapping the button
/// morphs the capsule into an input bar (type, or talk with on-device dictation); Skillit's reply floats just above it.
/// Built by hand because the system search tab can't carry a mic or a reply card; the glass shapes share ids so they morph.
struct AskSkillitBar: View {
    @Environment(AppModel.self) private var app
    @Binding var selection: MainTabView.Section
    @Binding var isAsking: Bool
    let onOpenPosting: (JobPosting) -> Void

    @State private var model: QuickUpdateModel?
    @FocusState private var isTyping: Bool
    @Namespace private var glass

    var body: some View {
        VStack(spacing: 10) {
            if isAsking, let model {
                AskSkillitReplyCard(model: model, onOpenPosting: onOpenPosting)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            GlassEffectContainer(spacing: 8) {
                HStack(spacing: 8) {
                    if isAsking, let model {
                        input(model)
                    } else {
                        tabs
                    }
                    askButton
                }
            }
        }
        .padding(.horizontal, 10)
        .padding(.bottom, 4)
        .animation(.spring(duration: 0.45, bounce: 0.2), value: isAsking)
        .onChange(of: isAsking) { _, asking in asking ? open() : close() }
    }

    private var tabs: some View {
        HStack(spacing: 0) {
            ForEach(MainTabView.Section.allCases) { section in
                Button {
                    selection = section
                } label: {
                    VStack(spacing: 3) {
                        Image(systemName: section.symbol).font(.body.weight(.semibold))
                        Text(section.title).font(.caption2)
                    }
                    .foregroundStyle(selection == section ? Theme.action : .secondary)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selection == section ? .isSelected : [])
            }
        }
        .padding(.horizontal, 6)
        .glassEffect(.regular, in: .capsule)
        .glassEffectID("bar", in: glass)
    }

    private func input(_ model: QuickUpdateModel) -> some View {
        @Bindable var model = model
        return HStack(spacing: 8) {
            micButton(model)
            TextField(model.isListening ? "Listening…" : QuickUpdateModel.placeholder, text: $model.draft, axis: .vertical)
                .lineLimit(1 ... 3)
                .focused($isTyping)
                .disabled(model.isListening)
                .submitLabel(.send)
                .onSubmit { Task { await model.sendDraft() } }
            Button {
                Task { await model.sendDraft() }
            } label: {
                Image(systemName: "arrow.up")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(Theme.onAction)
                    .frame(width: 30, height: 30)
                    .background(Theme.action, in: .circle)
            }
            .buttonStyle(.plain)
            .disabled(!model.canSend)
            .opacity(model.canSend ? 1 : 0.4)
            .accessibilityLabel("Send")
        }
        .padding(.leading, 6)
        .padding(.trailing, 7)
        .frame(minHeight: 48)
        .glassEffect(.regular, in: .capsule)
        .glassEffectID("bar", in: glass)
    }

    /// Tap to talk, tap again to stop; what was heard goes out as the update.
    private func micButton(_ model: QuickUpdateModel) -> some View {
        Button {
            if model.isListening {
                model.stopListening()
            } else {
                isTyping = false
                model.startListening()
            }
        } label: {
            Image(systemName: model.isListening ? "stop.fill" : "mic.fill")
                .font(.body.weight(.semibold))
                .foregroundStyle(Theme.agent)
                .frame(width: 30, height: 30)
                .contentTransition(.symbolEffect(.replace))
        }
        .buttonStyle(.plain)
        .disabled(model.isThinking)
        .symbolEffect(.pulse, isActive: model.isListening)
        .accessibilityLabel(model.isListening ? "Stop and send" : "Say it instead")
    }

    private var askButton: some View {
        Button {
            isAsking.toggle()
        } label: {
            Image(systemName: isAsking ? "xmark" : "waveform")
                .font(.body.weight(.semibold))
                .foregroundStyle(isAsking ? .secondary : Theme.action)
                .frame(width: 44, height: 44)
                .contentTransition(.symbolEffect(.replace))
        }
        .buttonStyle(.plain)
        .glassEffect(.regular.interactive(), in: .circle)
        .glassEffectID("ask", in: glass)
        .accessibilityLabel(isAsking ? "Close" : "Ask Skillit")
    }

    private func open() {
        // screenshots and previews run without a signed-in client; they get the offline service and a scripted mic
        if let client = app.client {
            model = QuickUpdateModel(service: client, dictation: SpeechDictation(), onApplied: app.noteApplied)
        } else {
            model = QuickUpdateModel(service: OfflineQuickUpdateService(), dictation: ScriptedDictation(), onApplied: app.noteApplied)
        }
        isTyping = true
    }

    private func close() {
        model?.stopListening()
        isTyping = false
        model = nil
    }
}

/// Skillit's answer, floating above the bar: the one line, what it changed, the posting it read, or its one question.
private struct AskSkillitReplyCard: View {
    let model: QuickUpdateModel
    let onOpenPosting: (JobPosting) -> Void

    var body: some View {
        Group {
            if model.isThinking {
                TypingIndicator()
            } else if let reply = model.lastReply {
                card(reply)
            } else if let error = model.error {
                Text(error)
                    .font(.subheadline)
                    .foregroundStyle(Theme.negative)
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.raised, in: .rect(cornerRadius: 20))
                    .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(Theme.hairline))
            }
        }
        .animation(.spring(duration: 0.4), value: model.isThinking)
        .animation(.spring(duration: 0.4), value: model.messages)
    }

    private func card(_ reply: QuickUpdateModel.Message) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(reply.text)
                .font(.subheadline)
                .fixedSize(horizontal: false, vertical: true)
            if let posting = model.postingAfter[reply.id] {
                PostingCard(posting: posting) { onOpenPosting(posting) }
            }
            if let changes = model.appliedAfter[reply.id] {
                ForEach(changes) { change in
                    Label(change.summary, systemImage: "checkmark")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            if let error = model.error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(Theme.negative)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.raised, in: .rect(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(Theme.hairline))
        .accessibilityElement(children: .combine)
    }
}
