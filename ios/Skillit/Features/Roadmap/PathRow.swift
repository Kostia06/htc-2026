import SwiftUI

/// One row of the winding trail: a tile swung left or right of centre, its label on the roomier side,
/// and its share of the dotted trail. Each row draws from its top edge to its tile and from its tile to
/// its bottom edge, meeting the neighbours halfway, so the trail stays joined whatever height a row takes.
struct PathRow<Tile: View, Label: View>: View {
    /// The least a row takes; it grows past this when a long title wraps at large text sizes.
    @ScaledMetric(relativeTo: .subheadline) private var minimumHeight: CGFloat = 118
    @State private var labelHeight: CGFloat = 0

    let width: CGFloat
    let sway: CGFloat
    let previousSway: CGFloat?
    var nextSway: CGFloat?
    @ViewBuilder let tile: () -> Tile
    @ViewBuilder let label: () -> Label

    private let gap: CGFloat = 14

    var body: some View {
        ZStack(alignment: .topLeading) {
            TrailHalves(
                tileX: tileX,
                topX: previousSway.map { edgeX(towards: $0) },
                bottomX: nextSway.map { edgeX(towards: $0) },
                height: height,
            )
            tile()
                .position(x: tileX, y: height / 2)
            label()
                .frame(width: labelWidth, alignment: labelOnLeft ? .trailing : .leading)
                .multilineTextAlignment(labelOnLeft ? .trailing : .leading)
                .fixedSize(horizontal: false, vertical: true)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { labelHeight = $0 }
                .position(x: labelCentreX, y: height / 2)
        }
        .frame(width: width, height: height)
    }

    private var height: CGFloat {
        max(minimumHeight, labelHeight + 28)
    }

    private var tileX: CGFloat {
        width / 2 + sway
    }

    /// Where the trail crosses the boundary with a neighbour: halfway between the two tiles.
    private func edgeX(towards otherSway: CGFloat) -> CGFloat {
        width / 2 + (sway + otherSway) / 2
    }

    private var labelOnLeft: Bool {
        sway > 0
    }

    private var labelWidth: CGFloat {
        let half = PathNode.size / 2 + gap
        let room = labelOnLeft ? tileX - half - 20 : width - tileX - half - 20
        return max(80, room)
    }

    private var labelCentreX: CGFloat {
        let half = PathNode.size / 2 + gap
        return labelOnLeft ? tileX - half - labelWidth / 2 : tileX + half + labelWidth / 2
    }
}

/// The trail above and below one tile, stopping short of the tile so it never draws over it.
private struct TrailHalves: View {
    let tileX: CGFloat
    let topX: CGFloat?
    let bottomX: CGFloat?
    let height: CGFloat

    var body: some View {
        Path { path in
            let clearance = PathNode.size / 2 + 10
            if let topX {
                curve(in: &path, from: CGPoint(x: topX, y: 0), to: CGPoint(x: tileX, y: height / 2 - clearance))
            }
            if let bottomX {
                curve(in: &path, from: CGPoint(x: tileX, y: height / 2 + clearance), to: CGPoint(x: bottomX, y: height))
            }
        }
        .stroke(Color(white: 0.3), style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: [0.1, 9]))
        .accessibilityHidden(true)
    }

    private func curve(in path: inout Path, from start: CGPoint, to end: CGPoint) {
        let middle = (start.y + end.y) / 2
        path.move(to: start)
        path.addCurve(to: end, control1: CGPoint(x: start.x, y: middle), control2: CGPoint(x: end.x, y: middle))
    }
}
