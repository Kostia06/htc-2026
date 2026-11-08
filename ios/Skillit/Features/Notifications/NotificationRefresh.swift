import BackgroundTasks
import SkillitKit
import SwiftUI

/// When the app checks the server for news: on every return to the foreground, and from background app refresh,
/// which iOS runs at its own pace (usually hours apart) once the app has been backgrounded.
enum NotificationRefresh {
    /// Also listed under BGTaskSchedulerPermittedIdentifiers in project.yml; the two must match.
    static let taskIdentifier = "com.kostiailn.skillit.notifications.refresh"
    private static let earliestGap: TimeInterval = 60 * 60

    static func run(for app: AppModel) async {
        schedule()
        await app.notifications.refresh(using: app.client ?? backgroundClient(for: app))
    }

    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: taskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: earliestGap)
        // fails on the simulator and when the person turned Background App Refresh off; foreground checks still run
        try? BGTaskScheduler.shared.submit(request)
    }

    /// A background launch never shows the UI, so `start()` hasn't made a client yet; the signed-in session is enough.
    private static func backgroundClient(for app: AppModel) -> SkillitClient? {
        guard app.authenticator.isSignedIn else { return nil }
        return SkillitClient(baseURL: AppConfiguration.apiBaseURL, accessToken: app.authenticator.accessToken)
    }
}

/// Keeps the bell fresh while the app is open and presents whatever notification the person tapped.
private struct HandlesNotifications: ViewModifier {
    @Environment(AppModel.self) private var app
    @Environment(\.scenePhase) private var scenePhase

    func body(content: Content) -> some View {
        @Bindable var notifications = app.notifications
        content
            .sheet(item: $notifications.opened) { NotificationDestinationView(target: $0.target) }
            // keyed on the client too, so the first check waits for sign-in instead of firing with none
            .task(id: app.client == nil) { await app.notifications.refresh(using: app.client) }
            .onChange(of: scenePhase) { _, phase in
                switch phase {
                case .active: Task { await app.notifications.refresh(using: app.client) }
                case .background: NotificationRefresh.schedule()
                default: break
                }
            }
    }
}

extension View {
    func handlesNotifications() -> some View {
        modifier(HandlesNotifications())
    }
}
