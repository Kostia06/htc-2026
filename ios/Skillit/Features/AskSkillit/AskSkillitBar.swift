import SkillitKit
import SwiftUI

/// The bottom bar: four tabs in one glass capsule and a plus button beside them. The plus fans out Voice, Type, File and
/// Connect; Voice and Type morph the capsule into an input bar (on-device dictation or the keyboard), File sends a document,
/// and Skillit's reply floats just above the bar. Built by hand because the system search tab can't carry a mic or a reply
/// card; the glass shapes share ids so they morph.
struct AskSkillitBar: View {
    /// Bar height plus its gap above the home indicator; tabs pad their content by this much.
    static let reservedHeight: CGFloat = 92

    @Environment(AppModel.self) private var app
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding var selection: MainTabView.Section
    @Binding var isAsking: Bool
    @Binding var isMenuOpen: Bool
    let onOpenPosting: (JobPosting) -> Void

    /// How the next opening of the input begins: listening, typing, or sending a picked file.
    private enum Start {
        case voice, type, file(ResumeFile)
    }

    @State private var model: QuickUpdateModel?
    @State private var start: Start = .type
    @State private var focusesField = true
    @State private var isPickingFile = false
    @State private var isConnecting = false
    @State private var fileError: String?
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
        // the options rise from the plus: just above the bar, right-aligned over the button
        .overlay(alignment: .bottomTrailing) {
            AskSkillitMenu(isOpen: isMenuOpen, onSelect: choose)
                .padding(.bottom, 74)
        }
        .padding(.horizontal, 10)
        .padding(.bottom, 4)
        .animation(.spring(duration: 0.45, bounce: 0.2), value: isAsking)
        .onChange(of: isAsking) { _, asking in asking ? open() : close() }
        .sensoryFeedback(.impact(weight: .light), trigger: isMenuOpen)
        .fileImporter(isPresented: $isPickingFile, allowedContentTypes: OnboardingFlow.resumeTypes) { picked($0) }
        .sheet(isPresented: $isConnecting) { connectSheet }
        .alert("Couldn't open that file", isPresented: hasFileError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(fileError ?? "")
        }
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
                    .frame(maxWidth: .infinity, minHeight: 62)
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
            // focused once the field exists; setting it in the same pass that creates the model does nothing.
            // Voice and File leave the keyboard down: the mic or the file is doing the talking
            .task { isTyping = focusesField }
    }

    /// A plus that turns into an x while the menu is open (rotated, or swapped with Reduce Motion), and an x while the
    /// input is open.
    private var askButton: some View {
        Button {
            if isAsking {
                isAsking = false
            } else {
                isMenuOpen.toggle()
            }
        } label: {
            Image(systemName: isAsking || (isMenuOpen && reduceMotion) ? "xmark" : "plus")
                .font(.title3.weight(.semibold))
                .foregroundStyle(isAsking || isMenuOpen ? Color.secondary : Theme.action)
                .rotationEffect(.degrees(isMenuOpen && !reduceMotion ? 45 : 0))
                .frame(width: 52, height: 52)
                .contentTransition(.symbolEffect(.replace))
                .animation(.spring(duration: 0.35, bounce: 0.25), value: isMenuOpen)
        }
        .buttonStyle(.plain)
        .glassEffect(.regular.interactive(), in: .circle)
        .glassEffectID("ask", in: glass)
        .accessibilityLabel(isAsking || isMenuOpen ? "Close" : "Add an update")
        .accessibilityHint(isAsking || isMenuOpen ? "" : "Voice, type, send a file or connect an app")
    }

    private var connectSheet: some View {
        NavigationStack {
            ConnectedAppsView()
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { isConnecting = false }
                    }
                }
        }
    }

    private var hasFileError: Binding<Bool> {
        Binding(get: { fileError != nil }, set: { if !$0 { fileError = nil } })
    }

    private func choose(_ option: AskSkillitOption) {
        isMenuOpen = false
        switch option {
        case .voice: begin(.voice)
        case .type: begin(.type)
        case .file: isPickingFile = true
        case .connect: isConnecting = true
        }
    }

    private func picked(_ result: Result<URL, any Error>) {
        guard case let .success(url) = result else { return }
        guard let file = OnboardingModel.load(url) else {
            fileError = "Try another one, like a PDF, a Word file or a photo."
            return
        }
        begin(.file(file))
    }

    private func begin(_ how: Start) {
        start = how
        if case .type = how { focusesField = true } else { focusesField = false }
        isAsking = true
    }

    private func open() {
        // screenshots and previews run without a signed-in client; they get the offline service and a scripted mic
        let model = if let client = app.client {
            QuickUpdateModel(service: client, dictation: SpeechDictation(), onApplied: app.noteApplied)
        } else {
            QuickUpdateModel(service: OfflineQuickUpdateService(), dictation: ScriptedDictation(), onApplied: app.noteApplied)
        }
        self.model = model
        switch start {
        case .type: break
        case .voice: model.startListening()
        case let .file(file): Task { await model.sendFile(file) }
        }
        start = .type
    }

    private func close() {
        // closing mid-sentence means "never mind", so what was heard is dropped rather than sent
        model?.cancelListening()
        isTyping = false
        model = nil
    }
}

extension EnvironmentValues {
    /// How far the floating bar reaches up from the bottom safe area; zero outside the tabs (sheets, covers, previews).
    @Entry var floatingBarClearance: CGFloat = 0
}

/// A screen's own bottom bar (a composer, an Export button) sits above the floating tab bar instead of under it.
/// Without this it lands behind the tab capsule, reading as a second plate with a stray button poking out.
private struct ClearsFloatingBar: ViewModifier {
    @Environment(\.floatingBarClearance) private var clearance

    func body(content: Content) -> some View {
        content.padding(.bottom, clearance)
    }
}

extension View {
    func clearsFloatingBar() -> some View {
        modifier(ClearsFloatingBar())
    }
}
