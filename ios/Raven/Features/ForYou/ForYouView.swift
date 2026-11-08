import RavenKit
import SwiftUI

/// Jobs and other openings picked for this person. Opens on the last feed instantly and refreshes behind it.
struct ForYouView: View {
    @Environment(AppModel.self) private var app

    private var model: ForYouModel {
        app.feed
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 12) {
                    if model.isBuilding {
                        BuildingRow()
                    }
                    content
                }
                .padding(16)
                .animation(.smooth, value: model.cards)
                .animation(.smooth, value: model.isBuilding)
            }
            .background(Theme.ground)
            .navigationTitle("For you")
            .refreshable { await refresh() }
            .task { await refresh() }
        }
    }

    @ViewBuilder private var content: some View {
        if !model.cards.isEmpty {
            ForEach(model.cards) { card in
                FeedCardView(card: card)
                    .onAppear { loadMoreIfLast(card) }
            }
            if model.isLoadingMore {
                ProgressView().padding()
            }
        } else if !model.hasLoaded, model.errorMessage == nil {
            ForEach(0 ..< 4, id: \.self) { _ in
                SkeletonLines(widths: [0.5, 0.9, 0.7], highlighted: 2).ravenCard()
            }
        } else if !model.isBuilding {
            EmptyFeed(message: model.errorMessage)
        }
    }

    private func refresh() async {
        guard let client = app.client else { return }
        await model.refresh(using: client)
    }

    private func loadMoreIfLast(_ card: FeedCard) {
        guard card.id == model.cards.last?.id, let client = app.client else { return }
        Task { await model.loadMore(using: client) }
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
    let message: String?

    var body: some View {
        ContentUnavailableView {
            Label(message == nil ? "Nothing here yet" : "Can't load your feed", systemImage: "sparkles")
        } description: {
            Text(message ?? "Add the roles you're aiming for in Profile and Raven will find openings that fit.")
        }
        .padding(.top, 40)
    }
}
