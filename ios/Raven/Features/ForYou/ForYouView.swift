import RavenKit
import SwiftUI

/// Jobs, events, hackathons and courses picked for this person. Opens on the last feed instantly and refreshes behind it.
struct ForYouView: View {
    @Environment(AppModel.self) private var app

    private var model: ForYouModel {
        app.feed
    }

    var body: some View {
        NavigationStack {
            List {
                // a plain List pins its section header, so the chips stay put while the large title scrolls away
                Section {
                    if model.isBuilding {
                        BuildingRow().feedRow()
                    }
                    content
                } header: {
                    SectionChips(selection: model.section) { model.show($0) }
                        .listRowInsets(EdgeInsets())
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Theme.ground)
            .animation(.snappy, value: model.cards)
            .animation(.smooth, value: model.isBuilding)
            .navigationTitle("For you")
            .refreshable { await refresh() }
            .task(id: model.section) { await refresh() }
            .sensoryFeedback(.impact(weight: .light), trigger: model.dismissals)
        }
    }

    @ViewBuilder private var content: some View {
        if !model.cards.isEmpty {
            ForEach(model.cards) { card in
                FeedCardView(card: card, onSave: { save(card) }, onDismiss: { dismiss(card) })
                    .feedRow()
                    .onAppear { loadMoreIfLast(card) }
                    .swipeActions(edge: .leading, allowsFullSwipe: true) {
                        if !card.isSaved {
                            Button { save(card) } label: { Label("Save", systemImage: "bookmark.fill") }
                                .tint(Theme.action)
                        }
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button(role: .destructive) { dismiss(card) } label: {
                            Label(model.section == .saved ? "Remove" : "Dismiss", systemImage: "xmark")
                        }
                    }
            }
            if model.isLoadingMore {
                ProgressView().frame(maxWidth: .infinity).feedRow()
            }
        } else if !model.hasLoaded, model.errorMessage == nil {
            ForEach(0 ..< 4, id: \.self) { _ in
                SkeletonLines(widths: [0.5, 0.9, 0.7], highlighted: 2).ravenCard().feedRow()
            }
        } else if !model.isBuilding {
            EmptyFeed(section: model.section, message: model.errorMessage).feedRow()
        }
    }

    private func refresh() async {
        guard let client = app.client else { return }
        await model.refresh(using: client)
    }

    private func save(_ card: FeedCard) {
        guard let client = app.client else { return }
        withAnimation(.snappy) { model.save(card, using: client) }
    }

    private func dismiss(_ card: FeedCard) {
        guard let client = app.client else { return }
        withAnimation(.snappy) { model.dismiss(card, using: client) }
    }

    private func loadMoreIfLast(_ card: FeedCard) {
        guard card.id == model.cards.last?.id, let client = app.client else { return }
        Task { await model.loadMore(using: client) }
    }
}

private extension View {
    /// A card sitting on the dark ground with no List chrome around it.
    func feedRow() -> some View {
        listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
    }
}

/// The agent is gathering a fresher feed; calm, in the agent's colour, and out of the way of the cards.
private struct BuildingRow: View {
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "sparkles")
                .foregroundStyle(Theme.agent)
                .symbolEffect(.pulse, options: .repeating)
            Text("Finding things for you…")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.agent)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Theme.agent.opacity(0.12), in: .rect(cornerRadius: 16))
        .accessibilityElement(children: .combine)
    }
}

private struct EmptyFeed: View {
    let section: FeedSection
    let message: String?

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: section == .saved ? "bookmark" : "sparkles")
        } description: {
            Text(message ?? description)
        }
        .padding(.top, 40)
    }

    private var title: String {
        if message != nil {
            return "Can't load your feed"
        }
        return section == .saved ? "Nothing saved yet" : "Nothing here yet"
    }

    private var description: String {
        switch section {
        case .saved: "Swipe a card right, or tap the bookmark, to keep it here."
        default: "Add the roles you're aiming for in Profile and Raven will find things that fit."
        }
    }
}
