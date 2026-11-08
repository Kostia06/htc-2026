import SwiftUI

@main
struct SkillitApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate

    private var model: AppModel {
        delegate.model
    }

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
        .backgroundTask(.appRefresh(NotificationRefresh.taskIdentifier)) { [model] in
            await NotificationRefresh.run(for: model)
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
    /// Set per build configuration in project.yml. Debug builds honour a SKILLIT_API_URL
    /// environment override so a simulator can talk to a local server.
    static let apiBaseURL: URL = {
        #if DEBUG
        if let override = ProcessInfo.processInfo.environment["SKILLIT_API_URL"], let url = URL(string: override) {
            return url
        }
        #endif
        guard let value = Bundle.main.object(forInfoDictionaryKey: "RavenAPIURL") as? String, let url = URL(string: value) else {
            preconditionFailure("RavenAPIURL is missing from Info.plist")
        }
        return url
    }()
}
