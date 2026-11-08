import Foundation
import Observation
import SkillitKit

/// The bell's state for the whole app: what's in the notification center, how many are unread, and which one the
/// person asked to open. Lives on AppModel so the Road toolbar, the tab view and the app delegate share one copy.
@Observable
final class NotificationsModel {
    enum Phase: Equatable {
        case idle
        case loading
        case ready
        case failed(String)
    }

    private(set) var phase: Phase = .idle
    private(set) var items: [SkillitNotification] = []
    private(set) var unread = 0
    private(set) var nextCursor: String?
    /// A tap in the center or on a delivered notification; the tab view presents it.
    var opened: OpenedTarget?
    /// Held while the center sheet closes, because iOS drops a sheet presented during another one's dismissal.
    private var pendingOpen: OpenedTarget?

    var hasUnread: Bool {
        unread > 0
    }

    /// The first page, with the server looking for news on the way; then anything new goes up as a local notification.
    func refresh(using client: SkillitClient?) async {
        guard let client else { return }
        if items.isEmpty { phase = .loading }
        do {
            let page = try await client.notifications()
            apply(page)
            await LocalNotifier.deliver(page)
        } catch {
            if items.isEmpty { phase = .failed(error.message) }
        }
    }

    func loadMore(using client: SkillitClient?) async {
        guard let client, let cursor = nextCursor else { return }
        guard let page = try? await client.notifications(cursor: cursor) else { return }
        items.append(contentsOf: page.items.filter { new in !items.contains { $0.id == new.id } })
        nextCursor = page.nextCursor
    }

    /// Read at once in the app; a refused call is not worth undoing the dot over.
    func markRead(_ item: SkillitNotification, using client: SkillitClient?) {
        guard let index = items.firstIndex(where: { $0.id == item.id }), !items[index].isRead else { return }
        items[index].readAt = Date.now.ISO8601Format()
        unread = max(0, unread - 1)
        LocalNotifier.clearDelivered(ids: [item.id])
        guard let client else { return }
        Task { if let left = try? await client.markNotificationsRead(ids: [item.id]) { unread = left } }
    }

    func markAllRead(using client: SkillitClient?) {
        let now = Date.now.ISO8601Format()
        let ids = items.filter { !$0.isRead }.map(\.id)
        for index in items.indices where !items[index].isRead {
            items[index].readAt = now
        }
        unread = 0
        LocalNotifier.clearDelivered(ids: ids)
        guard let client else { return }
        Task { try? await client.markAllNotificationsRead() }
    }

    /// From a row in the center: remembered until the center has finished closing.
    func open(_ item: SkillitNotification, using client: SkillitClient?) {
        markRead(item, using: client)
        pendingOpen = OpenedTarget(target: item.target)
    }

    func presentPendingOpen() {
        guard let pending = pendingOpen else { return }
        pendingOpen = nil
        opened = pending
    }

    /// From a delivered notification: nothing is on screen to wait for.
    func openDelivered(id: String?, target: NotificationTarget, using client: SkillitClient?) {
        if let id, let item = items.first(where: { $0.id == id }) {
            markRead(item, using: client)
        } else if let id, let client {
            Task { if let left = try? await client.markNotificationsRead(ids: [id]) { unread = left } }
        }
        opened = OpenedTarget(target: target)
    }

    func forget() {
        items = []
        unread = 0
        nextCursor = nil
        phase = .idle
        opened = nil
    }

    private func apply(_ page: NotificationPage) {
        items = page.items
        unread = page.unread
        nextCursor = page.nextCursor
        phase = .ready
    }

    #if DEBUG
        /// Screenshots and previews: a center already filled, no server involved.
        static func preview(_ items: [SkillitNotification]) -> NotificationsModel {
            let model = NotificationsModel()
            model.apply(NotificationPage(items: items, unread: items.count(where: { !$0.isRead })))
            return model
        }
    #endif
}

/// A notification target as a sheet item; a fresh id each time, so opening the same place twice presents twice.
struct OpenedTarget: Identifiable {
    let id = UUID()
    let target: NotificationTarget
}
