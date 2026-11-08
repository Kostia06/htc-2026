import SkillitKit
import SwiftUI

/// Crossroads: where the person's road meets everyone's. Crossings first (their item linked to what others said),
/// then the trails that ended in a job, the rest of the road, fresh research, and what is only theirs.
/// Pushed inside an existing navigation stack, so it brings none of its own.
struct CrossroadsView: View {
    @Environment(AppModel.self) private var app
    @State private var model: CrossroadsModel?
    @State private var ask: CrossroadsAskModel?
    @State private var sharing: PrivateMemory?
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
            .sheet(item: $sharing) { memory in
                ShareMemorySheet(memory: memory, service: app.memoryService)
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
        List {
            row { RoadHeader(road: view.road, minPeople: view.minPeople) }
            if !model.junctions.isEmpty {
                Section {
                    row { LaneCaptions() }
                    ForEach(model.junctions) { junction in
                        row { JunctionRow(junction: junction, cited: model.cited) }
                            .swipeActions(edge: .trailing) { deleteButton(junction.you, model) }
                    }
                } header: {
                    SectionTitle("Where you cross", detail: "Your notes, linked to what others on the road went through")
                }
            }
            if !view.trails.isEmpty {
                Section {
                    TrailStrip(trails: view.trails, cited: model.cited)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                } header: {
                    SectionTitle("Paths that worked", detail: "Roads that ended in a job")
                }
            }
            if !model.unlinkedLines.isEmpty {
                Section {
                    ForEach(model.unlinkedLines) { line in
                        row { RoadLineRow(line: line, isCited: model.cited.contains(line.id)) { Task { await model.toggleMeToo(line) } } }
                    }
                } header: {
                    SectionTitle("Everyone on your road", detail: "Anonymous. Tap \u{201C}That's me too\u{201D} if it's yours as well")
                }
            }
            if !view.research.isEmpty {
                Section {
                    ForEach(view.research) { fact in row { ResearchRow(fact: fact, isCited: model.cited.contains(fact.id)) } }
                } header: {
                    SectionTitle("Fresh from research", detail: "Employers on your road, with sources")
                }
            }
            yoursSection(model)
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .animation(.spring(duration: 0.35), value: model.view)
        .animation(.spring(duration: 0.35), value: model.cited)
        .refreshable { await model.load() }
        .overlay(alignment: .top) { notice(model.notice) }
    }

    private func yoursSection(_ model: CrossroadsModel) -> some View {
        Section {
            if model.unlinkedYours.isEmpty, model.junctions.isEmpty {
                row { Text("Nothing of yours yet. Skillit remembers as you practise and finish steps.").foregroundStyle(.secondary) }
            }
            ForEach(model.unlinkedYours) { item in
                row { YourFace(item: item, isCited: model.cited.contains(item.id)) }
                    .swipeActions(edge: .trailing) { deleteButton(item, model) }
                    .swipeActions(edge: .leading) {
                        if item.kind == .note, item.source == .memory {
                            Button { sharing = item.asMemory } label: { Label("Share", systemImage: "square.and.arrow.up") }
                                .tint(Theme.agent)
                        }
                    }
            }
        } header: {
            SectionTitle("Only yours so far", detail: "Private, encrypted. Swipe left to delete")
        }
    }

    @ViewBuilder private func deleteButton(_ item: YourItem, _ model: CrossroadsModel) -> some View {
        if item.source == .memory {
            Button(role: .destructive) {
                deletions += 1
                Task { await model.forget(item) }
            } label: {
                Label("Delete", systemImage: "trash")
            }
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
