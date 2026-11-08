import RavenKit
import SwiftUI
import UniformTypeIdentifiers

/// The resume section: a live preview, the coach's suggestions above it, a PDF to share, and the web builder for the rest.
/// Meant to be pushed inside a navigation stack (Profile links here).
struct ResumeView: View {
    @Environment(AppModel.self) private var app
    @State private var model: ResumeModel?
    @State private var editing: ResumeArea?

    init() {}

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let model {
                    content(model)
                } else {
                    ResumeSkeleton()
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.ground)
        .navigationTitle("Resume")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let model, model.phase == .ready {
                ToolbarItem(placement: .primaryAction) {
                    ShareLink(
                        item: ResumePDF(fetch: { try await model.pdfFile() }),
                        preview: SharePreview("Resume.pdf", image: Image(systemName: "doc.richtext"))
                    ) {
                        Label("Download PDF", systemImage: "arrow.down.doc")
                    }
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            if let model, model.phase == .ready {
                improveButton(model)
            }
        }
        .refreshable { await model?.load() }
        .sheet(item: $editing) { area in
            if let model {
                @Bindable var model = model
                ResumeSectionEditor(area: area, resume: $model.resume) { model.commit() }
            }
        }
        .task {
            guard model == nil else { return }
            let model = ResumeModel(service: service)
            self.model = model
            await model.load()
            #if DEBUG
                if UserDefaults.standard.string(forKey: "RavenResumeDemo") == "suggestions" {
                    await model.improve()
                }
            #endif
        }
    }

    @ViewBuilder private func content(_ model: ResumeModel) -> some View {
        switch model.phase {
        case .loading:
            ResumeSkeleton()
        case let .failed(message):
            ContentUnavailableView {
                Label("Couldn't load your resume", systemImage: "doc.text")
            } description: {
                Text(message)
            } actions: {
                Button("Try again") { Task { await model.load() } }
                    .buttonStyle(.raised)
                    .frame(maxWidth: 220)
            }
            .padding(.top, 60)
        case .ready:
            if !model.suggestions.isEmpty {
                SuggestionDeck(suggestions: model.suggestions, resume: model.resume) { suggestion in
                    withAnimation(.spring(duration: 0.4)) { model.accept(suggestion) }
                } onSkip: { suggestion in
                    withAnimation(.spring(duration: 0.4)) { model.skip(suggestion) }
                }
                .transition(.move(edge: .top).combined(with: .opacity))
            } else if let note = model.coachNote {
                Text(note)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .transition(.opacity)
            }
            ResumePreview(resume: model.resume) { editing = $0 }
            footer(model)
        }
    }

    private func footer(_ model: ResumeModel) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if model.saveFailed {
                Label("Your last change didn't save. Pull to refresh or edit again.", systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(Theme.action)
            }
            Link(destination: ResumeLinks.webBuilder) {
                Label("Open the web builder", systemImage: "arrow.up.right.square")
                    .font(.footnote)
            }
            .tint(.secondary)
            Text("The full builder is on the web, still being built. Changes you make here show up there too.")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.bottom, 8)
        .sensoryFeedback(.success, trigger: model.acceptedCount)
    }

    private func improveButton(_ model: ResumeModel) -> some View {
        Button {
            Task { await model.improve() }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "sparkles")
                    .symbolEffect(.pulse, isActive: model.isImproving)
                Text(model.isImproving ? "Raven is reading your resume…" : "Improve with Raven")
                    .contentTransition(.interpolate)
            }
        }
        .buttonStyle(.raised(Theme.agent))
        .disabled(model.isImproving)
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .background(Theme.ground.opacity(0.92))
        .animation(.spring(duration: 0.3), value: model.isImproving)
        .sensoryFeedback(.impact(weight: .medium), trigger: model.isImproving) { _, running in running }
    }

    private var service: any ResumeService {
        if let client = app.client {
            return client
        }
        #if DEBUG
            return SampleResume()
        #else
            return UnavailableResume()
        #endif
    }
}

/// The PDF is fetched only when the share sheet asks for it, so opening the sheet costs nothing until then.
nonisolated struct ResumePDF: Transferable {
    let fetch: @Sendable () async throws -> URL

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .pdf) { pdf in
            try await SentTransferredFile(pdf.fetch())
        }
    }
}

/// The paper's shape while the resume loads, so the page never jumps when it lands.
struct ResumeSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            SkeletonLines(widths: [0.5, 0.8], highlighted: -1)
            SkeletonLines(widths: [0.3, 0.9, 0.7, 0.8], highlighted: 2)
            SkeletonLines(widths: [0.3, 0.85, 0.6], highlighted: -1)
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.raised, in: .rect(cornerRadius: 20))
    }
}
