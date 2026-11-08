import AuthenticationServices
import SwiftUI

struct SignInView: View {
    @Environment(AppModel.self) private var app
    @State private var model: SignInModel

    init(model: SignInModel = SignInModel()) {
        _model = State(initialValue: model)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Spacer()
            Text(headline)
                .font(.largeTitle.bold())
            Text(subtitle)
                .font(.body)
                .foregroundStyle(.secondary)
            Spacer()
            actions
        }
        .padding(24)
        .animation(.smooth, value: model.step)
        .alert("Couldn't sign in", isPresented: isShowingError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(model.errorMessage ?? "")
        }
    }

    @ViewBuilder private var actions: some View {
        switch model.step {
        case .choosing:
            SignInChoices(model: model, signedIn: signedIn)
        case .enteringEmail:
            EmailEntry(model: model)
        case let .enteringCode(email):
            CodeEntry(model: model, email: email, signedIn: signedIn)
        }
    }

    private var headline: String {
        switch model.step {
        case .choosing: "Your next role, one step at a time."
        case .enteringEmail: "What's your email?"
        case .enteringCode: "Check your inbox."
        }
    }

    private var subtitle: String {
        switch model.step {
        case .choosing: "Skillit learns what you've done and plans the shortest path to the job you want."
        case .enteringEmail: "We'll send you a six-digit code. No password to remember."
        case let .enteringCode(email): "Enter the code we sent to \(email.value)."
        }
    }

    private var isShowingError: Binding<Bool> {
        Binding(get: { model.errorMessage != nil }, set: {
            if !$0 {
                model.errorMessage = nil
            }
        })
    }

    private func signedIn() {
        Task { await app.start() }
    }
}

private struct SignInChoices: View {
    @Environment(AppModel.self) private var app
    let model: SignInModel
    let signedIn: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            SignInWithAppleButton(.continue) { request in
                model.prepare(request)
            } onCompletion: { result in
                Task {
                    if await model.completeApple(result, with: app.authenticator) {
                        signedIn()
                    }
                }
            }
            .signInWithAppleButtonStyle(.white)
            .frame(height: 54)
            .clipShape(.capsule)
            .disabled(model.isWorking)
            Button("Use email instead") { model.step = .enteringEmail }
                .frame(maxWidth: .infinity, minHeight: 44)
                .foregroundStyle(.secondary)
        }
    }
}
