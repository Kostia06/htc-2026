import SkillitKit
import SwiftUI

/// Everything Skillit thought worth telling, Today first. Tap opens the place it's about; swipe marks it read.
struct NotificationCenterView: View {
    let model: NotificationsModel
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            content
                .background(Theme.ground)
                .navigationTitle("Notifications")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Mark all read") { model.markAllRead(using: app.client) }
                            .disabled(!model.hasUnread)
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                    }
                }
        }
        .presentationBackground(Theme.ground)
        // opening the bell is the moment the person showed they care, so this is where permission is asked
        .task { await LocalNotifier.requestPermission() }
        .task { await model.refresh(using: app.client) }
    }

    @ViewBuilder private var content: some View {
        if !model.items.isEmpty {
            list
        } else {
            switch model.phase {
            case .idle, .loading:
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            case let .failed(message):
                ContentUnavailableView {
                    Label("Couldn't load notifications", systemImage: "bell.slash")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try again") { Task { await model.refresh(using: app.client) } }
                        .buttonStyle(.raised)
                        .frame(maxWidth: 220)
                }
            case .ready:
                ContentUnavailableView(
                    "Nothing new yet",
                    systemImage: "bell",
                    description: Text("Deadlines you saved, new interview questions at your companies and finished reports show up here."),
                )
            }
        }
    }

    private var list: some View {
        List {
            ForEach(model.items.groupedByDay(), id: \.title) { group in
                Section(group.title) {
                    ForEach(group.items) { item in
                        Button { open(item) } label: { NotificationRow(item: item) }
                            .buttonStyle(.plain)
                            .onAppear { loadMoreIfLast(item) }
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                if !item.isRead {
                                    Button("Mark read", systemImage: "checkmark") { model.markRead(item, using: app.client) }
                                        .tint(Theme.action)
                                }
                            }
                    }
                }
            }
            .listRowBackground(Theme.raised)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .refreshable { await model.refresh(using: app.client) }
    }

    private func open(_ item: SkillitNotification) {
        guard item.target != .unknown else {
            model.markRead(item, using: app.client)
            return
        }
        model.open(item, using: app.client)
        dismiss()
    }

    private func loadMoreIfLast(_ item: SkillitNotification) {
        guard item.id == model.items.last?.id else { return }
        Task { await model.loadMore(using: app.client) }
    }
}

#if DEBUG
    #Preview {
        NotificationCenterView(model: .preview(SkillitNotification.samples))
            .environment(AppModel.preview(profile: .empty))
            .preferredColorScheme(.dark)
    }
#endif
