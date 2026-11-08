import Foundation
import RavenKit

/// Where the roadmap comes from: the server in the app, sample data in previews and screenshots.
protocol RoadmapService: Sendable {
    func roadmap(cursor: String?, timeZone: TimeZone) async throws(RavenError) -> RoadmapPage
    func update(step stepId: String, status: RoadmapStep.Status, note: String?) async throws(RavenError) -> RoadmapStep
}

extension RavenClient: RoadmapService {}

/// Used only if the roadmap is shown before sign-in finished; every call reports the app as offline.
struct UnavailableRoadmap: RoadmapService {
    func roadmap(cursor _: String?, timeZone _: TimeZone) async throws(RavenError) -> RoadmapPage {
        throw .offline
    }

    func update(step _: String, status _: RoadmapStep.Status, note _: String?) async throws(RavenError) -> RoadmapStep {
        throw .offline
    }
}
