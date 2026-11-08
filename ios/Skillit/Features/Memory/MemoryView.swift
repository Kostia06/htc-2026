import SkillitKit
import SwiftUI

/// Everything Skillit has written down about the person, with a way to delete any of it or share a note anonymously.
struct MemoryView: View {
    @Environment(AppModel.self) private var app
    @State private var model: MemoryModel?
    @State private var sharing: PrivateMemory?
    @State private var deletions = 0
    private let injectedService: (any MemoryService)?

    init(service: (any MemoryService)? = nil) {
        injectedService = service
    }

    private var service: any MemoryService {
        injectedService ?? app.memoryService
    }

    var body: some View {
        NavigationStack {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.ground)
                .navigationTitle("What Skillit remembers")
                .navigationBarTitleDisplayMode(.inline)
        }
        .task {
            guard model == nil else { return }
            let model = MemoryModel(service: service)
            self.model = model
            await model.load()
        }
        .sheet(item: $sharing) { memory in
            ShareMemorySheet(memory: memory, service: service)
        }
        .sensoryFeedback(.impact(weight: .medium), trigger: deletions)
    }

    @ViewBuilder private var content: some View {
        if let model {
            List {
                Section {
                    PrivacyExplainer()
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 8, trailing: 0))
                }
                switch model.phase {
                case .loading:
                    Section {
                        ForEach(0 ..< 3, id: \.self) { _ in SkeletonLines(widths: [0.8, 0.5], highlighted: -1) }
                    }
                    .listRowBackground(Theme.raised)
                case let .failed(message):
                    Section {
                        ContentUnavailableView {
                            Label("Couldn't load memories", systemImage: "brain")
                        } description: {
                            Text(message)
                        } actions: {
                            Button("Try again") { Task { await model.load() } }.buttonStyle(.raised).frame(maxWidth: 220)
                        }
                    }
                    .listRowBackground(Color.clear)
                case .ready:
                    if model.memories.isEmpty {
                        Section {
                            Text("Nothing yet. Skillit starts remembering as you practise and finish steps.").foregroundStyle(.secondary)
                        }
                        .listRowBackground(Theme.raised)
                    }
                    ForEach(model.groups, id: \.kind) { group in
                        Section {
                            ForEach(group.memories) { memory in
                                MemoryRow(memory: memory)
                                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                        Button(role: .destructive) {
                                            deletions += 1
                                            Task { await model.forget(memory) }
                                        } label: {
                                            Label("Delete", systemImage: "trash")
                                        }
                                    }
                                    .swipeActions(edge: .leading) {
                                        if memory.kind == .note {
                                            Button { sharing = memory } label: {
                                                Label("Share", systemImage: "square.and.arrow.up")
                                            }
                                            .tint(Theme.agent)
                                        }
                                    }
                                    .contextMenu {
                                        if memory.kind == .note {
                                            Button("Share anonymously", systemImage: "square.and.arrow.up") { sharing = memory }
                                        }
                                        Button("Delete", systemImage: "trash", role: .destructive) {
                                            deletions += 1
                                            Task { await model.forget(memory) }
                                        }
                                    }
                            }
                        } header: {
                            Label(group.kind.title, systemImage: group.kind.symbol)
                        } footer: {
                            if group.kind == .note {
                                Text("Swipe right on a note to share it anonymously with people preparing for the same company.")
                            }
                        }
                        .listRowBackground(Theme.raised)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .animation(.spring(duration: 0.35), value: model.memories)
            .refreshable { await model.load() }
            .overlay(alignment: .bottom) {
                if let notice = model.notice {
                    Text(notice)
                        .font(.footnote)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Theme.raised, in: .capsule)
                        .overlay(Capsule().strokeBorder(Theme.hairline))
                        .padding(.bottom, 16)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.spring(duration: 0.35), value: model.notice)
        } else {
            ProgressView()
        }
    }
}

private struct PrivacyExplainer: View {
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "lock.shield.fill").font(.title3).foregroundStyle(Theme.agent)
            VStack(alignment: .leading, spacing: 4) {
                Text("Private to you").font(.headline)
                Text(
                    "Encrypted with a key only your account holds. Skillit uses these to shape your roadmap and practice. "
                        + "Delete any of them, any time; nothing leaves unless you share a note.",
                )
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
        }
        .skillitCard()
    }
}

private struct MemoryRow: View {
    let memory: PrivateMemory

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(memory.text).font(.body)
            Text(detail).font(.caption).foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }

    private var detail: String {
        var parts: [String] = []
        if let added = RelativeTime.phrase(for: memory.createdAt) {
            parts.append("Added \(added)")
        }
        if memory.uses > 0 {
            parts.append("Used \(memory.uses) \(memory.uses == 1 ? "time" : "times")")
        }
        return parts.joined(separator: " · ")
    }
}
