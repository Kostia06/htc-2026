import Foundation
import Observation
import RavenKit

/// The loaded part of the roadmap, whether more is on the way, and the step whose card is open.
@Observable
final class RoadmapModel {
    enum Phase: Equatable {
        case loading
        case ready(RoadmapPage)
        case failed(String)
    }

    private(set) var phase: Phase = .loading
    private(set) var isLoadingMore = false
    private(set) var loadMoreFailed = false
    var selectedStepID: String?

    private let service: any RoadmapService

    init(service: any RoadmapService) {
        self.service = service
    }

    var page: RoadmapPage? {
        if case let .ready(page) = phase {
            page
        } else {
            nil
        }
    }

    func loadFirstPage() async {
        phase = .loading
        do {
            phase = try await .ready(service.roadmap(cursor: nil))
        } catch {
            phase = .failed(error.message)
        }
    }

    /// Called when the end of the path scrolls into view; a second call while one is running does nothing.
    func loadMore() async {
        guard var current = page, let cursor = current.nextCursor, !isLoadingMore else { return }
        isLoadingMore = true
        loadMoreFailed = false
        defer { isLoadingMore = false }
        do {
            let next = try await service.roadmap(cursor: cursor)
            // re-read: a status may have changed while the page was loading
            current = page ?? current
            current.append(next)
            phase = .ready(current)
        } catch {
            loadMoreFailed = true
        }
    }

    /// Shows the change at once and puts it back if the server refuses.
    func setStatus(_ status: RoadmapStep.Status, of stepID: String) async {
        guard var current = page, let previous = current.setStatus(status, of: stepID) else { return }
        phase = .ready(current)
        do {
            try await service.setStatus(status, ofStep: stepID)
        } catch {
            guard var latest = page else { return }
            latest.setStatus(previous, of: stepID)
            phase = .ready(latest)
        }
    }
}
