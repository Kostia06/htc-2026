import SkillitKit
import SwiftUI
import UserNotifications

/// One switch per kind of notification. The server applies them, so they hold on every device.
struct NotificationSettingsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.openURL) private var openURL
    @State private var preferences: NotificationPreferences?
    @State private var isSystemOff = false
    @State private var failure: String?

    var body: some View {
        List {
            if isSystemOff {
                Section {
                    Button("Turn on notifications in Settings") {
                        if let url = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(url) }
                    }
                } footer: {
                    Text("Notifications are off for Skillit, so these only fill the bell.")
                }
                .listRowBackground(Theme.raised)
            }
            Section {
                ForEach(NotificationKind.toggleable, id: \.self) { kind in
                    Toggle(isOn: binding(for: kind)) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(kind.settingTitle)
                            Text(kind.settingDetail)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .disabled(preferences == nil)
                }
            } footer: {
                Text(failure ?? "At most three a day, and never between 9 PM and 8 AM.")
            }
            .listRowBackground(Theme.raised)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.ground)
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func binding(for kind: NotificationKind) -> Binding<Bool> {
        Binding {
            preferences?.isOn(kind) ?? true
        } set: { isOn in
            preferences?.kinds[kind.rawValue] = isOn
            Task { await save(kind, isOn: isOn) }
        }
    }

    private func load() async {
        let status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        isSystemOff = status == .denied
        guard let client = app.client else { return }
        do {
            preferences = try await client.notificationPreferences()
        } catch {
            failure = error.message
        }
    }

    private func save(_ kind: NotificationKind, isOn: Bool) async {
        guard let client = app.client else { return }
        do {
            preferences = try await client.setNotification(kind, isOn: isOn)
            failure = nil
        } catch {
            preferences?.kinds[kind.rawValue] = !isOn
            failure = error.message
        }
    }
}
