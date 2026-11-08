import SkillitKit
import SwiftUI

/// Email sign-in: a password by default, or a six-digit code emailed by Supabase for anyone without one.
struct EmailEntry: View {
    @Environment(AppModel.self) private var app
    @Bindable var model: SignInModel
    let signedIn: () -> Void
    @FocusState private var focus: Field?

    enum Field { case email, password }

    var body: some View {
        VStack(spacing: 12) {
            Picker("Mode", selection: $model.passwordMode) {
                ForEach(SignInModel.PasswordMode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            if let notice = model.notice {
                Text(notice)
                    .font(.footnote)
                    .foregroundStyle(Theme.positive)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            TextField("you@example.com", text: $model.typedEmail)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.next)
                .focused($focus, equals: .email)
                .onSubmit { focus = .password }
                .skillitField()
            SecureField(passwordPrompt, text: $model.typedPassword)
                .textContentType(model.passwordMode == .signUp ? .newPassword : .password)
                .submitLabel(.go)
                .focused($focus, equals: .password)
                .onSubmit(submit)
                .skillitField()
            PrimaryButton(title: model.passwordMode.rawValue, isWorking: model.isWorking, isEnabled: model.canSubmitPassword, action: submit)
            Button("Email me a code instead", action: sendCode)
                .frame(maxWidth: .infinity, minHeight: 44)
                .disabled(!model.canSendCode)
            Button("Back") { model.step = .choosing }
                .frame(maxWidth: .infinity, minHeight: 36)
                .foregroundStyle(.secondary)
        }
        .onAppear { focus = .email }
    }

    private var passwordPrompt: String {
        model.passwordMode == .signUp ? "Password (\(SignInModel.minimumNewPassword)+ characters)" : "Password"
    }

    private func submit() {
        guard model.canSubmitPassword else { return }
        Task {
            if await model.submitPassword(with: app.authenticator) {
                signedIn()
            }
        }
    }

    private func sendCode() {
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
