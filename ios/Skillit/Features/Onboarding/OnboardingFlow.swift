import SkillitKit
import SwiftUI
import UniformTypeIdentifiers

struct OnboardingFlow: View {
    @Environment(AppModel.self) private var app
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var model: OnboardingModel
    @State private var isPickingFile = false

    init(model: OnboardingModel = OnboardingModel()) {
        _model = State(initialValue: model)
    }

    var body: some View {
        VStack(spacing: 0) {
            OnboardingHeader(progress: model.progress, isReadingResume: model.isReadingResume, canGoBack: model.position > 0) {
                move(model.goBack)
            }
            QuestionScreen(
                question: model.question,
                answer: model.answers[model.question.id],
                isFromResume: model.fromResume.contains(model.question.id),
                onChange: pick,
                pickResume: { isPickingFile = true },
                skipResume: { move(model.goForward) },
            )
            .id(model.question.id)
            .transition(slide)
            .frame(maxHeight: .infinity, alignment: .top)
        }
        .background(Theme.ground)
        .safeAreaInset(edge: .bottom) {
            if !["resume", "accounts"].contains(model.question.id) {
                bottomBar
            }
        }
        .overlay {
            if model.isWaitingForResume {
                FinishingUpView().transition(.opacity)
            }
        }
        .animation(.smooth(duration: 0.25), value: model.isWaitingForResume)
        .sensoryFeedback(.selection, trigger: model.answers)
        .fileImporter(isPresented: $isPickingFile, allowedContentTypes: Self.resumeTypes) { result in
            guard case let .success(url) = result, let client = app.client else { return }
            guard let file = OnboardingModel.load(url) else {
                model.errorMessage = "Couldn't open that file. Try another one, or answer the questions instead."
                return
            }
            move { model.read(file, using: client) }
        }
        .alert("Something went wrong", isPresented: isShowingError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(model.errorMessage ?? "")
        }
    }

    private var bottomBar: some View {
        HStack(spacing: 12) {
            if model.canSkip {
                Button("Skip") { advance() }
                    .font(.headline)
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 72, minHeight: 52)
            }
            Button(action: advance) {
                if model.isFinishing {
                    ProgressView().tint(.white)
                } else {
                    Text(model.isLast ? "Finish" : "Continue")
                }
            }
            .buttonStyle(model.isAnswered ? .raised : .raised(Color(white: 0.22), foreground: Color(white: 0.5)))
            .disabled(!model.isAnswered || model.isFinishing)
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .background(Theme.ground)
    }

    /// slides like turning a page; a plain fade when Reduce Motion is on
    private var slide: AnyTransition {
        guard !reduceMotion else { return .opacity }
        let leading = AnyTransition.move(edge: .leading).combined(with: .opacity)
        let trailing = AnyTransition.move(edge: .trailing).combined(with: .opacity)
        return model.direction == .forward
            ? .asymmetric(insertion: trailing, removal: leading)
            : .asymmetric(insertion: leading, removal: trailing)
    }

    private func move(_ change: () -> Void) {
        withAnimation(reduceMotion ? .easeInOut(duration: 0.2) : .spring(duration: 0.35, bounce: 0.1), change)
    }

    /// a single pick is the answer, so it moves on by itself after a beat; the last one waits for Finish
    private func pick(_ answer: OnboardingAnswer) {
        model.answer(answer)
        guard case .single = model.question.kind, !model.isLast else { return }
        let questionID = model.question.id
        Task {
            try? await Task.sleep(for: .milliseconds(250))
            move { model.goForward(from: questionID) }
        }
    }

    private func advance() {
        guard model.isLast else { return move(model.goForward) }
        guard let client = app.client else { return }
        Task {
            if let saved = await model.finish(using: client) {
                app.finishOnboarding(with: saved)
            }
        }
    }

    private var isShowingError: Binding<Bool> {
        Binding(get: { model.errorMessage != nil }, set: {
            if !$0 {
                model.errorMessage = nil
            }
        })
    }

    /// Every format the server can read; the plus menu's File picker offers the same list.
    static let resumeTypes: [UTType] = [.pdf, .rtf, .plainText, .html, .image, .heic]
        + ["docx", "odt", "pptx", "md"].compactMap { UTType(filenameExtension: $0) }
}
