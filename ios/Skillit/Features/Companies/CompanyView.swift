import SkillitKit
import SwiftUI

/// What Skillit knows about one company, the questions people were asked there, and the way into a practice interview.
struct CompanyView: View {
    private enum Tab: String, CaseIterable, Identifiable {
        case facts = "Facts"
        case questions = "Questions"

        var id: Self {
            self
        }
    }

    @Environment(AppModel.self) private var app
    @State private var model: CompanyModel?
    @State private var isSharing = false
    @State private var researchFinished = 0
    @State private var tab = Tab.facts

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
            .toolbar {
                if let model, model.insights != nil {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Refresh research", systemImage: "arrow.clockwise") { Task { await model.refreshResearch() } }
                            .disabled(model.research == .running)
                    }
                }
            }
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
                    SkeletonLines(widths: [0.6, 0.35], highlighted: -1).skillitCard()
                    SkeletonLines().skillitCard()
                    SkeletonLines(widths: [0.8, 0.6, 0.9]).skillitCard()
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
                ready(insights, model)
            }
        }
    }

    private func ready(_ insights: CompanyInsights, _ model: CompanyModel) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                CompanyHeader(company: insights.company, research: model.research)
                Button {
                    onPractice(slug)
                } label: {
                    Label("Practice an interview", systemImage: "mic.fill")
                }
                .buttonStyle(.raised)
                shareButton
                if insights.facts.isEmpty, insights.questions.isEmpty {
                    nothingYet(model)
                } else {
                    Picker("Section", selection: $tab) {
                        ForEach(Tab.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    switch tab {
                    case .facts: facts(model)
                    case .questions: ReportedQuestionsSection(questions: insights.questions, reportCount: insights.reportCount)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 32)
            .animation(.spring(duration: 0.4), value: insights.facts)
            .animation(.spring(duration: 0.35), value: model.research)
        }
        .refreshable { await model.load() }
    }

    @ViewBuilder private func facts(_ model: CompanyModel) -> some View {
        if model.factGroups.isEmpty {
            Text("No facts yet. Refresh to research.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        ForEach(model.factGroups, id: \.kind) { group in
            FactsSection(kind: group.kind, facts: group.facts)
        }
    }

    private var shareButton: some View {
        Button { isSharing = true } label: {
            Label("I interviewed here, tell Skillit", systemImage: "hand.wave")
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .foregroundStyle(.secondary)
    }

    private func nothingYet(_ model: CompanyModel) -> some View {
        ContentUnavailableView {
            Label("Nothing here yet", systemImage: "building.2")
        } description: {
            Text("Skillit will read the careers site, recent news and interview reports.")
        } actions: {
            if model.research != .running {
                Button("Refresh research") { Task { await model.refreshResearch() } }
                    .buttonStyle(.raised)
                    .frame(maxWidth: 220)
            }
        }
    }
}

private struct CompanyHeader: View {
    let company: CompanyDetails
    let research: CompanyModel.Research

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(company.name).font(.title2.bold())
            HStack(spacing: 6) {
                Text(RelativeTime.phrase(for: company.lastResearchedAt).map { "Researched \($0)" } ?? "Not researched yet")
                if let website = company.website, let url = URL(string: website), let host = url.host() {
                    Text("·")
                    Link(host.replacingOccurrences(of: "www.", with: ""), destination: url)
                        .underline()
                }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .tint(.secondary)
            ResearchStatus(state: research)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 8)
    }
}

/// One line under the header: the agent working, what it found, or why the server said not yet.
private struct ResearchStatus: View {
    let state: CompanyModel.Research

    var body: some View {
        Group {
            switch state {
            case .idle:
                EmptyView()
            case .running:
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small).tint(Theme.agent)
                    Text("Skillit is researching…")
                }
                .foregroundStyle(Theme.agent)
            case let .done(added):
                Label(added > 0 ? "Found \(added) new fact\(added == 1 ? "" : "s")" : "Up to date", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(Theme.positive)
            case let .refused(message):
                Label(message, systemImage: "clock.badge.exclamationmark")
                    .foregroundStyle(Theme.negative)
            }
        }
        .font(.subheadline.weight(.medium))
        .padding(.top, 4)
        .transition(.move(edge: .top).combined(with: .opacity))
        .sensoryFeedback(.warning, trigger: state) { _, new in
            if case .refused = new {
                true
            } else {
                false
            }
        }
    }
}
