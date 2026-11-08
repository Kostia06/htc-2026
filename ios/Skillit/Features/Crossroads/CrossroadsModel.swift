import Foundation
import Observation
import SkillitKit

/// One place the person's road meets everyone's: one item of theirs and one line or fact it lines up with.
struct Match: Identifiable, Equatable {
    enum Other: Equatable {
        case line(RoadLine)
        case fact(ResearchFact)

        var id: String {
            switch self {
            case let .line(line): line.id
            case let .fact(fact): fact.id
            }
        }
    }

    let you: YourItem
    let other: Other

    var id: String {
        "\(you.id)>\(other.id)"
    }
}

/// The Crossroads screen's state: the payload, which items an answer lit up, and optimistic "me too", add and delete.
@Observable
final class CrossroadsModel {
    enum Phase: Equatable {
        case loading
        case ready(Crossroads)
        case failed(String)
    }

    private(set) var phase: Phase = .loading
    /// Ids the latest answer leaned on; the rows with these ids are outlined in sand.
    private(set) var cited: Set<String> = []
    private(set) var notice: String?

    private let service: any CrossroadsService

    init(service: any CrossroadsService) {
        self.service = service
    }

    var view: Crossroads? {
        guard case let .ready(view) = phase else { return nil }
        return view
    }

    /// Every link to a line or fact still on screen, strongest first: links arrive sorted.
    var matches: [Match] {
        guard let view else { return [] }
        let yours = Dictionary(uniqueKeysWithValues: view.you.map { ($0.id, $0) })
        let lines = Dictionary(uniqueKeysWithValues: view.everyone.map { ($0.id, $0) })
        let facts = Dictionary(uniqueKeysWithValues: view.research.map { ($0.id, $0) })
        return view.links.compactMap { link in
            guard let you = yours[link.you] else { return nil }
            if let line = lines[link.everyone] {
                return Match(you: you, other: .line(line))
            }
            return facts[link.everyone].map { Match(you: you, other: .fact($0)) }
        }
    }

    /// Their items that match nothing yet, so "Only you" doesn't repeat what the matches already show.
    var unlinkedYours: [YourItem] {
        guard let view else { return [] }
        let linked = Set(view.links.map(\.you))
        return view.you.filter { !linked.contains($0.id) }
    }

    var unlinkedLines: [RoadLine] {
        guard let view else { return [] }
        let linked = Set(view.links.map(\.everyone))
        return view.everyone.filter { !linked.contains($0.id) }
    }

    var unlinkedFacts: [ResearchFact] {
        guard let view else { return [] }
        let linked = Set(view.links.map(\.everyone))
        return view.research.filter { !linked.contains($0.id) }
    }

    func load() async {
        if view == nil {
            phase = .loading
        }
        do {
            phase = try await .ready(service.crossroads())
        } catch {
            if view == nil {
                phase = .failed(error.message)
            }
        }
    }

    func highlight(_ cites: [CrossroadsCite]) {
        cited = Set(cites.map(\.id))
    }

    func toggleMeToo(_ line: RoadLine) async {
        guard var view else { return }
        let behind = !line.meToo
        update(&view, line.id) { $0.meToo = behind }
        phase = .ready(view)
        do {
            let fresh = try await service.standBehind(lineID: line.id, behind)
            guard var current = self.view else { return }
            // a line that drops under three people comes back without one, so its count goes rather than going stale
            update(&current, line.id) { $0.people = fresh?.people }
            phase = .ready(current)
        } catch {
            guard var current = self.view else { return }
            update(&current, line.id) { $0.meToo = line.meToo }
            phase = .ready(current)
            await flash(error.message)
        }
    }

    func addToRoad(_ line: RoadLine) async {
        guard var view, !view.isOnRoad(line) else { return }
        var road = view.yourRoad ?? YourRoad()
        road.added.append(line.id)
        view.yourRoad = road
        phase = .ready(view)
        do {
            try await service.addToRoad(lineID: line.id)
            await flash("Added to your road")
        } catch {
            guard var current = self.view else { return }
            current.yourRoad?.added.removeAll { $0 == line.id }
            phase = .ready(current)
            await flash(error.message)
        }
    }

    func forget(_ item: YourItem) async {
        guard item.source == .memory, let before = view else { return }
        var view = before
        view.you.removeAll { $0.id == item.id }
        view.links.removeAll { $0.you == item.id }
        phase = .ready(view)
        do {
            try await service.forgetMemory(id: item.id)
        } catch .rejected(status: 404, message: _) {
            // already gone on the server: nothing to put back
        } catch {
            phase = .ready(before)
            await flash(error.message)
        }
    }

    private func update(_ view: inout Crossroads, _ id: String, _ change: (inout RoadLine) -> Void) {
        guard let index = view.everyone.firstIndex(where: { $0.id == id }) else { return }
        change(&view.everyone[index])
    }

    private func flash(_ message: String) async {
        notice = message
        try? await Task.sleep(for: .seconds(3))
        notice = nil
    }
}
