import SkillitKit
import SwiftUI

/// "Paths that worked": each road that ended in a job, drawn as a small version of the Road's trail of tiles.
struct TrailStrip: View {
    let trails: [Trail]
    let cited: Set<String>

    var body: some View {
        ScrollView(.horizontal) {
            HStack(alignment: .top, spacing: 12) {
                ForEach(trails) { trail in
                    TrailCard(trail: trail, isCited: cited.contains(trail.id))
                }
            }
            .scrollTargetLayout()
            .padding(.horizontal, 20)
            .padding(.vertical, 4)
        }
        .scrollTargetBehavior(.viewAligned)
        .scrollIndicators(.hidden)
    }
}

private struct TrailCard: View {
    let trail: Trail
    let isCited: Bool

    var body: some View {
        Face(isCited: isCited, surface: Theme.raised) {
            Text(trail.role).font(.headline)
            Text(who).font(.caption2).foregroundStyle(.secondary)
            MiniTrail(steps: trail.steps).padding(.vertical, 6)
            if !trail.skills.isEmpty {
                Text(trail.skills.joined(separator: " · ")).font(.caption).foregroundStyle(.secondary)
            }
        }
        .frame(width: 260)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(trail.role), \(who). Steps: \(trail.steps.map(\.name).joined(separator: ", "))")
    }

    private var who: String {
        if trail.example {
            return "Example road"
        }
        return "\(trail.people ?? 0) people got here this way"
    }
}

/// Step tiles joined by a sage line, the same look as the Road, shrunk to fit a card.
private struct MiniTrail: View {
    let steps: [RoadmapStep.Kind]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(steps.enumerated()), id: \.offset) { index, kind in
                if index > 0 {
                    Capsule().fill(Theme.action.opacity(0.45)).frame(height: 3).frame(minWidth: 6, maxWidth: 16)
                }
                Image(systemName: kind.symbol)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Theme.onAction)
                    .frame(width: 28, height: 28)
                    .background(Theme.action, in: .rect(cornerRadius: 9))
            }
        }
    }
}
