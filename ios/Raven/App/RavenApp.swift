import SwiftUI

@main
struct RavenApp: App {
    @State private var model = AppModel(baseURL: AppConfiguration.apiBaseURL, authenticator: .fromInfoPlist())

    var body: some Scene {
        WindowGroup {
            #if DEBUG
                if let screen = DebugScreen.requested {
                    screen.view.preferredColorScheme(.dark).tint(Theme.action)
                } else {
                    app
                }
            #else
                app
            #endif
        }
    }

    private var app: some View {
        RootView()
            .environment(model)
            .preferredColorScheme(.dark)
            .tint(Theme.action)
    }
}

enum AppConfiguration {
    /// Set per build configuration in project.yml; Debug points at the local Worker.
    static let apiBaseURL: URL = {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "RavenAPIURL") as? String, let url = URL(string: value) else {
            preconditionFailure("RavenAPIURL is missing from Info.plist")
        }
        return url
    }()
}
