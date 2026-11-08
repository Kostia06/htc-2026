import RavenKit
import SwiftUI

/// What Raven knows about one company, the questions people were asked there, and the way into a practice interview.
struct CompanyView: View {
    @Environment(AppModel.self) private var app
    @State private var model: CompanyModel?
    @State private var isSharing = false
    @State private var researchFinished = 0

    let slug: String
    private let injectedService: (any CompanyService)?
    private let onPractice: (String) -> Void

    /// `onPractice` is wired by the parent to start a voice interview for this company; by default it opens nothing.
    init(slug: String, service: (any CompanyService)? = nil, onPractice: @escaping (String) -> Void = { _ in }) {
        self.slug = slug
        injectedService = service
        self.onPractice = onPractice
    }

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.ground)
            .navigationTitle(model?.insights?.company.name ?? "")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.ground, for: .navigationBar)
            .task {
                guard model == nil else { return }
                let model = CompanyModel(slug: slug, service: injectedService ?? app.companyService)
                self.model = model
                await model.load()
            }
            .sheet(isPresented: $isSharing) {
                RecapView(companySlug: slug, voice: ElevenLabsRecapVoice())
            }
            .sensoryFeedback(.success, trigger: researchFinished)
            .onChange(of: model?.research) { _, research in
                if case .done = research {
                    researchFinished += 1
                }
            }
    }

    @ViewBuilder private var content: some View {
        switch model?.phase {
        case nil, .loading:
            ScrollView {
                VStack(spacing: 12) {
                    SkeletonLines(widths: [0.6, 0.35], highlighted: -1).ravenCard()
                    SkeletonLines().ravenCard()
                    SkeletonLines(widths: [0.8, 0.6, 0.9]).ravenCard()
                }
                .padding(16)
            }
        case let .failed(message):
            ContentUnavailableView {
                Label("Couldn't load this company", systemImage: "building.2")
            } description: {
                Text(message)
            } actions: {
                Button("Try again") { Task { await model?.load() } }
                    .buttonStyle(.raised)
                    .frame(maxWidth: 220)
            }
        case let .ready(insights):
            if let model {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        CompanyHeader(company: insights.company)
                        actions(model)
                        if insights.facts.isEmpty {
                            noFactsYet
                        }
                        ForEach(model.factGroups, id: \.kind) { group in
                            FactsSection(kind: group.kind, facts: group.facts)
                        }
                        ReportedQuestionsSection(questions: insights.questions, reportCount: insights.reportCount)
                        shareInvite
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 32)
                    .animation(.spring(duration: 0.4), value: insights.facts)
                }
                .refreshable { await model.load() }
            }
        }
    }

    private func actions(_ model: CompanyModel) -> some View {
        VStack(spacing: 12) {
            Button {
                onPractice(slug)
            } label: {
                Label("Practice an interview here", systemImage: "mic.fill")
            }
            .buttonStyle(.raised)

            ResearchButton(state: model.research) { Task { await model.refreshResearch() } }
        }
    }

    private var noFactsYet: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Nothing here yet").font(.headline)
            Text("Refresh the research and Raven will read the careers site, recent news and interview reports.")
                .font(.subheadline).foregroundStyle(.secondary)
        }
        .ravenCard()
    }

    private var shareInvite: some View {
        Button { isSharing = true } label: {
            HStack(spacing: 12) {
                Image(systemName: "hand.wave").font(.title3).foregroundStyle(Theme.action)
                VStack(alignment: .leading, spacing: 3) {
                    Text("I interviewed here").font(.headline)
                    Text("Tell Raven how it went. Shared anonymously.").font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.footnote.bold()).foregroundStyle(.tertiary)
            }
            .ravenCard()
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
    }
}

private struct CompanyHeader: View {
    let company: CompanyDetails

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(company.name).font(.largeTitle.bold())
            HStack(spacing: 10) {
                if let researched = RelativeTime.phrase(for: company.lastResearchedAt) {
                    Label("Researched \(researched)", systemImage: "clock")
                } else {
                    Label("Not researched yet", systemImage: "clock")
                }
                if let website = company.website, let url = URL(string: website), let host = url.host() {
                    Link(destination: url) {
                        Label(host.replacingOccurrences(of: "www.", with: ""), systemImage: "safari")
                    }
                    .foregroundStyle(Theme.action)
                }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 8)
    }
}

/// Refresh research, or the agent's purple working state, or the cooldown message when the server said not yet.
private struct ResearchButton: View {
    let state: CompanyModel.Research
    let action: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            switch state {
            case .running:
                HStack(spacing: 10) {
                    ProgressView().tint(Theme.agent)
                    Text("Raven is researching…").font(.headline).foregroundStyle(Theme.agent)
                }
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(Theme.agent.opacity(0.14), in: .rect(cornerRadius: 16))
            case let .done(added):
                Label(added > 0 ? "Found \(added) new fact\(added == 1 ? "" : "s")" : "Up to date", systemImage: "checkmark.circle.fill")
                    .font(.headline)
                    .foregroundStyle(Theme.agent)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(Theme.agent.opacity(0.14), in: .rect(cornerRadius: 16))
            case .idle, .refused:
                Button(action: action) {
                    Label("Refresh research", systemImage: "arrow.clockwise")
                        .font(.headline)
                        .foregroundStyle(Theme.agent)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(Theme.agent.opacity(0.14), in: .rect(cornerRadius: 16))
                }
                .buttonStyle(.plain)
            }
            if case let .refused(message) = state {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.spring(duration: 0.35), value: state)
        .sensoryFeedback(.warning, trigger: state) { _, new in
            if case .refused = new {
                true
            } else {
                false
            }
        }
    }
}
