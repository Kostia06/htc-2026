import SkillitKit
import UIKit
import UserNotifications

/// Owns the app model so the system callbacks SwiftUI has no hook for (the APNs token, a tapped notification)
/// reach the same model the views use.
final class AppDelegate: NSObject, UIApplicationDelegate {
    let model = AppModel(baseURL: AppConfiguration.apiBaseURL, authenticator: .fromInfoPlist())

    func application(_: UIApplication, didFinishLaunchingWithOptions _: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Task { await LocalNotifier.registerForPushIfAllowed() }
        return true
    }

    func application(_: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task {
            // before sign-in there is no one to register for; the next launch or the permission ask tries again
            guard let client = model.client else { return }
            do {
                try await client.registerPushDevice(token: deviceToken)
                LocalNotifier.receivesPush = true
            } catch {
                LocalNotifier.receivesPush = false
            }
        }
    }

    func application(_: UIApplication, didFailToRegisterForRemoteNotificationsWithError _: any Error) {
        // a simulator, or the Push Notifications capability missing from the profile: local delivery still works
        LocalNotifier.receivesPush = false
    }
}

extension AppDelegate: UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(
        _: UNUserNotificationCenter,
        willPresent _: UNNotification,
    ) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    nonisolated func userNotificationCenter(_: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard let opened = LocalNotifier.target(from: response.notification.request.content.userInfo) else { return }
        await MainActor.run {
            model.notifications.openDelivered(id: opened.id, target: opened.target, using: model.client)
        }
    }
}
