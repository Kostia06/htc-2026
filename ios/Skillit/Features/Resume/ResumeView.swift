import SkillitKit
import SwiftUI
import UniformTypeIdentifiers

/// The resume section: the coach's suggestions, one preview drawn like the PDF, tailored versions, and the export.
/// Everything else (LinkedIn review, the web builder) waits in the toolbar menu.
/// Meant to be pushed inside a navigation stack (Profile links here).
struct ResumeView: View {
    @Environment(AppModel.self) private var app
    @State private var model: ResumeModel?
    @State private var editing: ResumeArea?
    @State private var isExporting = false
    @State private var isReviewingLinkedin = false
    /// The resume as it was when a section sheet opened, so closing it saves only real changes.
    @State private var beforeEditing: Resume?

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
                    Button("Export", systemImage: "square.and.arrow.up") { isExporting = true }
                }
                ToolbarItem(placement: .secondaryAction) {
                    Button("Review my LinkedIn", systemImage: "person.text.rectangle") { isReviewingLinkedin = true }
                }
                ToolbarItem(placement: .secondaryAction) {
                    Link(destination: ResumeLinks.webBuilder) {
                        Label("Open the web builder", systemImage: "arrow.up.right.square")
                    }
                }
            }
        }
        .sheet(isPresented: $isReviewingLinkedin) { LinkedinReviewView() }
        .sheet(isPresented: $isExporting) {
            if let model {
                ResumeExportView(templateKey: "resume.template.base") { format, template async throws(SkillitError) -> URL in
                    try await model.file(format, template: template)
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            if let model, model.phase == .ready {
                improveButton(model)
            }
        }
        .refreshable { await model?.load() }
        .sheet(item: $editing, onDismiss: finishEditing) { area in
            if let model {
                @Bindable var model = model
                ResumeSectionEditor(area: area, resume: $model.resume)
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
            ResumePreview(resume: model.resume) { area in
                beforeEditing = model.resume
                editing = area
            }
            if model.saveFailed {
                Label("Your last change didn't save. Pull to refresh or edit again.", systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(Theme.negative)
            }
            TailoredResumesSection(service: app.tailoredResumeService)
                .padding(.top, 12)
                .padding(.bottom, 8)
        }
    }

    private func improveButton(_ model: ResumeModel) -> some View {
        Button {
            Task { await model.improve() }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "pencil.line")
                    .symbolEffect(.pulse, isActive: model.isImproving)
                Text(model.isImproving ? "Skillit is reading your resume…" : "Improve with Skillit")
                    .contentTransition(.interpolate)
            }
        }
        .buttonStyle(.raised(Theme.agent, foreground: Theme.onAction))
        .disabled(model.isImproving)
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .background(Theme.ground.opacity(0.92))
        .animation(.spring(duration: 0.3), value: model.isImproving)
        .sensoryFeedback(.success, trigger: model.acceptedCount)
        .sensoryFeedback(.impact(weight: .medium), trigger: model.isImproving) { _, running in running }
    }

    private func finishEditing() {
        guard let model, let beforeEditing else { return }
        model.finishEditing(from: beforeEditing)
        self.beforeEditing = nil
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
