import SwiftUI

/// The Road's toolbar bell. A sage dot means something unread; the count is for VoiceOver, not the eye.
struct NotificationBell: View {
    let model: NotificationsModel
    @State private var isOpen = false

    var body: some View {
        Button { isOpen = true } label: {
            Image(systemName: "bell")
                .overlay(alignment: .topTrailing) {
                    if model.hasUnread {
                        Circle()
                            .fill(Theme.action)
                            .frame(width: 9, height: 9)
                            .offset(x: 2, y: -1)
                            .transition(.scale.combined(with: .opacity))
                    }
                }
                .animation(.spring(duration: 0.3), value: model.hasUnread)
        }
        .accessibilityLabel("Notifications")
        .accessibilityValue(model.hasUnread ? "\(model.unread) unread" : "")
        // the target goes up only once this sheet is fully gone
        .sheet(isPresented: $isOpen, onDismiss: model.presentPendingOpen) {
            NotificationCenterView(model: model)
        }
    }
}
