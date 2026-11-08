import Foundation
import SkillitKit
import UIKit
import UserNotifications

/// The delivery that always works: whatever the server has that this phone hasn't shown yet goes up as a local
/// notification, on foreground and from background refresh. APNs, when configured, only makes it arrive sooner.
enum LocalNotifier {
    private static let shownKey = "notifications.shownIds"
    private static let pushKey = "notifications.receivesPush"
    // enough to cover every notification still unread; the server never keeps more than a few a day per person
    private static let rememberedIds = 200

    /// Ids only, never content: what's in a notification stays on the server and in the system's own store.
    private static var shown: [String] {
        get { UserDefaults.standard.stringArray(forKey: shownKey) ?? [] }
        set { UserDefaults.standard.set(Array(newValue.suffix(rememberedIds)), forKey: shownKey) }
    }

    /// Set once the server accepted this phone's APNs token, so pushed notifications aren't posted a second time.
    static var receivesPush: Bool {
        get { UserDefaults.standard.bool(forKey: pushKey) }
        set { UserDefaults.standard.set(newValue, forKey: pushKey) }
    }

    static func deliver(_ page: NotificationPage) async {
        let fresh = page.items.awaitingLocalDelivery(alreadyShown: Set(shown), receivesPush: receivesPush)
        guard !fresh.isEmpty else { return }
        // marked shown even at night or without permission: the bell already has them, a late buzz is just noise
        shown += fresh.map(\.id)
        guard !page.quiet, await isAllowed else { return }
        let center = UNUserNotificationCenter.current()
        for (offset, item) in fresh.prefix(3).enumerated() {
            let content = UNMutableNotificationContent()
            content.title = item.title
            content.body = item.body
            content.sound = .default
            content.threadIdentifier = "skillit"
            content.userInfo = userInfo(for: item)
            if offset == 0 { content.badge = NSNumber(value: page.unread) }
            try? await center.add(UNNotificationRequest(identifier: item.id, content: content, trigger: nil))
        }
    }

    static func clearDelivered(ids: [String]) {
        guard !ids.isEmpty else { return }
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ids)
    }

    /// Asks once, in context: right after onboarding or the first time the bell opens. Never at launch.
    static func requestPermission() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        if settings.authorizationStatus == .notDetermined {
            _ = try? await center.requestAuthorization(options: [.alert, .badge, .sound])
        }
        await registerForPushIfAllowed()
    }

    /// Asking APNs for a token shows no prompt, so this is safe at every launch once permission exists.
    static func registerForPushIfAllowed() async {
        guard await isAllowed else { return }
        UIApplication.shared.registerForRemoteNotifications()
    }

    private static var isAllowed: Bool {
        get async {
            let status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
            return status == .authorized || status == .provisional || status == .ephemeral
        }
    }

    /// The same keys the server's APNs payload carries, so a tap is handled one way whichever path delivered it.
    private static func userInfo(for item: SkillitNotification) -> [AnyHashable: Any] {
        var info: [AnyHashable: Any] = ["notificationId": item.id]
        if let data = try? JSONEncoder().encode(item.target), let target = try? JSONSerialization.jsonObject(with: data) {
            info["target"] = target
        }
        return info
    }

    /// Reads the tapped notification back into a target; nil when it isn't one of ours.
    nonisolated static func target(from userInfo: [AnyHashable: Any]) -> (id: String?, target: NotificationTarget)? {
        guard let raw = userInfo["target"], JSONSerialization.isValidJSONObject(raw),
              let data = try? JSONSerialization.data(withJSONObject: raw),
              let target = try? JSONDecoder().decode(NotificationTarget.self, from: data), target != .unknown
        else { return nil }
        return (userInfo["notificationId"] as? String, target)
    }
}
