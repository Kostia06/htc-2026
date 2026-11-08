import RavenKit

/// Where the roadmap comes from: the server in the app, sample data in previews and screenshots.
protocol RoadmapService: Sendable {
    func roadmap(cursor: String?) async throws(RavenError) -> RoadmapPage
    func setStatus(_ status: RoadmapStep.Status, ofStep stepId: String) async throws(RavenError)
}

extension RavenClient: RoadmapService {}

/// Used only if the roadmap is shown before sign-in finished; every call reports the app as offline.
struct UnavailableRoadmap: RoadmapService {
    func roadmap(cursor _: String?) async throws(RavenError) -> RoadmapPage {
        throw .offline
    }

    func setStatus(_: RoadmapStep.Status, ofStep _: String) async throws(RavenError) {
        throw .offline
    }
}
