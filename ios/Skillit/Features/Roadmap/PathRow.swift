import SwiftUI

/// One row of the winding trail: a tile swung left or right of centre, its label on the roomier side,
/// and a dotted trail back up to the previous tile.
struct PathRow<Tile: View, Label: View>: View {
    /// Grows with Dynamic Type so a two-line label never spills into the rows above and below it.
    @ScaledMetric(relativeTo: .subheadline) private var height: CGFloat = 118

    let width: CGFloat
    let sway: CGFloat
    let previousSway: CGFloat?
    @ViewBuilder let tile: () -> Tile
    @ViewBuilder let label: () -> Label

    private let gap: CGFloat = 14
    private var tileX: CGFloat {
        width / 2 + sway
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            if let previousSway {
                DottedTrail(startX: width / 2 + previousSway, endX: tileX, rowHeight: height)
            }
            tile()
                .position(x: tileX, y: height / 2)
            label()
                .frame(width: labelWidth, alignment: labelOnLeft ? .trailing : .leading)
                .multilineTextAlignment(labelOnLeft ? .trailing : .leading)
                .frame(maxHeight: height)
                .position(x: labelCentreX, y: height / 2)
        }
        .frame(width: width, height: height)
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

/// Runs from just under the previous tile to just above this one, so it never draws over either tile.
private struct DottedTrail: View {
    let startX: CGFloat
    let endX: CGFloat
    let rowHeight: CGFloat

    var body: some View {
        Path { path in
            let clearance = PathNode.size / 2 + 10
            let start = CGPoint(x: startX, y: -rowHeight / 2 + clearance)
            let end = CGPoint(x: endX, y: rowHeight / 2 - clearance)
            path.move(to: start)
            path.addCurve(
                to: end,
                control1: CGPoint(x: startX, y: (start.y + end.y) / 2),
                control2: CGPoint(x: endX, y: (start.y + end.y) / 2),
            )
        }
        .stroke(Color(white: 0.3), style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: [0.1, 9]))
        .accessibilityHidden(true)
    }
}
