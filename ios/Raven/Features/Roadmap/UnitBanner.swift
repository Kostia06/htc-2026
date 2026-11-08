import RavenKit
import SwiftUI

/// The band that opens each unit of the path, like Duolingo's section headers. The unit in progress is orange.
struct UnitBanner: View {
    let unit: RoadmapUnit
    let isActive: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text("UNIT \(unit.index + 1)")
                    .font(.caption.weight(.heavy))
                    .foregroundStyle(isActive ? .white.opacity(0.8) : .secondary)
                if unit.source == .agent {
                    Label("Planned for you", systemImage: "sparkles")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(isActive ? .white.opacity(0.8) : Theme.agent)
                }
            }
            Text(unit.title)
                .font(.title3.bold())
            Text(unit.summary)
                .font(.subheadline)
                .foregroundStyle(isActive ? .white.opacity(0.85) : .secondary)
        }
        .foregroundStyle(isActive ? .white : .primary)
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(isActive ? Theme.action : Theme.raised, in: .rect(cornerRadius: 18))
        .background(alignment: .bottom) {
            RoundedRectangle(cornerRadius: 18)
                .fill(isActive ? Theme.action.mix(with: .black, by: 0.35) : Color(white: 0.05))
                .offset(y: 5)
        }
        .padding(.bottom, 5)
        .accessibilityElement(children: .combine)
    }
}
