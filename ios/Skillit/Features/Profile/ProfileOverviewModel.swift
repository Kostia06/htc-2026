import Foundation
import Observation
import SkillitKit

/// The facts the Profile tab shows on its doors and uses to pick the next move. Each one loads on its own,
/// so one slow or failing call leaves the others on screen.
@Observable
final class ProfileOverviewModel {
    /// The Road's own count (`RoadmapPage.trailProgress`), so both screens always agree.
    private(set) var road: RoadmapProgress?
    private(set) var roadFromResume = 0
    private(set) var tailored: [TailoredResumeSummary] = []
    private(set) var postings: [JobPosting] = []
    /// The first requirement the weakest tailored resume still misses, e.g. "SQL".
    private(set) var missingTopic: String?
    private(set) var headsetCount: Int?
    private(set) var hasLoaded = false

    func load(from app: AppModel) async {
        let resumes = app.tailoredResumeService
        let client = app.client
        let headsets = headsetService(for: app)
        async let tailoredItems = try? resumes.tailoredResumes()
        async let postingItems = try? resumes.postings()
        async let roadPage = try? client?.roadmap()
        async let headsetStatus = try? headsets?.headsetStatus()

        tailored = await tailoredItems ?? tailored
        postings = await postingItems ?? postings
        if let page = await roadPage {
            road = page.trailProgress
            roadFromResume = page.resumeSteps.count
        }
        headsetCount = await headsetStatus.map(\.devices.count) ?? headsetCount
        missingTopic = await firstMissingTopic(using: resumes)
        hasLoaded = true
    }

    func nextMove(for profile: Profile) -> ProfileNextMove? {
        // until the resumes are in, only "choose a role" is certain; anything else might flip a second later
        guard hasLoaded || profile.targetRoles.isEmpty else { return nil }
        return ProfileNextMove.pick(profile: profile, tailored: tailored, postings: postings, missingTopic: missingTopic)
    }

    private func firstMissingTopic(using service: any TailoredResumeService) async -> String? {
        guard let weakest = ProfileNextMove.weakestTailored(tailored),
              let full = try? await service.tailoredResume(id: weakest.id) else { return nil }
        let missing = full.match.missing
        return (missing.first(where: \.required) ?? missing.first)?.topic
    }

    private func headsetService(for app: AppModel) -> (any HeadsetLinkService)? {
        if let client = app.client {
            return client
        }
        #if DEBUG
            return DemoHeadsetLink()
        #else
            return nil
        #endif
    }
}
