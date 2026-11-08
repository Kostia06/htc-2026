import Foundation

/// The one thing Crossroads leads with: the path most people on this road took, and how much of it the person has done.
public struct PathInsight: Equatable, Sendable {
    public let role: String
    /// Real people behind the path; nil when it is an example Skillit wrote.
    public let people: Int?
    public let steps: [RoadmapStep.Kind]
    public let done: Set<RoadmapStep.Kind>

    public var isExample: Bool {
        people == nil
    }

    public var doneCount: Int {
        steps.count(where: done.contains)
    }

    /// The first step of the path the person hasn't taken yet.
    public var next: RoadmapStep.Kind? {
        steps.first { !done.contains($0) }
    }
}

public extension Crossroads {
    /// From the first trail, which the server ranks as the person's own role with the most people first.
    /// A kind taken twice on the path counts once, so "2 of 3" never asks for the same thing again.
    var pathInsight: PathInsight? {
        guard let trail = trails.first else { return nil }
        var seen = Set<RoadmapStep.Kind>()
        let steps = trail.steps.filter { $0 != .exploreMemory && seen.insert($0).inserted }
        guard !steps.isEmpty else { return nil }
        let done = Set(yourRoad?.done ?? []).intersection(steps)
        return PathInsight(role: trail.role, people: trail.example ? nil : trail.people, steps: steps, done: done)
    }

    /// Whether the person already put this line on their road.
    func isOnRoad(_ line: RoadLine) -> Bool {
        yourRoad?.added.contains(line.id) ?? false
    }
}
