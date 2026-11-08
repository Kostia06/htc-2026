import SkillitKit
import SwiftUI

/// The Profile tab, kept short on purpose: who you are and how far along the road you are, the one thing worth
/// doing next, then four doors. Every editor lives one tap behind a door; settings sit behind the gear.
struct ProfileView: View {
    @Environment(AppModel.self) private var app
    @State private var overview = ProfileOverviewModel()
    @State private var headlineEditor = ProfileEditor()
    @State private var path: [ProfileDestination] = []
    @State private var openedTailored: TailoredResumeModel?
    @State private var tailoring: TailorRequest?
    @State private var isRecordingOutcome = false

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    VStack(alignment: .leading, spacing: 12) {
                        ProfileHeader(profile: app.profile) { headlineEditor.apply(.setHeadline($0), to: app) }
                        if let road = overview.road, road.total > 0 {
                            RoadProgressLine(progress: road)
                        }
                    }
                    if let move = overview.nextMove(for: app.profile) {
                        NextMoveCard(move: move) { take(move) }
                            .transition(.opacity)
                    }
                    ProfileDoors(doors: doors)
                    gotTheJobButton
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
                .animation(.spring(duration: 0.35), value: overview.hasLoaded)
            }
            .background(Theme.ground)
            .navigationTitle("Profile")
            .sheet(isPresented: $isRecordingOutcome) { GotTheJobSheet() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Settings", systemImage: "gearshape") { path.append(.settings) }
                }
            }
            .navigationDestination(for: ProfileDestination.self, destination: screen)
            .navigationDestination(isPresented: isTailoredOpen) {
                if let openedTailored {
                    TailoredResumeView(model: openedTailored, onDeleted: reload)
                }
            }
            .sheet(item: $tailoring, onDismiss: reload) { request in
                TailorJobSheet(service: app.tailoredResumeService, postingId: request.postingId, onSaved: reload)
            }
            .task { await overview.load(from: app) }
            // coming back from a door may have changed what it shows: a new tailored copy, a paired headset
            .onChange(of: path) { _, newPath in
                if newPath.isEmpty { reload() }
            }
            .refreshable { await refresh() }
            .overlay(alignment: .bottom) { SavedFlash(count: headlineEditor.saveCount) }
            .sensoryFeedback(.success, trigger: headlineEditor.saveCount)
            .alert("Couldn't save", isPresented: hasFailure) {
                Button("OK") { headlineEditor.dismissFailure() }
            } message: {
                Text(headlineEditor.failure ?? "")
            }
        }
    }

    /// The finish line of the road: recording it can feed the shared trails that help the next person.
    private var gotTheJobButton: some View {
        Button { isRecordingOutcome = true } label: {
            HStack(spacing: 12) {
                Image(systemName: "flag.checkered")
                    .font(.title3)
                    .foregroundStyle(Theme.positive)
                VStack(alignment: .leading, spacing: 2) {
                    Text("I got the job").font(.headline)
                    Text("Mark the finish and help the next person on your road")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .foregroundStyle(.primary)
            .skillitCard()
        }
        .buttonStyle(.raisedCard())
    }

    private var doors: [ProfileDoor] {
        let profile = app.profile
        let tailoredCount = overview.tailored.count
        return [
            ProfileDoor(
                destination: .resume, title: "Resume", symbol: "doc.text",
                fact: tailoredCount == 0 ? "Base resume" : "Base + \(tailoredCount) tailored",
            ),
            ProfileDoor(
                destination: .skillsAndExperience, title: "Skills & experience", symbol: "list.bullet.rectangle",
                fact: "\(counted(profile.skills.count, "skill")) · \(counted(profile.experience.count, "job"))",
            ),
            ProfileDoor(destination: .crossroads, title: "Crossroads", symbol: "signpost.right.and.left", fact: "What Skillit remembers"),
            ProfileDoor(destination: .headsets, title: "Headsets", symbol: "visionpro", fact: headsetFact),
        ]
    }

    private var headsetFact: String {
        switch overview.headsetCount {
        case nil: "Practice in VR"
        case 0: "None paired yet"
        case let count?: "\(count) paired"
        }
    }

    @ViewBuilder private func screen(for destination: ProfileDestination) -> some View {
        switch destination {
        case .resume: ResumeView()
        case .skillsAndExperience: SkillsAndExperienceView()
        case .crossroads: MemoryView()
        case .headsets: PairHeadsetView()
        case .settings: SettingsView()
        }
    }

    private func take(_ move: ProfileNextMove) {
        switch move {
        case .chooseRole, .addExperience, .backUpSkill:
            path.append(.skillsAndExperience)
        case let .closeGap(tailoredId, _, _):
            Task { await openTailored(id: tailoredId) }
        case let .tailor(postingId, _):
            tailoring = TailorRequest(postingId: postingId)
        }
    }

    private func openTailored(id: String) async {
        let service = app.tailoredResumeService
        guard let tailored = try? await service.tailoredResume(id: id) else { return }
        openedTailored = TailoredResumeModel(tailored: tailored, service: service)
    }

    private var isTailoredOpen: Binding<Bool> {
        Binding {
            openedTailored != nil
        } set: { isPresented in
            guard !isPresented else { return }
            openedTailored = nil
            reload()
        }
    }

    private var hasFailure: Binding<Bool> {
        Binding(get: { headlineEditor.failure != nil }, set: { if !$0 { headlineEditor.dismissFailure() } })
    }

    private func reload() {
        Task { await overview.load(from: app) }
    }

    private func refresh() async {
        if let profile = try? await app.client?.profile() {
            app.profile = profile
        }
        await overview.load(from: app)
    }

    private func counted(_ count: Int, _ noun: String) -> String {
        "\(count) \(noun)\(count == 1 ? "" : "s")"
    }
}

/// Which saved posting the tailor sheet opens on.
private struct TailorRequest: Identifiable {
    let postingId: String

    var id: String {
        postingId
    }
}

#if DEBUG
#Preview {
    ProfileView()
        .environment(AppModel.preview(profile: .sample))
}
#endif
