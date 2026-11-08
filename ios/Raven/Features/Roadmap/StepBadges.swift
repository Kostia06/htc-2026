import RavenKit
import SwiftUI

struct KindIcon: View {
    let kind: RoadmapStep.Kind
    var highlighted = false
    var size: CGFloat = 40

    var body: some View {
        Image(systemName: kind.symbol)
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundStyle(highlighted ? Theme.action : .secondary)
            .frame(width: size, height: size)
            .background(highlighted ? Theme.action.opacity(0.15) : Color(white: 0.14), in: .rect(cornerRadius: size * 0.3))
            .accessibilityLabel(kind.name)
    }
}

struct LabelChip: View {
    let label: RoadmapStep.Label

    var body: some View {
        Text(label.text)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(label == .readyNow ? Theme.action : .secondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(label == .readyNow ? Theme.action.opacity(0.15) : Color(white: 0.16), in: .capsule)
    }
}
