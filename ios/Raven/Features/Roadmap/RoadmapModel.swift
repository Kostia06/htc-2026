import Foundation
import Observation
import RavenKit

/// The loaded roadmap, whether more is on the way, and the step whose "what did you do?" sheet is open.
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
    var finishing: RoadmapStep?

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

    /// The first load shows the skeleton; a refresh keeps the page on screen until the new one arrives.
    func load() async {
        if page == nil {
            phase = .loading
        }
        do {
            phase = try await .ready(service.roadmap(cursor: nil, timeZone: .current))
        } catch {
            if page == nil {
                phase = .failed(error.message)
            }
        }
    }

    /// Called when the end of the list scrolls into view; a second call while one is running does nothing.
    func loadMore() async {
        guard var current = page, let cursor = current.nextCursor, !isLoadingMore else { return }
        isLoadingMore = true
        loadMoreFailed = false
        defer { isLoadingMore = false }
        do {
            let more = try await service.roadmap(cursor: cursor, timeZone: .current)
            // re-read: a step may have been finished while the page was loading
            current = page ?? current
            current.append(more)
            phase = .ready(current)
        } catch {
            loadMoreFailed = true
        }
    }

    /// Moves the step into today's completed group at once, then tells the server; a refused change is put back.
    func complete(_ step: RoadmapStep, note: String?) {
        guard var current = page, let previous = current.complete(step.id, note: note) else { return }
        phase = .ready(current)
        Task { await send(.done, for: previous, note: note) }
    }

    private func send(_ status: RoadmapStep.Status, for previous: RoadmapStep, note: String?) async {
        do {
            let saved = try await service.update(step: previous.id, status: status, note: note)
            guard var latest = page else { return }
            latest.replace(saved)
            phase = .ready(latest)
        } catch {
            guard var latest = page else { return }
            latest.restore(previous)
            phase = .ready(latest)
        }
    }
}
