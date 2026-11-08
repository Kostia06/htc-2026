import SkillitKit
import SwiftUI

/// Where a notification lands, presented over whatever tab is showing: the same screens the app opens elsewhere,
/// fetched by id first because a notification carries only the id.
struct NotificationDestinationView: View {
    let target: NotificationTarget
    @Environment(AppModel.self) private var app
    @State private var loaded: Loaded?
    @State private var failure: String?

    private enum Loaded {
        case feed(FeedCard)
        case step(RoadmapStep)
        case report(PracticeSessionSummary)
        case resume(TailoredResume, SkillitClient)
    }

    var body: some View {
        Group {
            if case let .company(slug) = target {
                CompanySheet(slug: slug)
            } else if let loaded {
                view(for: loaded)
            } else if let failure {
                ContentUnavailableView("Can't open this", systemImage: "bell.slash", description: Text(failure))
                    .presentationBackground(Theme.ground)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .presentationBackground(Theme.ground)
            }
        }
        .task { await load() }
    }

    @ViewBuilder private func view(for loaded: Loaded) -> some View {
        switch loaded {
        case let .feed(card):
            FeedDestination(card: card)
        case let .step(step):
            StepDestination(step: step)
        case let .report(session):
            NavigationStack {
                PracticeSessionDetailView(
                    session: session, service: app.practiceHistoryService, replayService: app.replayService
                )
            }
            .presentationBackground(Theme.ground)
        case let .resume(tailored, client):
            NavigationStack {
                TailoredResumeView(model: TailoredResumeModel(tailored: tailored, service: client))
            }
            .presentationBackground(Theme.ground)
        }
    }

    private func load() async {
        guard let client = app.client else {
            failure = "Sign in to see this."
            return
        }
        do {
            switch target {
            case let .feed(id): loaded = try await .feed(client.feedCard(id: id))
            case let .step(id): loaded = try await step(id, using: client).map { .step($0) }
            case let .report(id): loaded = try await client.practiceHistory().sessions.first { $0.id == id }.map { .report($0) }
            case let .resume(id): loaded = try await .resume(client.tailoredResume(id: id), client)
            case .company, .unknown: return
            }
            if loaded == nil { failure = "It may have been removed since." }
        } catch {
            failure = error.message
        }
    }

    private func step(_ id: String, using client: SkillitClient) async throws(SkillitError) -> RoadmapStep? {
        let page = try await client.roadmap(cursor: nil, timeZone: .current)
        return (page.next + page.completed.flatMap(\.steps)).first { $0.id == id }
    }
}

/// A feed card's detail; the bookmark goes through the For you model so the tab shows the same state.
private struct FeedDestination: View {
    @Environment(AppModel.self) private var app
    @State var card: FeedCard

    var body: some View {
        FeedDetailSheet(card: card) {
            guard let client = app.client else { return }
            if card.isSaved { app.feed.unsave(card, using: client) } else { app.feed.save(card, using: client) }
            card.saved = !card.isSaved
        }
    }
}

/// A Road step's detail with both of its actions working here: practice opens over it, "mark done" asks what happened.
private struct StepDestination: View {
    let step: RoadmapStep
    @Environment(AppModel.self) private var app
    @State private var session: VoiceSessionModel?
    @State private var isFinishing = false

    var body: some View {
        StepDetailSheet(step: step, onPractice: practice, onMarkDone: { isFinishing = true })
            .fullScreenCover(item: $session) { session in
                VoiceSessionView(model: session, onPracticeAgain: practice)
            }
            .sheet(isPresented: $isFinishing) {
                QuickUpdateView(focusTitle: step.title) { app.noteApplied($0) }
            }
    }

    private func practice() {
        guard let action = step.action else { return }
        let request = VoiceSessionRequest(
            mode: .interview, companySlug: action.companySlug, role: action.role, difficulty: .preferred, postingId: action.postingId,
        )
        session = app.voiceSession(request)
    }
}
