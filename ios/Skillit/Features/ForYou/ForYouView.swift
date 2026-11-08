import SkillitKit
import SwiftUI

/// Jobs, events, hackathons and courses picked for this person. Opens on the last feed instantly and refreshes behind it.
struct ForYouView: View {
    @Environment(AppModel.self) private var app
    @State private var opened: FeedCard?
    @State private var isRadar = false
    @State private var openedCompany: CompanyLink?

    private var model: ForYouModel {
        app.feed
    }

    var body: some View {
        NavigationStack {
            List {
                // a plain List pins its section header, so the chips stay put while the large title scrolls away
                Section {
                    if isRadar {
                        RadarList { openedCompany = CompanyLink(slug: $0) }
                    } else {
                        if model.isBuilding {
                            BuildingRow().feedRow()
                        }
                        content
                    }
                } header: {
                    SectionChips(selection: model.section, isRadar: isRadar) { section in
                        isRadar = false
                        model.show(section)
                    } onRadar: {
                        isRadar = true
                    }
                    .listRowInsets(EdgeInsets())
                } footer: {
                    if !isRadar {
                        attributions
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Theme.ground)
            .animation(.snappy, value: model.cards)
            .animation(.smooth, value: model.isBuilding)
            .navigationTitle("For you")
            .refreshable {
                if isRadar {
                    await refreshRadar()
                } else {
                    await refresh()
                }
            }
            .task(id: model.section) { await refresh() }
            // the companies list is otherwise fetched only at sign-in, so one added since would never appear
            .task(id: isRadar) {
                if isRadar {
                    await refreshRadar()
                }
            }
            .sensoryFeedback(.impact(weight: .light), trigger: model.dismissals)
            .sheet(item: $opened) { card in
                // read the live card so the bookmark fills as soon as it's saved from the sheet
                let live = model.cards.first { $0.id == card.id } ?? card
                FeedDetailSheet(card: live) { save(live) }
            }
            .sheet(item: $openedCompany) { link in
                CompanySheet(slug: link.slug)
            }
        }
    }

    @ViewBuilder private var content: some View {
        if !model.cards.isEmpty {
            ForEach(model.cards) { card in
                FeedCardView(card: card, onSave: { save(card) }, onDismiss: { dismiss(card) }, onOpen: { opened = card })
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
                SkeletonLines(widths: [0.5, 0.9, 0.7], highlighted: 2).skillitCard().feedRow()
            }
        } else if !model.isBuilding {
            EmptyFeed(section: model.section, message: model.errorMessage) { await refresh() }.feedRow()
        }
    }

    /// Adzuna's terms ask for their credit, linked to their site, wherever we show their listings: once, under the list.
    @ViewBuilder private var attributions: some View {
        let credits = model.cards.compactMap(\.attribution).reduce(into: [FeedCard.Attribution]()) { unique, credit in
            if !unique.contains(credit) {
                unique.append(credit)
            }
        }
        if !credits.isEmpty {
            HStack(spacing: 12) {
                ForEach(credits, id: \.url) { credit in
                    Link(credit.label, destination: credit.url)
                        .font(.caption)
                        .underline()
                        .tint(.secondary)
                        .frame(minHeight: 44)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func refresh() async {
        guard let client = app.client else { return }
        await model.refresh(using: client)
    }

    private func refreshRadar() async {
        await app.companies.refresh(using: app.companyService)
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

extension View {
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
            Image(systemName: "magnifyingglass")
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
    let retry: () async -> Void

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: section == .saved ? "bookmark" : "tray")
        } description: {
            Text(message ?? description)
        } actions: {
            // pull-to-refresh is invisible on an empty screen, so a failed load gets a button
            if message != nil {
                Button("Try again") { Task { await retry() } }
                    .buttonStyle(.raised)
                    .frame(maxWidth: 220)
            }
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
        default: "Add the roles you're aiming for in Profile and Skillit will find things that fit."
        }
    }
}
