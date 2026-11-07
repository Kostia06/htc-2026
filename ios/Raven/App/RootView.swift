import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ZStack {
            Theme.ground.ignoresSafeArea()
            switch model.phase {
            case .starting:
                ProgressView().controlSize(.large)
            case .signedOut:
                SignInView()
                    .transition(.opacity)
            case .onboarding:
                OnboardingFlow()
                    .transition(.opacity)
            case .ready:
                MainTabView()
                    .transition(.opacity)
            case let .failed(message):
                ContentUnavailableView {
                    Label("Can't reach Raven", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try again") { Task { await model.start() } }
                        .buttonStyle(.glassProminent)
                }
            }
        }
        .animation(.smooth, value: model.phase)
        .task { await model.start() }
    }
}
