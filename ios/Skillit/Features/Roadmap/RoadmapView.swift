import SkillitKit
import SwiftUI

/// The home screen: progress at the top and the winding path of steps below it.
struct RoadmapView: View {
    @Environment(AppModel.self) private var app
    @State private var model: RoadmapModel?
    @State private var postings = PostingsModel()
    @State private var picking: PracticePick?
    @State private var pending: PracticeLaunch?
    @State private var practice: PracticeLaunch?
    @State private var lastPractice: PracticeLaunch?

    var body: some View {
        NavigationStack {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.ground)
        }
        // the cover goes up once the picker is fully gone; iOS drops one presented while a sheet is closing
        .sheet(item: $picking, onDismiss: launchPending) { pick in
            InterviewTargetPicker(postings: postings.postings, initial: pick.initial) { request in
                pending = PracticeLaunch(step: pick.step, session: app.voiceSession(request))
            }
        }
        .fullScreenCover(item: $practice, onDismiss: finishPractice) { launch in
            VoiceSessionView(model: launch.session, onPracticeAgain: { startPractice(launch.step) })
        }
        .task {
            guard model == nil else { return }
            let model = RoadmapModel(service: service)
            self.model = model
            await model.load()
        }
        .task(id: app.updatesApplied) { await postings.load(using: app.client) }
        .onChange(of: app.updatesApplied) { Task { await model?.load() } }
    }

    @ViewBuilder private var content: some View {
        switch model?.phase {
        case nil, .loading:
            RoadmapSkeleton()
        case let .failed(message):
            ContentUnavailableView {
                Label("Couldn't load your road", systemImage: "point.topleft.down.to.point.bottomright.curvepath")
            } description: {
                Text(message)
            } actions: {
                Button("Try again") { Task { await model?.load() } }
                    .buttonStyle(.raised)
                    .frame(maxWidth: 220)
            }
        case let .ready(page):
            if let model {
                RoadmapPath(model: model, page: page, onStart: startPractice)
            }
        }
    }

    /// Asks what the interview is for first, preset to what the step says; "Practice again" skips the asking.
    private func startPractice(_ step: RoadmapStep) {
        guard let action = step.action else { return }
        if let last = lastPractice, last.step.id == step.id {
            // the summary is on screen, so the first run already counts before the second one starts
            recordIfFinished(last)
            let launch = PracticeLaunch(step: step, session: app.voiceSession(last.session.request))
            lastPractice = launch
            practice = launch
            return
        }
        let initial = InterviewTarget(action: action, postings: postings.postings, companyName: app.companies.name(for:))
        picking = PracticePick(step: step, initial: initial)
    }

    private func launchPending() {
        guard let launch = pending else { return }
        pending = nil
        lastPractice = launch
        practice = launch
    }

    /// Runs when the cover goes away. Swapping in a "Practice again" session also dismisses the old cover,
    /// so only forget the launch once nothing is presented any more.
    private func finishPractice() {
        guard practice == nil, let launch = lastPractice else { return }
        lastPractice = nil
        recordIfFinished(launch)
    }

    /// A session that reached its summary counts as the step done; one closed early leaves the step as it was.
    private func recordIfFinished(_ launch: PracticeLaunch) {
        guard case let .finished(debrief) = launch.session.phase else { return }
        withAnimation(.spring(duration: 0.5)) {
            model?.complete(launch.step, note: String("Scored \(debrief.overall)/100. \(debrief.verdict)".prefix(160)))
        }
    }

    private var service: any RoadmapService {
        if let client = app.client {
            return client
        }
        #if DEBUG
            return SampleRoadmap(goal: app.profile.targetRoles.first ?? "Junior data analyst")
        #else
            return UnavailableRoadmap()
        #endif
    }
}

/// A step whose interview is about to start, with the target its action points at.
struct PracticePick: Identifiable {
    let step: RoadmapStep
    let initial: InterviewTarget?

    var id: String {
        step.id
    }
}

/// A practice session started from a step, kept together so the step can be marked done when the session ends.
struct PracticeLaunch: Identifiable {
    let step: RoadmapStep
    let session: VoiceSessionModel

    // keyed by session, not step: "Practice again" on the same step must present a fresh cover, or the
    // session view keeps its identity and its `.task` never runs the new session
    var id: ObjectIdentifier {
        ObjectIdentifier(session)
    }
}
