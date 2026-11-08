import SkillitKit
import SwiftUI

/// Crossroads: what people on the person's road learned, and where it matches their own notes. One insight on top
/// (the path most people took and how much of it they've done), then matches, the rest of the road, and what is
/// only theirs. Pushed inside an existing navigation stack, so it brings none of its own.
struct CrossroadsView: View {
    @Environment(AppModel.self) private var app
    @AppStorage("crossroadsExplainerSeen") private var explainerSeen = false
    @State private var model: CrossroadsModel?
    @State private var ask: CrossroadsAskModel?
    @State private var sharing: PrivateMemory?
    @State private var detail: CrossroadsDetail?
    @State private var deletions = 0

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.ground)
            .navigationTitle("Crossroads")
            .navigationBarTitleDisplayMode(.large)
            .safeAreaInset(edge: .bottom) {
                if let ask, model?.view != nil {
                    CrossroadsAskBar(model: ask)
                }
            }
            .task { await start() }
            // a quick update may have saved a note or a step; it shows here without leaving
            .onChange(of: app.updatesApplied) { Task { await model?.load() } }
            .sheet(item: $sharing) { memory in
                ShareMemorySheet(memory: memory, service: app.memoryService)
            }
            .sheet(item: $detail) { detail in
                if let model {
                    CrossroadsDetailSheet(detail: detail, model: model, goal: model.view?.road.goal ?? "")
                }
            }
            .sensoryFeedback(.impact(weight: .medium), trigger: deletions)
    }

    @ViewBuilder private var content: some View {
        switch model?.phase {
        case nil, .loading:
            ProgressView().tint(Theme.agent)
        case let .failed(message):
            ContentUnavailableView {
                Label("Couldn't load Crossroads", systemImage: "signpost.right.and.left")
            } description: {
                Text(message)
            } actions: {
                Button("Try again") { Task { await model?.load() } }.buttonStyle(.raised).frame(maxWidth: 220)
            }
        case let .ready(view):
            if let model {
                list(model, view)
            }
        }
    }

    private func list(_ model: CrossroadsModel, _ view: Crossroads) -> some View {
        ScrollViewReader { proxy in
            sections(model, view)
                .task { await Self.scrollForScreenshot(proxy) }
                // the answer is the list's first row; asking from far down brings it into view
                .onChange(of: ask?.isThinking) { _, thinking in
                    if thinking == true { withAnimation(.spring(duration: 0.35)) { proxy.scrollTo("answer", anchor: .top) } }
                }
        }
    }

    private func sections(_ model: CrossroadsModel, _ view: Crossroads) -> some View {
        List {
            row { RoadHeader(goal: view.road.goal, minPeople: view.minPeople) }
            if let ask {
                row { CrossroadsAnswerCard(model: ask) }.id("answer")
            }
            if !explainerSeen {
                row {
                    CrossroadsExplainer(goal: view.road.goal) { withAnimation(.spring(duration: 0.35)) { explainerSeen = true } }
                }
            }
            if let insight = view.pathInsight {
                row {
                    PathInsightCard(
                        insight: insight, otherRoles: otherRoles(view),
                        isCited: view.trails.first.map { model.cited.contains($0.id) } ?? false,
                    )
                }
            }
            matchesSection(model, view).id("matches")
            roadSection(model, view).id("road")
            yoursSection(model).id("yours")
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .animation(.spring(duration: 0.35), value: model.view)
        .animation(.spring(duration: 0.35), value: model.cited)
        .refreshable { await model.load() }
        .overlay(alignment: .top) { notice(model.notice) }
    }

    private func matchesSection(_ model: CrossroadsModel, _ view: Crossroads) -> some View {
        Section {
            row { SectionTitle("Where you match") }
            if model.matches.isEmpty {
                row {
                    TeachingEmpty(
                        symbol: "link",
                        text: "No matches yet. Practise an interview or finish a step: "
                            + "Skillit remembers what you're working on and matches it here.",
                    )
                }
            }
            ForEach(model.matches) { match in
                row { card(match.other, matching: match.you, model, view) }
                    .swipeActions(edge: .trailing) { deleteButton(match.you, model, title: "Delete your note") }
            }
        }
    }

    private func roadSection(_ model: CrossroadsModel, _ view: Crossroads) -> some View {
        Section {
            row { SectionTitle("More from your road") }
            if model.unlinkedLines.isEmpty, model.unlinkedFacts.isEmpty {
                row {
                    TeachingEmpty(
                        symbol: "person.3.fill",
                        text: "Nobody has shared from this road yet. When people land a job, what helped them shows up here.",
                    )
                }
            }
            ForEach(model.unlinkedLines) { line in
                row { card(.line(line), matching: nil, model, view) }
            }
            ForEach(model.unlinkedFacts) { fact in
                row { card(.fact(fact), matching: nil, model, view) }
            }
        }
    }

    @ViewBuilder private func yoursSection(_ model: CrossroadsModel) -> some View {
        if !model.unlinkedYours.isEmpty || model.matches.isEmpty {
            Section {
                row { SectionTitle("Only you can see these") }
                if model.unlinkedYours.isEmpty {
                    row {
                        TeachingEmpty(
                            symbol: "lock.fill", text: "Nothing saved yet. What you practise and finish lands here, private to you.",
                        )
                    }
                }
                ForEach(model.unlinkedYours) { item in
                    row { YourFace(item: item, isCited: model.cited.contains(item.id)) }
                        .swipeActions(edge: .trailing) { deleteButton(item, model, title: "Delete") }
                        .swipeActions(edge: .leading) { shareButton(item) }
                }
            }
        }
    }

    /// The card's own button still takes its tap; anywhere else on the card opens the detail sheet.
    private func card(_ other: Match.Other, matching item: YourItem?, _ model: CrossroadsModel, _ view: Crossroads) -> some View {
        cardFace(other, matching: item, model, view)
            .contentShape(.rect)
            .onTapGesture { detail = CrossroadsDetail(other: other, match: item) }
            .accessibilityAction(named: "Show details") { detail = CrossroadsDetail(other: other, match: item) }
    }

    @ViewBuilder
    private func cardFace(_ other: Match.Other, matching item: YourItem?, _ model: CrossroadsModel, _ view: Crossroads) -> some View {
        switch other {
        case let .line(line):
            LineCard(
                line: line, match: item, isCited: model.cited.contains(line.id), isOnRoad: view.isOnRoad(line),
                onMeToo: { Task { await model.toggleMeToo(line) } },
                onAdd: { Task { await model.addToRoad(line) } },
            )
        case let .fact(fact):
            FactCard(fact: fact, match: item, isCited: model.cited.contains(fact.id))
        }
    }

    private func otherRoles(_ view: Crossroads) -> [String] {
        view.trails.dropFirst().map { $0.example ? "\($0.role) (example)" : $0.role }
    }

    @ViewBuilder private func deleteButton(_ item: YourItem, _ model: CrossroadsModel, title: String) -> some View {
        if item.source == .memory {
            Button(role: .destructive) {
                deletions += 1
                Task { await model.forget(item) }
            } label: {
                Label(title, systemImage: "trash")
            }
        }
    }

    @ViewBuilder private func shareButton(_ item: YourItem) -> some View {
        if item.kind == .note, item.source == .memory {
            Button { sharing = item.asMemory } label: { Label("Share", systemImage: "square.and.arrow.up") }
                .tint(Theme.agent)
        }
    }

    private func row(@ViewBuilder _ content: () -> some View) -> some View {
        content()
            .listRowInsets(EdgeInsets(top: 6, leading: 20, bottom: 6, trailing: 20))
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
    }

    @ViewBuilder private func notice(_ text: String?) -> some View {
        if let text {
            Text(text)
                .font(.footnote)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Theme.raised, in: .capsule)
                .overlay(Capsule().strokeBorder(Theme.hairline))
                .padding(.top, 8)
                .transition(.move(edge: .top).combined(with: .opacity))
        }
    }

    /// Debug builds launched with `-CrossroadsScrollTo matches|road|yours` open scrolled there, since screenshots can't scroll.
    private static func scrollForScreenshot(_ proxy: ScrollViewProxy) async {
        #if DEBUG
            guard let target = UserDefaults.standard.string(forKey: "CrossroadsScrollTo") else { return }
            try? await Task.sleep(for: .milliseconds(500))
            proxy.scrollTo(target, anchor: .top)
        #endif
    }

    private func start() async {
        guard model == nil else { return }
        let service = app.crossroadsService
        let model = CrossroadsModel(service: service)
        self.model = model
        // screenshots and previews have no signed-in client; they get a scripted mic
        let dictation: any Dictation = app.client == nil ? ScriptedDictation() : SpeechDictation()
        ask = CrossroadsAskModel(service: service, dictation: dictation) { [weak model] cites in model?.highlight(cites) }
        await model.load()
    }
}
