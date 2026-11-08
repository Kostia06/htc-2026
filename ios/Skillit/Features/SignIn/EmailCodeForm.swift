import SkillitKit
import SwiftUI

/// The fallback sign-in: type an email, then the six-digit code Supabase sends to it.
struct EmailEntry: View {
    @Environment(AppModel.self) private var app
    @Bindable var model: SignInModel
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(spacing: 12) {
            TextField("you@example.com", text: $model.typedEmail)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.send)
                .focused($isFocused)
                .onSubmit(send)
                .skillitField()
            PrimaryButton(title: "Send code", isWorking: model.isWorking, isEnabled: model.canSendCode, action: send)
            Button("Back") { model.step = .choosing }
                .frame(maxWidth: .infinity, minHeight: 44)
                .foregroundStyle(.secondary)
        }
        .onAppear { isFocused = true }
    }

    private func send() {
        guard model.canSendCode else { return }
        Task { await model.sendCode(with: app.authenticator) }
    }
}

struct CodeEntry: View {
    @Environment(AppModel.self) private var app
    @Bindable var model: SignInModel
    let email: EmailAddress
    let signedIn: () -> Void
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(spacing: 12) {
            TextField("123456", text: $model.typedCode)
                .textContentType(.oneTimeCode)
                .keyboardType(.numberPad)
                .font(.title2.monospacedDigit())
                .focused($isFocused)
                .skillitField()
            PrimaryButton(title: "Sign in", isWorking: model.isWorking, isEnabled: model.canVerifyCode, action: verify)
            Button("Use a different email") { model.step = .enteringEmail }
                .frame(maxWidth: .infinity, minHeight: 44)
                .foregroundStyle(.secondary)
        }
        .onAppear { isFocused = true }
    }

    private func verify() {
        Task {
            if await model.verifyCode(with: app.authenticator) {
                signedIn()
            }
        }
    }
}

private struct PrimaryButton: View {
    let title: String
    let isWorking: Bool
    let isEnabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Text(title).opacity(isWorking ? 0 : 1)
                if isWorking {
                    ProgressView()
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
        }
        .buttonStyle(.glassProminent)
        .controlSize(.large)
        .disabled(!isEnabled)
    }
}

private extension View {
    func skillitField() -> some View {
        padding(.horizontal, 16)
            .frame(minHeight: 54)
            .background(Theme.raised, in: .capsule)
            .overlay(Capsule().strokeBorder(Theme.hairline))
    }
}
