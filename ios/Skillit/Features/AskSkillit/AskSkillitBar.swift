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

    /// The field takes the whole bar beside the close button; its one small button swaps between mic, send and stop.
    private func input(_ model: QuickUpdateModel) -> some View {
        ChatComposer(model: model, placeholder: QuickUpdateModel.placeholder, isFocused: $isTyping)
            .glassEffect(.regular, in: .rect(cornerRadius: 24))
            .glassEffectID("bar", in: glass)
            // focused once the field exists; setting it in the same pass that creates the model does nothing
            .task { isTyping = true }
    }

    private var askButton: some View {
        Button {
            isAsking.toggle()
        } label: {
            Image(systemName: isAsking ? "xmark" : "waveform")
                .font(.body.weight(.semibold))
                .foregroundStyle(isAsking ? Color.secondary : Theme.action)
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
    }

    private func close() {
        // closing mid-sentence means "never mind", so what was heard is dropped rather than sent
        model?.cancelListening()
        isTyping = false
        model = nil
    }
}
