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
    /// Set per build configuration in project.yml; Debug points at the local Worker.
    static let apiBaseURL: URL = {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "RavenAPIURL") as? String, let url = URL(string: value) else {
            preconditionFailure("RavenAPIURL is missing from Info.plist")
        }
        return url
    }()
}
